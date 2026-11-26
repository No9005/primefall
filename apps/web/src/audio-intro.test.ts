import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "./audio";
import type { MusicManifest } from "./audio-manifest";

// The sounds that follow the pictures of the Notstrom Intro start from the film's own clock. These tests drive them through a fake Web Audio context.

const MUSIC = JSON.parse(readFileSync(path.resolve(__dirname, "../public/assets/audio/music/manifest.json"), "utf8")) as MusicManifest;

interface FakeSource {
  buffer: unknown;
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  onended?: () => void;
  connect: (node: unknown) => unknown;
  start: (when?: number) => void;
  stop: (when: number) => void;
}

function fakeContext() {
  const sources: FakeSource[] = [];
  const ramps: [number, number][] = [];
  const node = (extra: object = {}) => ({
    connect: (next: unknown) => next,
    gain: { value: 1, setValueAtTime: () => undefined, linearRampToValueAtTime: (value: number, at: number) => void ramps.push([value, at]), setTargetAtTime: () => undefined, cancelScheduledValues: () => undefined },
    ...extra,
  });
  const context = {
    currentTime: 10,
    state: "running",
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => node(),
    createDynamicsCompressor: () => node({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }),
    createBufferSource: () => {
      const source: FakeSource = { buffer: undefined, startedAt: undefined, stoppedAt: undefined, connect: (next) => next, start: (when) => void (source.startedAt = when ?? 0), stop: (when) => void (source.stoppedAt = when) };
      sources.push(source);
      return source;
    },
    decodeAudioData: () => Promise.resolve({ duration: 1 }),
  };
  return { context, sources, ramps };
}

describe("the sounds that follow the Notstrom Intro film", () => {
  let fake: ReturnType<typeof fakeContext>;
  let audio: GameAudio;
  let effectSources: () => FakeSource[];

  beforeEach(async () => {
    fake = fakeContext();
    vi.stubGlobal("AudioContext", class {});
    vi.stubGlobal("fetch", () => Promise.resolve({ json: () => Promise.resolve(MUSIC), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
    audio = new GameAudio(() => fake.context as unknown as AudioContext);
    await audio.loadMusic();
    const buffers = (audio as unknown as { buffers: Map<string, unknown> }).buffers;
    for (const key of buffers.keys()) buffers.set(key, { key });
    audio.startNotstromIntroCue();
    effectSources = () => fake.sources.filter((source) => String((source.buffer as { key?: string } | undefined)?.key).startsWith("music:notstromIntro:effect"));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts each effect once, when the film's clock reaches it, and none before", () => {
    audio.followNotstromIntro(0);
    expect(effectSources()).toHaveLength(0);
    audio.followNotstromIntro(300);
    expect(effectSources()).toHaveLength(1);
    audio.followNotstromIntro(310);
    expect(effectSources()).toHaveLength(1);
    // A film that starts late, or a tick that skips a stretch, still plays what was passed.
    audio.followNotstromIntro(6000);
    expect(effectSources()).toHaveLength(2);
    audio.followNotstromIntro(7000);
    expect(effectSources()).toHaveLength(2);
  });

  it("opens the sound of the intro louder and lets it sink to its level", () => {
    const { gain, settle } = MUSIC.notstromIntro ?? { gain: 1 };
    expect(settle?.startGain).toBeGreaterThan(gain);
    expect(fake.ramps).toContainEqual([gain, fake.context.currentTime + (settle?.seconds ?? 0)]);
  });

  it("plays the sound of the intro again on the next tap on Start once it has played out", () => {
    const cues = () => fake.sources.filter((source) => (source.buffer as { key?: string } | undefined)?.key === "music:notstromIntro");
    expect(cues()).toHaveLength(1);
    // Still playing: a second start does nothing.
    audio.startNotstromIntroCue();
    expect(cues()).toHaveLength(1);
    // It played to its end (the intro was not skipped), the player came back to the start screen and taps Start again.
    cues()[0]?.onended?.();
    audio.startNotstromIntroCue();
    expect(cues()).toHaveLength(2);
    audio.followNotstromIntro(300);
    expect(effectSources()).toHaveLength(1);
  });

  it("fades the running effects out with the sound when the film is skipped, and plays no more", () => {
    audio.followNotstromIntro(300);
    const [ship] = effectSources();
    audio.stopNotstromIntroCue();
    expect(ship?.stoppedAt).toBeGreaterThan(fake.context.currentTime);
    audio.followNotstromIntro(3000);
    expect(effectSources()).toHaveLength(1);
  });
});
