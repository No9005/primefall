import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "./audio";
import type { MapManifest } from "./audio-manifest";

// The hum of the player's own Scout Drone runs while the Squad has a Site Survey area out. These tests play it through a fake Web Audio
// context that records the sources it is asked to start and stop.

const MAP_MANIFEST = JSON.parse(readFileSync(path.resolve(__dirname, "../public/assets/audio/map/manifest.json"), "utf8")) as MapManifest;

interface FakeSource {
  buffer: unknown;
  loop: boolean;
  started: boolean;
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  connect: (node: unknown) => unknown;
  start: (when?: number) => void;
  stop: (when: number) => void;
}

function fakeContext() {
  const sources: FakeSource[] = [];
  const node = (extra: object = {}) => {
    const self: Record<string, unknown> = {
      connect: (next: unknown) => next,
      gain: { value: 1, setValueAtTime: () => undefined, linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: () => undefined },
      ...extra,
    };
    return self;
  };
  const context = {
    currentTime: 10,
    state: "running",
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => node(),
    createDynamicsCompressor: () => node({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }),
    createBufferSource: () => {
      const source: FakeSource = { buffer: undefined, loop: false, started: false, startedAt: undefined, stoppedAt: undefined, connect: (next) => next, start: (when) => void ((source.started = true), (source.startedAt = when)), stop: (when) => void (source.stoppedAt = when) };
      sources.push(source);
      return source;
    },
    decodeAudioData: () => Promise.resolve({ duration: 1 }),
  };
  return { context, sources };
}

const dronesIn = (audio: GameAudio, sources: FakeSource[]) => {
  const buffer = (audio as unknown as { buffers: Map<string, unknown> }).buffers.get(`map:${MAP_MANIFEST.ambience.scoutDrone.loop}`);
  return sources.filter((source) => source.buffer === buffer);
};

describe("the hum of the Scout Drone", () => {
  let fake: ReturnType<typeof fakeContext>;
  let audio: GameAudio;

  beforeEach(async () => {
    fake = fakeContext();
    vi.stubGlobal("AudioContext", class {});
    vi.stubGlobal("fetch", (url: string) => Promise.resolve({ json: () => Promise.resolve(MAP_MANIFEST), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)), url }));
    audio = new GameAudio(() => fake.context as unknown as AudioContext);
    await audio.loadMap();
    // Every decoded asset is a different object so that the sources can be told apart by their buffer.
    const buffers = (audio as unknown as { buffers: Map<string, unknown> }).buffers;
    for (const key of buffers.keys()) buffers.set(key, { key });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts when the Squad has an area out, as a loop, and fades out and stops when the last area is gone", () => {
    audio.startAmbience();
    expect(dronesIn(audio, fake.sources)).toHaveLength(0);
    audio.setScoutDrones([{ col: 8, row: 8 }]);
    const [drone] = dronesIn(audio, fake.sources);
    expect(drone?.loop).toBe(true);
    expect(drone?.started).toBe(true);
    // A second area, or the same one again, does not start a second hum.
    audio.setScoutDrones([{ col: 8, row: 8 }, { col: 3, row: 3 }]);
    expect(dronesIn(audio, fake.sources)).toHaveLength(1);
    audio.setScoutDrones([]);
    expect(drone?.stoppedAt).toBeGreaterThan(fake.context.currentTime);
    // A new area later hums again.
    audio.setScoutDrones([{ col: 2, row: 2 }]);
    expect(dronesIn(audio, fake.sources)).toHaveLength(2);
  });

  it("waits for the ambience when the area is there first, and stops with it", () => {
    audio.setScoutDrones([{ col: 8, row: 8 }]);
    expect(dronesIn(audio, fake.sources)).toHaveLength(0);
    audio.startAmbience();
    const [drone] = dronesIn(audio, fake.sources);
    expect(drone?.started).toBe(true);
    audio.stopAmbience();
    expect(drone?.stoppedAt).toBeGreaterThan(fake.context.currentTime);
  });

  it("hums in the Hero Select from a moment after Tilly is chosen until another Hero is chosen, the choice is taken back or the screen goes", () => {
    audio.setSelectDrone(true);
    const [hum] = dronesIn(audio, fake.sources);
    expect(hum?.loop).toBe(true);
    expect(hum?.startedAt).toBeGreaterThan(fake.context.currentTime);
    audio.setSelectDrone(true);
    expect(dronesIn(audio, fake.sources)).toHaveLength(1);
    audio.setSelectDrone(false);
    expect(hum?.stoppedAt).toBeGreaterThan(fake.context.currentTime);
    audio.setSelectDrone(true);
    const [, second] = dronesIn(audio, fake.sources);
    audio.stopAll();
    expect(second?.stoppedAt).toBeGreaterThan(fake.context.currentTime);
  });

  it("plays a spark of the hangar at the level of the map manifest", () => {
    audio.playHangarSound("spark");
    const buffer = (audio as unknown as { buffers: Map<string, unknown> }).buffers.get(`map:${MAP_MANIFEST.ambience.hangar.spark!.play[0]}`);
    const [spark] = fake.sources.filter((source) => source.buffer === buffer);
    expect(spark?.started).toBe(true);
    audio.playHangarSound("flicker");
    expect(fake.sources).toHaveLength(2);
  });

  it("leaves out the loops it is told to when the ambience starts (the hangar has no plasma core)", () => {
    audio.startAmbience(0.5, ["loop.core"]);
    const buffers = (audio as unknown as { buffers: Map<string, unknown> }).buffers;
    const played = fake.sources.map((source) => source.buffer);
    expect(played).toContain(buffers.get("map:loop.bed"));
    expect(played).not.toContain(buffers.get("map:loop.core"));
    expect(fake.sources.filter((source) => source.loop)).toHaveLength(1);
  });

  it("leaves out the quiet sounds it is told to as well (the hangar has its own sparks)", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // the third of the quiet sounds is the spark; every gap is the middle of its range
    const firstQuietSound = (without: string[]) => {
      fake.sources.length = 0;
      (audio as unknown as { lastPick: Map<string, string> }).lastPick.clear(); // the same sound is not picked twice in a row, also not across two starts
      audio.startAmbience(1, without);
      vi.advanceTimersByTime(25_000);
      audio.stopAmbience();
      return fake.sources.find((source) => !source.loop)?.buffer;
    };
    const spark = (audio as unknown as { buffers: Map<string, unknown> }).buffers.get("map:sfx.spark");
    try {
      expect(firstQuietSound([])).toBe(spark);
      expect(firstQuietSound(["sfx.spark"])).not.toBe(spark);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
