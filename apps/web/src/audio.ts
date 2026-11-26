import { findTiles, type GridPosition, type HeroClass, NOTSTROM_MAP, TileKind } from "game-core";
import { AUDIO_FOLDER, type AudioManifest, assetUrl, type HangarSound, MAP_FOLDER, MAP_MANIFEST_URL, type MapManifest, manifestUrl, MUSIC_MANIFEST_URL, type MusicManifest, musicFileUrl, type UiSound } from "./audio-manifest";
import { distanceGain, MUSIC_DUCK, nextAmbienceGapMs, pickVariant, Priority, SfxLimiter, VoiceDirector } from "./audio-mix";
import { planMoment, type PlanContext, type SoundRequest, type Source } from "./audio-cues";
import { NOTSTROM_INTRO_SOUND } from "./notstrom-intro";
import { type MusicLevel, nextBarTime } from "./music";

// The player of the game sound: it loads the Heroes' sounds, starts the sounds the cues ask for through the rules of the
// mix (`audio-mix.ts`) on two buses (voice and effects). It uses the Web Audio API of the browser,
// no library. There is no mute switch yet; it comes with the menu (issue #446). A browser lets a page make sound only after a tap, so the sound is armed on the first one (`armUnlock`).

/** A voice or effect that is cut by a more important one fades out this slowly (a short fade clicked when many sounds ran at once). */
const CUT_FADE_S = 0.25;
/** The steps are mastered hot and many land at once when a Squad walks: each is 6 dB down. */
const STEP_GAIN = 0.5;
const isStep = (assetId: string) => assetId.startsWith("sfx.step-");

