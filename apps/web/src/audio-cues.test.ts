import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { type AudioManifest, type MapManifest } from "./audio-manifest";
import { planFrame, planMoment, type PlanContext, type SoundRequest } from "./audio-cues";
import { Priority } from "./audio-mix";
import { SHUFFLE_TIMELINE } from "./deck-shuffle";
import { buildPlaybackFrames } from "./playback";

const AUDIO_DIR = path.resolve(__dirname, "../public/assets/audio");
const FOLDERS: Record<HeroClass, string> = { [HeroClass.Bruiser]: "max", [HeroClass.Controller]: "tilly", [HeroClass.Assassin]: "kit" };
const manifests = new Map(Object.values(HeroClass).map((heroClass) => [heroClass, JSON.parse(readFileSync(path.join(AUDIO_DIR, FOLDERS[heroClass], "manifest.json"), "utf8")) as AudioManifest]));

const CLASSES: Record<string, HeroClass> = { max: HeroClass.Bruiser, tilly: HeroClass.Controller, kit: HeroClass.Assassin, enemyKit: HeroClass.Assassin };
const TILES: Record<string, { col: number; row: number }> = { max: { col: 2, row: 2 }, tilly: { col: 3, row: 2 }, kit: { col: 8, row: 2 }, enemyKit: { col: 8, row: 3 } };

function context(patch: Partial<PlanContext> = {}): PlanContext {
  return {
    manifestOf: (heroClass) => manifests.get(heroClass),
    classOf: (heroId) => CLASSES[heroId],
    isOwn: (heroId) => heroId === "max" || heroId === "tilly",
    isHeard: () => true,
    tileOf: (heroId) => TILES[heroId],
    random: () => 0,
    lastPick: new Map(),
    ...patch,
  };
}

