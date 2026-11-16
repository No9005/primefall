import type { GridPosition, HeroClass } from "game-core";
import { AUDIO_FOLDER, type AudioManifest, assetUrl, manifestUrl } from "./audio-manifest";
import { distanceGain, SfxLimiter, VoiceDirector } from "./audio-mix";
import { planMoment, type PlanContext, type SoundRequest, type Source } from "./audio-cues";

// The player of the game sound: it loads the Heroes' sounds, starts the sounds the cues ask for through the rules of the
// mix (`audio-mix.ts`) on two buses (voice and effects). It uses the Web Audio API of the browser,
// no library. There is no mute switch yet; it comes with the menu (issue #446). A browser lets a page make sound only after a tap, so the sound is armed on the first one (`armUnlock`).

/** A voice that is cut by a more important one fades out this fast. */
const CUT_FADE_S = 0.08;

interface Playing {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class GameAudio {
  private context: AudioContext | undefined;
  private voiceBus: GainNode | undefined;
  private sfxBus: GainNode | undefined;
  private readonly manifests = new Map<HeroClass, AudioManifest>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<HeroClass, Promise<void>>();
  private readonly playing = new Map<string, Playing>();
  private readonly director = new VoiceDirector();
  private readonly limiter = new SfxLimiter();
  private readonly lastPick = new Map<string, string>();

  /** Arms the sound on the first tap or key press of the page. Returns the function that takes it back. */
  armUnlock(): () => void {
    const unlock = () => {
      void this.ensureContext()?.resume().catch(() => undefined);
    };
    const events = ["pointerdown", "keydown"] as const;
    for (const name of events) window.addEventListener(name, unlock);
    return () => {
      for (const name of events) window.removeEventListener(name, unlock);
    };
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context;
    if (typeof AudioContext === "undefined") return undefined;
    const context = new AudioContext();
    this.voiceBus = context.createGain();
    this.sfxBus = context.createGain();
    this.voiceBus.connect(context.destination);
    this.sfxBus.connect(context.destination);
    this.context = context;
    return context;
  }

  /** Loads and decodes the sounds of these Hero classes, once. The sounds of a class that is not loaded yet are skipped. */
  load(heroClasses: readonly HeroClass[]): Promise<void> {
    return Promise.all(heroClasses.map((heroClass) => this.loadClass(heroClass))).then(() => undefined);
  }

  private loadClass(heroClass: HeroClass): Promise<void> {
    const started = this.loading.get(heroClass);
    if (started) return started;
    const loaded = this.fetchClass(heroClass).catch(() => {
      // A missing sound must never break the game; try again at the next load.
      this.loading.delete(heroClass);
    });
    this.loading.set(heroClass, loaded);
    return loaded;
  }

  private async fetchClass(heroClass: HeroClass): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    const manifest = (await (await fetch(manifestUrl(heroClass))).json()) as AudioManifest;
    await Promise.all(
      Object.entries(manifest.assets).map(async ([id, asset]) => {
        const data = await (await fetch(assetUrl(heroClass, asset))).arrayBuffer();
        this.buffers.set(`${AUDIO_FOLDER[heroClass]}:${id}`, await context.decodeAudioData(data));
      }),
    );
    this.manifests.set(heroClass, manifest);
  }

  /** The context the cue planner needs; `parts` is what only the screen knows. */
  contextFor(parts: Pick<PlanContext, "classOf" | "isOwn" | "isHeard" | "tileOf"> & { immediate?: boolean }): PlanContext {
    return { ...parts, manifestOf: (heroClass) => this.manifests.get(heroClass), random: Math.random, lastPick: this.lastPick };
  }

  /** Plays the sounds of a frame of the Resolution; `listener` is where the player's Hero stands, which sets how loud far sounds are. */
  play(requests: readonly SoundRequest[], listener?: GridPosition): void {
    const context = this.context;
    // A context that is not running yet (the first tap is still arming it) queues the sounds and plays them once it runs.
    if (!context || context.state === "closed") return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const nowMs = context.currentTime * 1000;
    for (const request of requests) this.start(context, request, nowMs, listener);
  }

  private start(context: AudioContext, request: SoundRequest, nowMs: number, listener: GridPosition | undefined): void {
    const buffer = this.buffers.get(`${AUDIO_FOLDER[request.heroClass]}:${request.assetId}`);
    const bus = request.kind === "voice" ? this.voiceBus : this.sfxBus;
    if (!buffer || !bus) return;
    const startMs = nowMs + request.startMs;
    const durationMs = buffer.duration * 1000;
    const decision =
      request.kind === "voice"
        ? this.director.request({ heroId: request.heroId, tile: request.tile ?? { col: 0, row: 0 }, startMs, durationMs, priority: request.priority })
        : this.limiter.request({ assetId: `${request.heroClass}:${request.assetId}`, startMs, durationMs, priority: request.priority });
    if (!decision.play || decision.id === undefined) return;
    for (const id of decision.cut) this.fadeOut(`${request.kind}${id}`, startMs / 1000);

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = listener && request.tile ? distanceGain(listener, request.tile) : 1;
    source.connect(gain).connect(bus);
    const key = `${request.kind}${decision.id}`;
    this.playing.set(key, { source, gain });
    source.onended = () => this.playing.delete(key);
    source.start(Math.max(context.currentTime, startMs / 1000));
  }

  private fadeOut(key: string, atSeconds: number): void {
    const sound = this.playing.get(key);
    const context = this.context;
    if (!sound || !context) return;
    const at = Math.max(context.currentTime, atSeconds);
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, at);
    sound.gain.gain.linearRampToValueAtTime(0, at + CUT_FADE_S);
    sound.source.stop(at + CUT_FADE_S + 0.02);
  }

  /** Silences everything that plays or waits to play (a Hero Select tap, the end of the screen). */
  stopAll(): void {
    for (const { source } of this.playing.values()) {
      try {
        source.stop();
      } catch {
        // It had not started or had ended already.
      }
    }
    this.playing.clear();
    this.director.clear();
    this.limiter.clear();
  }

  /** A moment of the game that is not a frame of the Resolution: the Hero Select, a Pitch, the end of the match. */
  playMoment(on: "heroSelected" | "cardPitched" | "matchEnd", who: Source, won?: boolean): void {
    const ctx = this.contextFor({ classOf: () => who.heroClass, isOwn: () => true, isHeard: () => true, tileOf: () => who.tile });
    this.play(planMoment(on, who, ctx, won), who.tile);
  }
}

export const gameAudio = new GameAudio();