interface Playing {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** The ambience of the map while a match runs. */
interface Ambience {
  /** How loud the ambience is against the match (1): the Hero Select plays it quieter. */
  level: number;
  loops: { source: AudioBufferSourceNode; gain: GainNode; base: number; nearPrimeZone: boolean }[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

/** The music: how loud its bus is, how long a layer takes to fade (a time constant: about three of them make the change), how long it fades out. */
const MUSIC_BUS_GAIN = 1;
/** Gain of every bus together (-6 dB), before the safety limiter. */
const MASTER_HEADROOM = 0.5;
/** Every one-shot fades in and out this fast, so a file that starts or ends mid-wave does not click. */
const DECLICK_IN_S = 0.003;
const DECLICK_OUT_S = 0.012;
const MUSIC_FADE_TIME_CONSTANT_S = 0.4;
/** A change that starts at once: a layer that comes in is quick (about three of these make it, 0.18 s); one that goes out is a little slower (0.45 s), so that drums do not stop in the middle of a hit. */
const MUSIC_NOW_IN_TIME_CONSTANT_S = 0.06;
const MUSIC_NOW_OUT_TIME_CONSTANT_S = 0.15;
const MUSIC_FADE_OUT_S = 1.5;
/**
 * The opening of a match gives way to the layers: it fades out along a cosine over its last two bars; the layers start earlier,
 * over four bars, so the first sounds of the planning are heard under the singer.
 */
const OPENING_FADE_BARS = 2;
const LAYERS_FADE_IN_BARS = 4;
const FADE_STEPS = 24;

/** Ramps a parameter from `from` to `to` along `shape` (0 to 1 in, 0 to 1 out) as short straight pieces, which a later `cancelScheduledValues` can still cut. */
function shapedRamp(param: AudioParam, { from, to, start, seconds }: { from: number; to: number; start: number; seconds: number }, shape: (t: number) => number): void {
  param.setValueAtTime(from, start);
  for (let step = 1; step <= FADE_STEPS; step++) {
    const t = step / FADE_STEPS;
    param.linearRampToValueAtTime(from + (to - from) * shape(t), start + seconds * t);
  }
}

/** The intro of the Hero Select fades in softly and out quickly (the opening of the match comes in hard). */
/** The main-menu theme comes in slowly (it begins as a quiet choir chord) and leaves while the Notstrom Intro starts. */
const MENU_FADE_IN_S = 3;
const MENU_FADE_OUT_S = 1.5;
const INTRO_FADE_IN_S = 0.5;
const INTRO_FADE_OUT_S = 0.4;
/** A stop of the intro waits this long, in case the screen asks for the intro again at once. */
const INTRO_STOP_GRACE_MS = 80;
/** The music plays by default; `?music=off` in the address turns it off (`?music=on` is still accepted and changes nothing). */
const MUSIC_ON = typeof window === "undefined" || new URLSearchParams(window.location.search).get("music") !== "off";

/** The music while a match runs: all layers start together and loop in sync. */
interface Music {
  /** When the layers start (after the opening, minus the bar it fades out over). */
  startedAt: number;
  /** How long the layers take to fade in at the start. */
  fadeInSeconds: number;
  loopSeconds: number;
  layers: Record<string, GainNode>;
  /** The opening (the bridge) that plays first and fades out under the layers; it has no level of its own. */
  opening: GainNode | undefined;
  sources: AudioBufferSourceNode[];
}

/** The ambience fades in and out this slowly. */
const AMBIENCE_FADE_S = 2;
/** In the Hero Select the hum of Tilly's drone starts this long after her tap: where her select clip lets the drone go. */
const SELECT_DRONE_DELAY_S = 0.9;
/** The one-shots of the ambience are quieter than the effects of the Heroes. */
const ONE_SHOT_GAIN = 0.6;

/** The middle of the Prime Zone: the core hum is loudest near it. */
const PRIME_ZONE_CENTRE: GridPosition = (() => {
  const tiles = findTiles(NOTSTROM_MAP, TileKind.PrimeZone);
  return { col: Math.round(tiles.reduce((sum, tile) => sum + tile.col, 0) / tiles.length), row: Math.round(tiles.reduce((sum, tile) => sum + tile.row, 0) / tiles.length) };
})();

export class GameAudio {
  /** `createContext` is for tests and for rendering the mix to a file (an `OfflineAudioContext`); the game uses the default. */
  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

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
  private mapManifest: MapManifest | undefined;
  private mapLoading: Promise<void> | undefined;
  private ambience: Ambience | undefined;
  private musicManifest: MusicManifest | undefined;
  private musicLoading: Promise<void> | undefined;
  private music: Music | undefined;
  private musicBus: GainNode | undefined;
  /** The sound of the Notstrom Intro after a tap on Start: it plays once. The Hero Select loop is scheduled under its end (`intro`, from `introAt`). */
  private introAt: number | undefined;
  private introStopTimer: ReturnType<typeof setTimeout> | undefined;
  private notstromIntroCue: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  /** The main-menu theme of the start screen: a loop that runs until the player leaves the screen. */
  private menu: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  /** The intro of the Hero Select: a loop that runs until the player leaves the screen. */
  private intro: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  /** The music of the end screen: a jingle that gives way to a quiet loop. */
  private ending: { sources: AudioBufferSourceNode[]; gains: GainNode[] } | undefined;
  /** The music steps back under the voices and the heavy effects (`MUSIC_DUCK`). */
  private duckNode: GainNode | undefined;
  private duckedUntilS = 0;
  private musicLevel: MusicLevel = 0;
  /** The laser barrier: wanted while the Prime Zone is inactive, heard while the ambience runs. */
  private barrierWanted = false;
  private barrier: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  /** The middles of the Scout Drone areas the player's Squad has out: the drone hums while there is one. */
  private scoutDroneAreas: readonly GridPosition[] = [];
  private scoutDrone: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  /** The hum of Tilly's drone in the Hero Select: it runs while she is the chosen Hero. */
  private selectDrone: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
  private listener: GridPosition | undefined;

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
    const context = this.createContext();
    this.voiceBus = context.createGain();
    this.sfxBus = context.createGain();
    // Everything ends in one limiter: the sum of the music, the voices and the effects must not clip.
    // The files are mastered hot (many reach 0 dBFS), so the buses first make headroom: the limiter then only catches the rare sum of many loud sounds.
    const master = context.createGain();
    master.gain.value = MASTER_HEADROOM;
    const safety = context.createDynamicsCompressor();
    // A soft knee and a gentle ratio: the hard one (knee 0, ratio 20, attack 1 ms) pumped and crackled when many steps summed up.
    safety.threshold.value = -6;
    safety.knee.value = 12;
    safety.ratio.value = 6;
    safety.attack.value = 0.005;
    safety.release.value = 0.3;
    master.connect(safety).connect(context.destination);
    this.voiceBus.connect(master);
    this.sfxBus.connect(master);
    // The music has a bus of its own, with a limiter: the sum of the layers must not clip.
    this.musicBus = context.createGain();
    this.musicBus.gain.value = MUSIC_BUS_GAIN;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    this.duckNode = context.createGain();
    this.musicBus.connect(this.duckNode).connect(limiter).connect(master);
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
        const data = await (await fetch(assetUrl(AUDIO_FOLDER[heroClass], asset))).arrayBuffer();
        this.buffers.set(`${AUDIO_FOLDER[heroClass]}:${id}`, await context.decodeAudioData(data));
      }),
    );
    this.manifests.set(heroClass, manifest);
  }

  /** Loads the sounds of the map and of the cards, once. */
  loadMap(): Promise<void> {
    this.mapLoading ??= this.fetchMap().catch(() => {
      // A missing sound must never break the game; try again at the next load.
      this.mapLoading = undefined;
    });
    return this.mapLoading;
  }

  private async fetchMap(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    const manifest = (await (await fetch(MAP_MANIFEST_URL)).json()) as MapManifest;
    await Promise.all(
      Object.entries(manifest.assets).map(async ([id, asset]) => {
        const data = await (await fetch(assetUrl(MAP_FOLDER, asset))).arrayBuffer();
        this.buffers.set(`${MAP_FOLDER}:${id}`, await context.decodeAudioData(data));
      }),
    );
    this.mapManifest = manifest;
  }

  /** Where the player's Hero stands: the core hum of the map follows it. */
  setListener(tile: GridPosition): void {
    this.listener = tile;
    const context = this.context;
    if (!this.ambience || !context) return;
    for (const loop of this.ambience.loops) {
      if (loop.nearPrimeZone) loop.gain.gain.setTargetAtTime(loop.base * distanceGain(tile, PRIME_ZONE_CENTRE), context.currentTime, 0.5);
    }
    if (this.barrier && this.mapManifest) this.barrier.gain.gain.setTargetAtTime(this.mapManifest.ambience.barrier.gain * distanceGain(tile, PRIME_ZONE_CENTRE), context.currentTime, 0.5);
    if (this.scoutDrone && this.mapManifest) this.scoutDrone.gain.gain.setTargetAtTime(this.mapManifest.ambience.scoutDrone.gain * this.scoutDroneDistance(), context.currentTime, 0.5);
  }

  /**
   * The laser barrier around the Prime Zone: it hums while the walls stand (`on`), and the sound of its dissolving plays when
   * it goes while the ambience runs. The hum is louder the nearer the player's Hero is to the Prime Zone.
   */
  setBarrier(on: boolean): void {
    const wasOn = this.barrierWanted;
    this.barrierWanted = on;
    this.applyBarrier(wasOn && !on);
  }

  private applyBarrier(dissolve: boolean): void {
    const context = this.context;
    const manifest = this.mapManifest;
    if (!context || !manifest || !this.ambience || !this.sfxBus) return;
    if (this.barrierWanted && !this.barrier) {
      const buffer = this.buffers.get(`${MAP_FOLDER}:${manifest.ambience.barrier.loop}`);
      if (!buffer) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      const level = manifest.ambience.barrier.gain * (this.listener ? distanceGain(this.listener, PRIME_ZONE_CENTRE) : 1);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(level, context.currentTime + AMBIENCE_FADE_S / 2);
      source.connect(gain).connect(this.sfxBus);
      source.start();
      this.barrier = { source, gain };
    } else if (!this.barrierWanted && this.barrier) {
      this.fadeOutBarrier();
      if (dissolve) this.playUi("laserOff");
    }
  }

  private fadeOutBarrier(): void {
    const barrier = this.barrier;
    this.barrier = undefined;
    this.fadeOutLoop(barrier);
  }

  /** Fades a looping sound out and stops it. */
  private fadeOutLoop(loop: { source: AudioBufferSourceNode; gain: GainNode } | undefined): void {
    const context = this.context;
    if (!loop || !context) return;
    loop.gain.gain.cancelScheduledValues(context.currentTime);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, context.currentTime);
    loop.gain.gain.linearRampToValueAtTime(0, context.currentTime + AMBIENCE_FADE_S / 2);
    loop.source.stop(context.currentTime + AMBIENCE_FADE_S / 2 + 0.05);
  }

  /**
   * The hum of the player's own Scout Drone: it runs while the Squad has a Site Survey area out (`centres` are the middles of the areas, none
   * when there is no area) and is quieter the further the player's Hero is from the nearest one. Only the own Squad's areas are passed, so it
   * gives nothing away about the enemy (Fog of War).
   */
  setScoutDrones(centres: readonly GridPosition[]): void {
    this.scoutDroneAreas = centres;
    this.applyScoutDrone();
  }

  /** 1 near the nearest area, less with distance (`distanceGain`); 1 while the player's Hero is not known. */
  private scoutDroneDistance(): number {
    const listener = this.listener;
    if (!listener || this.scoutDroneAreas.length === 0) return 1;
    return Math.max(...this.scoutDroneAreas.map((centre) => distanceGain(listener, centre)));
  }

  /** The hum of the Scout Drone as a loop that fades in from `delayS` on; undefined while its sound is not loaded. */
  private startDroneLoop(level: number, delayS = 0): { source: AudioBufferSourceNode; gain: GainNode } | undefined {
    const context = this.context;
    const manifest = this.mapManifest;
    const buffer = manifest && this.buffers.get(`${MAP_FOLDER}:${manifest.ambience.scoutDrone.loop}`);
    if (!context || !buffer || !this.sfxBus) return undefined;
    const begin = context.currentTime + delayS;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, begin);
    gain.gain.linearRampToValueAtTime(level, begin + AMBIENCE_FADE_S / 2);
    source.connect(gain).connect(this.sfxBus);
    source.start(begin);
    return { source, gain };
  }

  /**
   * The hum of Tilly's Scout Drone in the Hero Select: it starts under her select clip, where she lets the drone go, and runs while she stays
   * the chosen Hero (`on`); another Hero, taking the choice back or leaving the screen fades it out.
   */
  setSelectDrone(on: boolean): void {
    const running = this.selectDrone;
    if (on && !running) {
      this.selectDrone = this.startDroneLoop(this.mapManifest?.ambience.scoutDrone.gain ?? 0, SELECT_DRONE_DELAY_S);
    } else if (!on && running) {
      this.selectDrone = undefined;
      this.fadeOutLoop(running);
    }
  }

  private applyScoutDrone(): void {
    const context = this.context;
    const manifest = this.mapManifest;
    if (!context || !manifest || !this.ambience || !this.sfxBus) return;
    const wanted = this.scoutDroneAreas.length > 0;
    if (wanted && !this.scoutDrone) {
      this.scoutDrone = this.startDroneLoop(manifest.ambience.scoutDrone.gain * this.scoutDroneDistance());
    } else if (!wanted && this.scoutDrone) {
      const drone = this.scoutDrone;
      this.scoutDrone = undefined;
      this.fadeOutLoop(drone);
    } else if (this.scoutDrone) {
      this.scoutDrone.gain.gain.setTargetAtTime(manifest.ambience.scoutDrone.gain * this.scoutDroneDistance(), context.currentTime, 0.5);
    }
  }

  /** Starts the ambience of the map: the loops fade in, and a quiet sound now and then. Runs until `stopAmbience`. `level` is how loud it is (1 in the match); `without` are sounds of the map ambience (loops and the quiet sounds now and then) that are left out (the hangar has no plasma core, and its own sparks). */
  startAmbience(level = 1, without: readonly string[] = []): void {
    const context = this.context;
    const manifest = this.mapManifest;
    if (this.ambience || !context || !manifest) return;
    const loops = manifest.ambience.loops.flatMap(({ play, gain: base, nearPrimeZone }) => {
      if (without.includes(play)) return [];
      const buffer = this.buffers.get(`${MAP_FOLDER}:${play}`);
      if (!buffer || !this.sfxBus) return [];
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      const loudness = nearPrimeZone && this.listener ? base * level * distanceGain(this.listener, PRIME_ZONE_CENTRE) : base * level;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(loudness, context.currentTime + AMBIENCE_FADE_S);
      source.connect(gain).connect(this.sfxBus);
      source.start();
      return [{ source, gain, base: base * level, nearPrimeZone: nearPrimeZone === true }];
    });
    this.ambience = { level, loops, timer: undefined };
    this.scheduleOneShot({ ...manifest.ambience.oneShots, play: manifest.ambience.oneShots.play.filter((id) => !without.includes(id)) });
    this.applyBarrier(false);
    this.applyScoutDrone();
  }

  private scheduleOneShot(oneShots: MapManifest["ambience"]["oneShots"]): void {
    const [min, max] = oneShots.everyMs;
    const timer = setTimeout(() => {
      if (!this.ambience) return;
      const id = pickVariant(oneShots.play, this.lastPick.get("ambience"), Math.random);
      const context = this.context;
      const buffer = id === undefined ? undefined : this.buffers.get(`${MAP_FOLDER}:${id}`);
      if (id !== undefined && context && buffer && this.sfxBus) {
        this.lastPick.set("ambience", id);
        const decision = this.limiter.request({ assetId: `${MAP_FOLDER}:${id}`, startMs: context.currentTime * 1000, durationMs: buffer.duration * 1000, priority: Priority.Background });
        if (decision.play) this.startBuffer(context, buffer, this.sfxBus, { level: ONE_SHOT_GAIN * (this.ambience?.level ?? 1), panner: context.createStereoPanner?.() });
      }
      this.scheduleOneShot(oneShots);
    }, nextAmbienceGapMs(Math.random, { min, max }));
    if (this.ambience) this.ambience.timer = timer;
  }

  /** Loads the layers of the music, once. */
  loadMusic(): Promise<void> {
    this.musicLoading ??= this.fetchMusic().catch(() => {
      // A missing sound must never break the game; try again at the next load.
      this.musicLoading = undefined;
    });
    return this.musicLoading;
  }

  private async fetchMusic(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    const manifest = (await (await fetch(MUSIC_MANIFEST_URL)).json()) as MusicManifest;
    const files: Record<string, string> = { ...manifest.layers };
    if (manifest.menu) files.menu = manifest.menu.file;
    if (manifest.notstromIntro) files.notstromIntro = manifest.notstromIntro.file;
    if (manifest.intro) files.intro = manifest.intro.file;
    if (manifest.opening) files.opening = manifest.opening.file;
    for (const [outcome, track] of Object.entries(manifest.ending ?? {})) {
      files[`ending:${outcome}:jingle`] = track.jingle.file;
      files[`ending:${outcome}:loop`] = track.loop.file;
    }
    await Promise.all(
      Object.entries(files).map(async ([name, file]) => {
        const data = await (await fetch(musicFileUrl(file))).arrayBuffer();
        this.buffers.set(`music:${name}`, await context.decodeAudioData(data));
      }),
    );
    this.musicManifest = manifest;
  }

  /** The main-menu theme of the start screen: it loops until `stopMenu`. It starts when the browser lets the page make sound (the first tap). */
  startMenu(): void {
    const context = this.context;
    const manifest = this.musicManifest;
    const buffer = this.buffers.get("music:menu");
    if (!MUSIC_ON || this.menu || !context || !manifest?.menu || !buffer || !this.musicBus) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(manifest.menu.gain, context.currentTime + MENU_FADE_IN_S);
    source.connect(gain).connect(this.musicBus);
    source.start();
    this.menu = { source, gain };
  }

  /** Fades the main-menu theme out (leaving the start screen). */
  stopMenu(): void {
    const menu = this.menu;
    const context = this.context;
    this.menu = undefined;
    if (!menu || !context) return;
    menu.gain.gain.cancelScheduledValues(context.currentTime);
    menu.gain.gain.setValueAtTime(menu.gain.gain.value, context.currentTime);
    menu.gain.gain.linearRampToValueAtTime(0, context.currentTime + MENU_FADE_OUT_S);
    menu.source.stop(context.currentTime + MENU_FADE_OUT_S + 0.05);
  }

  /** The sound of the Notstrom Intro (8.9 s from the tap on Start): it plays once and fades out by itself over its last 0.4 s. */
  startNotstromIntroCue(): void {
    const context = this.context;
    const manifest = this.musicManifest;
    const buffer = this.buffers.get("music:notstromIntro");
    if (!MUSIC_ON || this.notstromIntroCue || !context || !manifest?.notstromIntro || !buffer || !this.musicBus) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = manifest.notstromIntro.gain;
    source.connect(gain).connect(this.musicBus);
    source.start();
    this.notstromIntroCue = { source, gain };
    this.scheduleLoopUnderNotstromIntro(context, manifest.intro, this.buffers.get("music:intro"));
  }

  /** The Hero Select loop starts under the end of the sound of the Notstrom Intro, timed on the audio clock (`NOTSTROM_INTRO_SOUND`). */
  private scheduleLoopUnderNotstromIntro(context: AudioContext, track: { gain: number } | undefined, buffer: AudioBuffer | undefined): void {
    if (this.intro || !track || !buffer || !this.musicBus) return;
    const at = context.currentTime + NOTSTROM_INTRO_SOUND.loopStartsAtSeconds;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(track.gain, at + NOTSTROM_INTRO_SOUND.loopFadeInSeconds);
    source.connect(gain).connect(this.musicBus);
    source.start(at);
    this.intro = { source, gain };
    this.introAt = at;
  }

  /** Fades the sound of the Notstrom Intro out (the player skipped the Notstrom Intro). */
  stopNotstromIntroCue(): void {
    const cue = this.notstromIntroCue;
    const context = this.context;
    this.notstromIntroCue = undefined;
    if (!cue || !context) return;
    // A loop that has not begun yet is cancelled: the Hero Select starts its own.
    if (this.intro && this.introAt !== undefined && context.currentTime < this.introAt) {
      this.intro.source.stop();
      this.intro = undefined;
    }
    cue.gain.gain.cancelScheduledValues(context.currentTime);
    cue.gain.gain.setValueAtTime(cue.gain.gain.value, context.currentTime);
    cue.gain.gain.linearRampToValueAtTime(0, context.currentTime + INTRO_FADE_OUT_S);
    try {
      cue.source.stop(context.currentTime + INTRO_FADE_OUT_S + 0.05);
    } catch {
      // It has ended already.
    }
  }

  /** The intro of the Hero Select: it loops until `stopIntro`. The Notstrom Intro starts it early, under its end, with a longer fade. */
  startIntro(fadeInSeconds = INTRO_FADE_IN_S): void {
    // A leaving that comes right before (React in development mounts a screen twice) is taken back: the loop goes on without a break.
    clearTimeout(this.introStopTimer);
    const context = this.context;
    const manifest = this.musicManifest;
    const buffer = this.buffers.get("music:intro");
    if (!MUSIC_ON || this.intro || !context || !manifest?.intro || !buffer || !this.musicBus) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(manifest.intro.gain, context.currentTime + fadeInSeconds);
    source.connect(gain).connect(this.musicBus);
    source.start();
    this.intro = { source, gain };
  }

  /** Fades the intro out quickly, so the opening of the match can come in hard. */
  stopIntro(): void {
    clearTimeout(this.introStopTimer);
    this.introStopTimer = setTimeout(() => this.stopIntroNow(), INTRO_STOP_GRACE_MS);
  }

  private stopIntroNow(): void {
    const intro = this.intro;
    const context = this.context;
    this.intro = undefined;
    if (!intro || !context) return;
    intro.gain.gain.cancelScheduledValues(context.currentTime);
    intro.gain.gain.setValueAtTime(intro.gain.gain.value, context.currentTime);
    intro.gain.gain.linearRampToValueAtTime(0, context.currentTime + INTRO_FADE_OUT_S);
    intro.source.stop(context.currentTime + INTRO_FADE_OUT_S + 0.05);
  }

  /**
   * The music of the end screen: the jingle plays once, and over its last `crossfadeSeconds` a quiet loop takes over and runs
   * until `stopEnding`. A voice line ducks it (`MUSIC_DUCK.endingVoice`).
   */
  startEnding(won: boolean): void {
    const context = this.context;
    const track = this.musicManifest?.ending?.[won ? "victory" : "defeat"];
    const outcome = won ? "victory" : "defeat";
    const jingle = this.buffers.get(`music:ending:${outcome}:jingle`);
    const loop = this.buffers.get(`music:ending:${outcome}:loop`);
    if (!MUSIC_ON || this.ending || !context || !track || !jingle || !loop || !this.musicBus) return;
    const start = context.currentTime + 0.05;
    const fadeSeconds = track.crossfadeSeconds;
    const fadeFrom = start + Math.max(0, jingle.duration - fadeSeconds);
    const jingleSource = context.createBufferSource();
    jingleSource.buffer = jingle;
    const jingleGain = context.createGain();
    jingleGain.gain.setValueAtTime(track.jingle.gain, start);
    shapedRamp(jingleGain.gain, { from: track.jingle.gain, to: 0, start: fadeFrom, seconds: fadeSeconds }, (t) => 1 - Math.cos((t * Math.PI) / 2));
    const loopSource = context.createBufferSource();
    loopSource.buffer = loop;
    loopSource.loop = true;
    const loopGain = context.createGain();
    loopGain.gain.setValueAtTime(0, start);
    shapedRamp(loopGain.gain, { from: 0, to: track.loop.gain, start: fadeFrom, seconds: fadeSeconds }, (t) => Math.sin((t * Math.PI) / 2));
    jingleSource.connect(jingleGain).connect(this.musicBus);
    loopSource.connect(loopGain).connect(this.musicBus);
    jingleSource.start(start);
    loopSource.start(fadeFrom);
    this.ending = { sources: [jingleSource, loopSource], gains: [jingleGain, loopGain] };
  }

  /** Fades the end music out (leaving the end screen). */
  stopEnding(): void {
    const ending = this.ending;
    const context = this.context;
    this.ending = undefined;
    if (!ending || !context) return;
    for (const gain of ending.gains) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + INTRO_FADE_OUT_S);
    }
    for (const source of ending.sources) {
      try {
        source.stop(context.currentTime + INTRO_FADE_OUT_S + 0.05);
      } catch {
        // The loop has not started yet: there is nothing to stop.
      }
    }
  }

  /**
   * Starts the music of a match. The opening (a bridge of six bars) plays first, hard from its first beat; its last two bars fade
   * out along a cosine; the layers start four bars before its end, whole bars early so their bar lines stay on the bar lines of the opening. Then the layers loop in
   * sync, at the gains of the level that is wanted now. Without an opening the layers start at once.
   */
  startMusic(): void {
    const context = this.context;
    const manifest = this.musicManifest;
    if (!MUSIC_ON || this.music || !context || !manifest || !this.musicBus) return;
    const now = context.currentTime + 0.1;
    const barSeconds = (60 / manifest.bpm) * 4;
    const opening = this.startOpening(context, manifest, now, barSeconds);
    const layersFadeInSeconds = barSeconds * LAYERS_FADE_IN_BARS;
    const timing = {
      now,
      startedAt: opening ? opening.layersStart : now,
      fadeInSeconds: opening ? layersFadeInSeconds : MUSIC_FADE_OUT_S,
    };
    const layers = this.startLayers(context, manifest, timing, opening?.gain);
    const sources = [...(opening ? [opening.source] : []), ...layers.sources];
    if (sources.length > 0) {
      this.music = { startedAt: timing.startedAt, fadeInSeconds: timing.fadeInSeconds, loopSeconds: layers.loopSeconds, layers: layers.gains, opening: opening?.gain, sources };
    }
  }

  /** The opening of the match music, if the manifest has one and it is loaded: it plays hard from its first beat and fades out along a cosine. `layersStart` is when the layers come in. */
  private startOpening(context: AudioContext, manifest: MusicManifest, now: number, barSeconds: number): { gain: GainNode; source: AudioBufferSourceNode; layersStart: number } | undefined {
    const buffer = manifest.opening ? this.buffers.get("music:opening") : undefined;
    if (!manifest.opening || !buffer || !this.musicBus) return undefined;
    const fadeSeconds = barSeconds * OPENING_FADE_BARS;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const fadeFrom = now + Math.max(0, buffer.duration - fadeSeconds);
    gain.gain.setValueAtTime(manifest.opening.gain, now);
    shapedRamp(gain.gain, { from: manifest.opening.gain, to: 0, start: fadeFrom, seconds: fadeSeconds }, (t) => 1 - Math.cos((t * Math.PI) / 2));
    source.connect(gain).connect(this.musicBus);
    source.start(now);
    return { gain, source, layersStart: now + Math.max(0, buffer.duration - barSeconds * LAYERS_FADE_IN_BARS) };
  }

  /** The looping layers, all started on the same bar line at the gains of the level that is wanted now; they fade in under the opening, or from silence without one. */
  private startLayers(
    context: AudioContext,
    manifest: MusicManifest,
    { now, startedAt, fadeInSeconds }: { now: number; startedAt: number; fadeInSeconds: number },
    opening: GainNode | undefined,
  ): { gains: Record<string, GainNode>; sources: AudioBufferSourceNode[]; loopSeconds: number } {
    const gains: Record<string, GainNode> = {};
    const sources: AudioBufferSourceNode[] = [];
    let loopSeconds = 0;
    for (const layer of Object.keys(manifest.layers)) {
      const buffer = this.buffers.get(`music:${layer}`);
      if (!buffer || !this.musicBus) continue;
      loopSeconds = buffer.duration;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      const target = manifest.levels[this.musicLevel]?.gains[layer] ?? 0;
      if (opening) shapedRamp(gain.gain, { from: 0, to: target, start: startedAt, seconds: fadeInSeconds }, (t) => t ** 2);
      else {
        gain.gain.setValueAtTime(0, startedAt);
        gain.gain.linearRampToValueAtTime(target, startedAt + fadeInSeconds);
      }
      source.connect(gain).connect(this.musicBus);
      source.start(startedAt);
      gains[layer] = gain;
      sources.push(source);
    }
    return { gains, sources, loopSeconds };
  }

  /**
   * The level the game wants. The layers fade to its gains starting on the next bar line, so a change lands on the beat; `now` starts it
   * at once (see `levelChangeAt`).
   * Before the music runs, the level is only remembered.
   */
  setMusicLevel(level: MusicLevel, at: "now" | "bar" = "bar"): void {
    this.musicLevel = level;
    const context = this.context;
    const manifest = this.musicManifest;
    const music = this.music;
    if (!context || !manifest || !music) return;
    const gains = manifest.levels[level]?.gains ?? {};
    if (context.currentTime < music.startedAt + music.fadeInSeconds) {
      // The layers are still fading in under the opening: they fade in to the new level instead.
      for (const [layer, gain] of Object.entries(music.layers)) {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
        gain.gain.linearRampToValueAtTime(gains[layer] ?? 0, music.startedAt + music.fadeInSeconds);
      }
      return;
    }
    const from = at === "now" ? context.currentTime : nextBarTime(context.currentTime, music.startedAt, music.loopSeconds, manifest.bars);
    for (const [layer, gain] of Object.entries(music.layers)) {
      const target = gains[layer] ?? 0;
      const quietening = target < gain.gain.value;
      const nowConstant = quietening ? MUSIC_NOW_OUT_TIME_CONSTANT_S : MUSIC_NOW_IN_TIME_CONSTANT_S;
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(target, from, at === "now" ? nowConstant : MUSIC_FADE_TIME_CONSTANT_S);
    }
  }

  /** Fades the music out (the end of the match, leaving the screen). */
  stopMusic(): void {
    const music = this.music;
    const context = this.context;
    this.music = undefined;
    if (!music || !context) return;
    for (const gain of [...Object.values(music.layers), ...(music.opening ? [music.opening] : [])]) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + MUSIC_FADE_OUT_S);
    }
    for (const source of music.sources) source.stop(context.currentTime + MUSIC_FADE_OUT_S + 0.05);
  }

  /** Fades the ambience out (the end of the match, leaving the screen). */
  stopAmbience(): void {
    const ambience = this.ambience;
    const context = this.context;
    this.ambience = undefined;
    if (!ambience || !context) return;
    clearTimeout(ambience.timer);
    this.fadeOutBarrier();
    const drone = this.scoutDrone;
    this.scoutDrone = undefined;
    this.fadeOutLoop(drone);
    for (const { source, gain } of ambience.loops) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + AMBIENCE_FADE_S / 2);
      source.stop(context.currentTime + AMBIENCE_FADE_S / 2 + 0.05);
    }
  }

  /** A sound of the player's own action or of a moment of the match: a card goes in, a zone is taken, a number counts down. */
  /** A detail of the hangar of the Hero Select that sounds (a spark at a fuse box): at the level the map manifest gives it, never the same variant twice in a row. */
  playHangarSound(sound: HangarSound): void {
    const entry = this.mapManifest?.ambience.hangar[sound];
    const context = this.context;
    if (!entry || !context || context.state === "closed" || !this.sfxBus) return;
    const id = pickVariant(entry.play, this.lastPick.get(`hangar:${sound}`), Math.random);
    const buffer = id === undefined ? undefined : this.buffers.get(`${MAP_FOLDER}:${id}`);
    if (id === undefined || !buffer) return;
    this.lastPick.set(`hangar:${sound}`, id);
    this.startBuffer(context, buffer, this.sfxBus, { level: entry.gain });
  }

  playUi(name: UiSound, delayMs = 0): void {
    const manifest = this.mapManifest;
    const context = this.context;
    if (!manifest || !context || context.state === "closed" || !this.sfxBus) return;
    const id = pickVariant(manifest.ui[name].play, this.lastPick.get(name), Math.random);
    const buffer = id === undefined ? undefined : this.buffers.get(`${MAP_FOLDER}:${id}`);
    if (id === undefined || !buffer) return;
    this.lastPick.set(name, id);
    this.startBuffer(context, buffer, this.sfxBus, { delayS: delayMs / 1000 });
  }

  /** The two riffles of the shuffle animation. */
  playShuffle(): void {
    const manifest = this.mapManifest;
    const context = this.context;
    const buffer = manifest && this.buffers.get(`${MAP_FOLDER}:${manifest.ui.shuffle.play[0]}`);
    if (!manifest || !context || !buffer || !this.sfxBus) return;
    for (const atMs of manifest.ui.shuffle.atMs) this.startBuffer(context, buffer, this.sfxBus, { delayS: atMs / 1000 });
  }

  /** A node that fades a one-shot in and out at its edges; `source` is connected to the returned node. */
  private declick(context: AudioContext, source: AudioBufferSourceNode, startS: number, durationS: number): GainNode {
    const envelope = context.createGain();
    const fadeOut = Math.min(DECLICK_OUT_S, durationS / 2);
    envelope.gain.setValueAtTime(0, startS);
    envelope.gain.linearRampToValueAtTime(1, startS + DECLICK_IN_S);
    envelope.gain.setValueAtTime(1, startS + durationS - fadeOut);
    envelope.gain.linearRampToValueAtTime(0, startS + durationS);
    source.connect(envelope);
    return envelope;
  }

  private startBuffer(context: AudioContext, buffer: AudioBuffer, bus: GainNode, { level = 1, delayS = 0, panner }: { level?: number; delayS?: number; panner?: StereoPannerNode } = {}): void {
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = level;
    const startS = context.currentTime + delayS;
    this.declick(context, source, startS, buffer.duration).connect(gain);
    if (panner) {
      panner.pan.value = Math.random() * 1.2 - 0.6;
      gain.connect(panner).connect(bus);
    } else gain.connect(bus);
    source.start(startS);
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
        ? this.director.request({ heroId: request.heroId, startMs, durationMs, priority: request.priority })
        : this.limiter.request({ assetId: `${request.heroClass}:${request.assetId}`, startMs, durationMs, priority: request.priority });
    if (!decision.play || decision.id === undefined) return;
    for (const id of decision.cut) this.fadeOut(`${request.kind}${id}`, startMs / 1000);

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = (listener && request.tile ? distanceGain(listener, request.tile) : 1) * (isStep(request.assetId) ? STEP_GAIN : 1);
    const playAt = Math.max(context.currentTime, startMs / 1000);
    this.declick(context, source, playAt, buffer.duration).connect(gain);
    gain.connect(bus);
    this.duckMusicFor(request, startMs / 1000, durationMs / 1000);
    const key = `${request.kind}${decision.id}`;
    this.playing.set(key, { source, gain });
    source.onended = () => this.playing.delete(key);
    source.start(playAt);
  }

  /** The music steps back while a voice speaks or a heavy effect hits, and comes back slowly. */
  private duckMusicFor(request: SoundRequest, startS: number, durationS: number): void {
    const gain = this.duckNode?.gain;
    if (!gain) return;
    const heavySfx = request.kind === "sfx" && request.priority >= MUSIC_DUCK.minSfxPriority;
    if (request.kind === "sfx" && !heavySfx) return;
    const voiceDuck = this.ending ? MUSIC_DUCK.endingVoice : MUSIC_DUCK.voice;
    const duck = heavySfx ? MUSIC_DUCK.sfx : voiceDuck;
    const from = Math.max(startS, this.context?.currentTime ?? 0);
    const until = from + Math.min(durationS, duck.maxS);
    if (until <= this.duckedUntilS) return;
    if (from < this.duckedUntilS) gain.cancelScheduledValues(this.duckedUntilS);
    else gain.setTargetAtTime(duck.gain, from, MUSIC_DUCK.attackS);
    gain.setTargetAtTime(1, until, "releaseS" in duck ? duck.releaseS : MUSIC_DUCK.releaseS);
    this.duckedUntilS = until;
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
    this.setSelectDrone(false);
  }

  /** A moment of the game that is not a frame of the Resolution: the Hero Select, a Pitch, the end of the match. */
  playMoment(on: "heroSelected" | "hangarClip" | "cardPitched" | "matchEnd", who: Source, won?: boolean, clip?: string): void {
    const ctx = this.contextFor({ classOf: () => who.heroClass, isOwn: () => true, isHeard: () => true, tileOf: () => who.tile });
    this.play(planMoment(on, who, ctx, won, clip), who.tile);
  }
}

export const gameAudio = new GameAudio();