const frameOf = (events: MatchEvent[]) => buildPlaybackFrames(events, (heroId) => CLASSES[heroId])[0]!;
const hit = (heroId: string, targetId: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({ kind: EventKind.AttackHit, tick: 1, heroId, targetId, damage: 1, absorbed: 0, ...extra });
const assets = (requests: SoundRequest[], kind: "voice" | "sfx", heroId?: string) => requests.filter((request) => request.kind === kind && (heroId === undefined || request.heroId === heroId)).map((request) => request.assetId);

describe("the manifests", () => {
  for (const [heroClass, manifest] of manifests) {
    it(`${manifest.name}: every sound a cue plays is an asset, and every asset file exists`, () => {
      for (const cue of manifest.cues) {
        for (const play of [cue.voice, cue.voiceLater, ...(cue.sfx ?? [])]) {
          for (const id of play?.play ?? []) expect(manifest.assets[id], `${cue.on} ${cue.card ?? ""}: ${id}`).toBeDefined();
        }
      }
      for (const [id, asset] of Object.entries(manifest.assets)) {
        expect(existsSync(path.join(AUDIO_DIR, FOLDERS[heroClass], asset.file)), id).toBe(true);
      }
    });
  }
});

describe("the map manifest", () => {
  const map = JSON.parse(readFileSync(path.join(AUDIO_DIR, "map", "manifest.json"), "utf8")) as MapManifest;

  it("names only assets it has, and every asset file exists", () => {
    const names = [...map.ambience.loops.map((loop) => loop.play), ...map.ambience.oneShots.play, ...Object.values(map.ui).flatMap((ui) => ui.play)];
    for (const name of names) expect(map.assets[name], name).toBeDefined();
    for (const [name, asset] of Object.entries(map.assets)) expect(existsSync(path.join(AUDIO_DIR, "map", asset.file)), name).toBe(true);
  });

  it("has the laser barrier: a hum in WAV and the sound of its dissolving", () => {
    expect(map.assets[map.ambience.barrier.loop]!.file).toMatch(/\.wav$/);
    expect(map.assets[map.ambience.barrier.dissolve]).toBeDefined();
    expect(map.ui.laserOff.play).toContain(map.ambience.barrier.dissolve);
  });

  it("has the hum of the Scout Drone as a loop in WAV and no whining one-shot of it any more", () => {
    const drone = map.assets[map.ambience.scoutDrone.loop]!;
    expect(drone.file).toMatch(/\.wav$/);
    expect(drone.durationMs).toBeGreaterThan(5000);
    const tilly = manifests.get(HeroClass.Controller)!;
    expect(tilly.assets["sfx.scout-drone"]).toBeUndefined();
    for (const cue of tilly.cues) for (const sfx of cue.sfx ?? []) expect(sfx.play, `${cue.on}`).not.toContain("sfx.scout-drone");
  });

  it("has the spark of the fuse boxes of the hangar, which the scene plays", () => {
    const spark = map.ambience.hangar.spark!;
    expect(spark.gain).toBeGreaterThan(0);
    for (const id of spark.play) expect(map.assets[id], id).toBeDefined();
  });

  it("keeps the loops in WAV (an MP3 leaves a gap at the seam) and puts a riffle on each beat of the shuffle animation", () => {
    for (const loop of map.ambience.loops) expect(map.assets[loop.play]!.file).toMatch(/\.wav$/);
    expect(map.ui.shuffle.atMs).toEqual(SHUFFLE_TIMELINE.riffles.map((riffle) => riffle.split));
  });
});

describe("the sounds of a frame", () => {
  it("plays the card line, the shot and the impact for the attacker, and the cry and the hit for the target", () => {
    const requests = planFrame(frameOf([hit("kit", "max", { card: "Long Shot", damage: 2, distance: 6 })]), context());
    expect(assets(requests, "voice", "kit")).toHaveLength(1);
    expect(assets(requests, "sfx", "kit")).toEqual(["sfx.lightning", "sfx.impact-body"]);
    expect(assets(requests, "voice", "max")).toHaveLength(1);
    expect(assets(requests, "sfx", "max")).toEqual(["sfx.steel-tear-1", "sfx.hit-flesh"]);
  });

  it("puts the impact of a shot on the tile of its target, a moment after the shot left", () => {
    const requests = planFrame(frameOf([hit("tilly", "enemyKit", { card: "Price Tag", damage: 1, distance: 5 })]), context());
    const shot = requests.find((request) => request.assetId === "sfx.tag-fire")!;
    const impact = requests.find((request) => request.assetId === "sfx.tag-hit")!;
    expect(impact.tile).toEqual(TILES.enemyKit);
    expect(impact.startMs).toBeGreaterThan(shot.startMs);
  });

  it("tells a light hit from a heavy one and from a Shield that took it", () => {
    const light = planFrame(frameOf([hit("kit", "max", { damage: 1 })]), context());
    expect(assets(light, "sfx", "max")).toEqual(["sfx.ricochet-1"]);
    const absorbed = planFrame(frameOf([hit("kit", "max", { damage: 0, absorbed: 2 })]), context());
    expect(assets(absorbed, "sfx", "max")).toEqual(["sfx.ricochet-1", "sfx.shield-hit"]);
  });

  it("makes a Hero's sounds more important for its own Squad", () => {
    const own = planFrame(frameOf([hit("max", "kit")]), context()).find((request) => request.heroId === "max" && request.kind === "voice")!;
    const enemy = planFrame(frameOf([hit("kit", "max")]), context()).find((request) => request.heroId === "kit" && request.kind === "voice")!;
    expect(own.priority).toBeGreaterThan(enemy.priority - 1);
    const sameCue = planFrame(frameOf([hit("max", "enemyKit")]), context()).find((request) => request.heroId === "max" && request.kind === "voice")!;
    expect(sameCue.priority).toBe(Priority.Normal + 1);
  });

  it("plays nothing for a Hero the Squad does not see (Fog of War)", () => {
    const requests = planFrame(frameOf([hit("enemyKit", "max", { damage: 2 })]), context({ isHeard: (heroId) => heroId !== "enemyKit" }));
    expect(assets(requests, "voice", "enemyKit")).toEqual([]);
    expect(assets(requests, "sfx", "enemyKit")).toEqual([]);
    expect(assets(requests, "voice", "max")).toHaveLength(1);
  });

  it("gives a step its sound once per frame, at the foot-down moment of the walk", () => {
    const requests = planFrame(frameOf([{ kind: EventKind.Step, tick: 1, heroId: "max", from: { col: 1, row: 1 }, to: { col: 2, row: 1 } }]), context());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ kind: "sfx", priority: Priority.Ambient + 1 });
    expect(requests[0]!.startMs).toBeGreaterThan(250);
    expect(requests[0]!.startMs).toBeLessThan(450);
  });

  it("plays an Exhausted Hero's line, the collapse and the last words", () => {
    const requests = planFrame(frameOf([{ kind: EventKind.Exhausted, tick: 1, heroId: "max" }]), context());
    expect(assets(requests, "voice", "max")).toEqual(["voice.exhausted-1", "voice.exhausted-2"]);
    expect(assets(requests, "sfx", "max")).toEqual(["sfx.exhausted-collapse"]);
    expect(requests.find((request) => request.assetId === "voice.exhausted-2")!.startMs).toBeGreaterThan(2000);
  });

  it("starts the last words of an Exhausted Hero only after its first line has ended", () => {
    for (const [heroId, heroClass] of [["max", HeroClass.Bruiser], ["tilly", HeroClass.Controller], ["kit", HeroClass.Assassin]] as const) {
      const requests = planFrame(frameOf([{ kind: EventKind.Exhausted, tick: 1, heroId }]), context());
      const [first, last] = requests.filter((request) => request.kind === "voice");
      const firstEnd = first!.startMs + manifests.get(heroClass)!.assets[first!.assetId]!.durationMs;
      expect(last!.startMs, heroId).toBeGreaterThanOrEqual(firstEnd);
    }
  });

  it("starts every sound with the frame when the clips do not play (reduced motion)", () => {
    const requests = planFrame(frameOf([hit("kit", "max", { card: "Long Shot", damage: 2, distance: 6 })]), context({ immediate: true }));
    expect(requests.every((request) => request.startMs === 0)).toBe(true);
  });

  it("does not repeat a variant in a row for the same Hero and cue", () => {
    const shared = context({ random: () => 0 });
    const first = assets(planFrame(frameOf([hit("kit", "max", { card: "Long Shot", damage: 2, distance: 6 })]), shared), "voice", "kit");
    const second = assets(planFrame(frameOf([hit("kit", "max", { card: "Long Shot", damage: 2, distance: 6 })]), shared), "voice", "kit");
    expect(second).not.toEqual(first);
  });

  it("gives Max his line and his sounds with the clip that has them, so that the line does not run over the cry of the throw", () => {
    const max = { heroId: "select-max", heroClass: HeroClass.Bruiser, tile: undefined };
    expect(planMoment("heroSelected", max, context())).toEqual([]);
    const at = (clip: string) => planMoment("hangarClip", max, context(), undefined, clip).map((request) => [request.assetId, request.startMs]).sort();
    expect(at("selecti")).toEqual([["sfx.slam", 1080], ["voice.select", 0]]);
    // The throw: the cry first, the locker at the flash, the barbell on the floor, the shot, and the line only after the cry.
    expect(at("select")).toEqual([["sfx.act-throw", 0], ["sfx.barbell-floor", 650], ["sfx.barbell-locker", 260], ["sfx.slam", 1630], ["voice.select", 1000]]);
    // The lift: the grunts begin in the clip before it, the barbell lands at its end.
    expect(at("tolift")).toEqual([["sfx.act-lift", 420]]);
    expect(at("act")).toEqual([["sfx.barbell-floor", 1400]]);
    expect(at("idle")).toEqual([]);
    const cry = planMoment("hangarClip", max, context(), undefined, "select").find((request) => request.assetId === "sfx.act-throw")!;
    const line = planMoment("hangarClip", max, context(), undefined, "select").find((request) => request.assetId === "voice.select")!;
    expect(line.startMs).toBeGreaterThanOrEqual(cry.startMs + (JSON.parse(readFileSync(path.join(AUDIO_DIR, "max", "manifest.json"), "utf8")) as AudioManifest).assets["sfx.act-throw"]!.durationMs);
  });

  it("gives Tilly's act clip fiddling, the crack of the arm and her gasp at the moments of the clip, and the other Heroes' act none", () => {
    const tilly = { heroId: "select-tilly", heroClass: HeroClass.Controller, tile: undefined };
    const act = planMoment("hangarClip", tilly, context(), undefined, "act");
    expect(act.map((request) => [request.assetId, request.startMs]).sort()).toEqual([["sfx.act-fiddle", 300], ["sfx.act-tear", 1100], ["voice.act-gasp", 1200]]);
    expect(planMoment("hangarClip", tilly, context(), undefined, "idle")).toEqual([]);
    const kit = { heroId: "select-kit", heroClass: HeroClass.Assassin, tile: undefined };
    expect(planMoment("hangarClip", kit, context({ random: () => 0 }), undefined, "act").map((request) => [request.assetId, request.startMs])).toEqual([["voice.act-nice", 1900]]);
    expect(planMoment("hangarClip", kit, context({ random: () => 0.95 }), undefined, "act")).toEqual([]);
  });

  it("says something on a Pitch only some of the time, never on every one", () => {
    const pitch = (random: number) => planMoment("cardPitched", { heroId: "kit", heroClass: HeroClass.Assassin, tile: TILES.kit }, context({ random: () => random }));
    expect(pitch(0.1)).toHaveLength(1);
    expect(pitch(0.95)).toHaveLength(0);
  });

  it("uses the line of the end of the match that fits the result", () => {
    const won = planMoment("matchEnd", { heroId: "kit", heroClass: HeroClass.Assassin, tile: TILES.kit }, context(), true);
    const lost = planMoment("matchEnd", { heroId: "kit", heroClass: HeroClass.Assassin, tile: TILES.kit }, context(), false);
    expect(assets(won, "voice")[0]).toMatch(/victory/);
    expect(assets(lost, "voice")[0]).toMatch(/defeat/);
  });
});
