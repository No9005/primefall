import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import { effectCuesOf, SCRAP_LABEL_MS, SCRAP_PULL_MS } from "./weapon-effects";

const fireOf = () => 820;
const at = (col: number, row: number) => ({ col, row });
const classOf = (id: string) => (id === "tilly" ? HeroClass.Controller : HeroClass.Bruiser);

const blast: MatchEvent[] = [
  { kind: EventKind.AreaBlasted, tick: 1, heroId: "tilly", to: at(6, 3), amount: 3, card: "Urban Renewal" },
  { kind: EventKind.AttackHit, tick: 1, heroId: "tilly", targetId: "enemy", absorbed: 0, damage: 2, crossfire: 0, card: "Urban Renewal", tile: at(6, 3) },
  { kind: EventKind.AttackHit, tick: 1, heroId: "tilly", targetId: "ally", absorbed: 0, damage: 2, crossfire: 0, card: "Urban Renewal", tile: at(6, 3) },
  { kind: EventKind.CoverDestroyed, tick: 1, heroId: "tilly", to: at(5, 3), card: "Urban Renewal" },
  { kind: EventKind.ScrapGained, tick: 1, heroId: "tilly", to: at(6, 3) },
];

describe("Urban Renewal in the playback", () => {
  it("shows the blast, both hits and the destroyed Cover in one frame, and the Scrap gain in the next", () => {
    const frames = buildPlaybackFrames(blast, classOf);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.hits.map((hit) => hit.targetId)).toEqual(["enemy", "ally"]);
    expect(frames[0]!.clips).toMatchObject({ tilly: "demolish" });
    expect(frames[0]!.coverEdits).toHaveLength(1);
    expect(frames[1]!.clips).toEqual({ tilly: "scrapGain" });
  });

  it("makes one blast cue of the whole area, wherever it lands", () => {
    const cues = effectCuesOf(blast.slice(0, 3), fireOf);
    expect(cues.filter((cue) => cue.kind === "breach")).toEqual([{ kind: "breach", casterId: "tilly", tile: at(6, 3), fireMs: 820, flightMs: 340, cover: false, size: 3 }]);
  });
});

describe("Scrap in the playback", () => {
  it("pulls the rubble of the blast into the hand and raises the label SCRAP", () => {
    const cues = effectCuesOf([blast[4]!], fireOf);
    expect(cues).toContainEqual({ kind: "scrapPull", casterId: "tilly", tile: at(6, 3), startMs: 0 });
    expect(cues).toContainEqual(expect.objectContaining({ kind: "number", toId: "tilly", text: "SCRAP", style: "scrap", startMs: SCRAP_LABEL_MS }));
    expect(SCRAP_PULL_MS).toBeLessThan(SCRAP_LABEL_MS);
  });
});

describe("Marked and Scrap Fields in the playback", () => {
  it("labels the extra damage of a hit on a Marked Hero", () => {
    const hit: MatchEvent = { kind: EventKind.AttackHit, tick: 1, heroId: "b", targetId: "t", absorbed: 0, damage: 3, crossfire: 0, marked: 1, card: "Handle With Care", distance: 2 };
    expect(effectCuesOf([hit], fireOf)).toContainEqual(expect.objectContaining({ kind: "bonus", toId: "t", text: "MARKED +1", tone: "marked" }));
  });

  it("lets the Hero that walks through a Scrap Field react at once, and the caster of the field do nothing", () => {
    const steps: MatchEvent[] = [
      { kind: EventKind.Step, tick: 2, heroId: "enemy", from: at(10, 3), to: at(9, 3) },
      { kind: EventKind.AttackHit, tick: 2, heroId: "tilly", targetId: "enemy", absorbed: 0, damage: 1, crossfire: 0, card: "Heavy Metal" },
    ];
    const frames = buildPlaybackFrames(steps, classOf);
    expect(frames).toHaveLength(2);
    expect(frames[1]!.clips).toEqual({ enemy: "hit" });
    expect(frames[1]!.delays).toEqual({ enemy: 0 });
    expect(frames[1]!.aims).toEqual({});
    expect(frames.some((frame) => frame.clips.tilly !== undefined)).toBe(false);
  });
});
