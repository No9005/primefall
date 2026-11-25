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
  stoppedAt: number | undefined;
  connect: (node: unknown) => unknown;
  start: () => void;
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
      const source: FakeSource = { buffer: undefined, loop: false, started: false, stoppedAt: undefined, connect: (next) => next, start: () => void (source.started = true), stop: (when) => void (source.stoppedAt = when) };
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
});
