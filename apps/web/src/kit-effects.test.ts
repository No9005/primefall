import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import { effectCuesOf, flightMs } from "./weapon-effects";

const at = (col: number, row: number) => ({ col, row });
const classOf = (id: string) => (id === "kit" ? HeroClass.Assassin : HeroClass.Bruiser);
const fireOf = () => 700;

describe("Personal Space in the playback", () => {
  const slides: MatchEvent[] = [
    { kind: EventKind.AttackHit, tick: 1, heroId: "kit", targetId: "max", absorbed: 0, damage: 1, crossfire: 0, card: "Personal Space", distance: 1 },
    { kind: EventKind.Pull, tick: 1, heroId: "max", from: at(5, 3), to: at(6, 3), casterId: "kit", card: "Personal Space" },
    { kind: EventKind.Pull, tick: 1, heroId: "max", from: at(6, 3), to: at(7, 3), casterId: "kit", card: "Personal Space" },
  ];

  it("strikes at the beat of the blow, with nothing in flight", () => {
    expect(flightMs("Personal Space", 1)).toBe(0);
    const [frame] = buildPlaybackFrames(slides.slice(0, 1), classOf);
    expect(frame!.clips).toMatchObject({ kit: "knockback" });
  });

  it("tags each tile of the slide PUSH 3 and does not tether the pushed Hero to Kit", () => {
    const cues = effectCuesOf(slides.slice(1), fireOf);
    expect(cues).toHaveLength(2);
    for (const cue of cues) {
      expect(cue).toMatchObject({ kind: "pull", toId: "max", tag: "PUSH 3" });
      expect(cue).not.toHaveProperty("casterId");
    }
  });
});

describe("Hidden in the playback", () => {
  const shot: MatchEvent[] = [
    { kind: EventKind.HiddenEnded, tick: 1, heroId: "kit" },
    { kind: EventKind.AttackHit, tick: 1, heroId: "kit", targetId: "max", absorbed: 0, damage: 4, crossfire: 0, card: "Long Shot", distance: 8 },
  ];

  it("plays the Long Shot from Hidden when the shot ends Hidden, in one frame with the end of Hidden", () => {
    const frames = buildPlaybackFrames(shot, classOf);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.clips).toMatchObject({ kit: "longHidden" });
    // The target reacts when the shot leaves at 2000 ms, not at the 1650 ms of the plain Long Shot.
    expect(frames[0]!.delays).toMatchObject({ max: 2000 });
  });

  it("plays the plain Long Shot when Kit was not Hidden", () => {
    const [frame] = buildPlaybackFrames(shot.slice(1), classOf);
    expect(frame!.clips).toMatchObject({ kit: "longShot" });
  });

  it("plays the hit from Hidden for a Hero whose Hidden ends under a hit", () => {
    const hurt: MatchEvent[] = [
      { kind: EventKind.AttackHit, tick: 1, heroId: "max", targetId: "kit", absorbed: 0, damage: 2, crossfire: 0, card: "Handle With Care", distance: 2 },
      { kind: EventKind.HiddenEnded, tick: 1, heroId: "kit" },
    ];
    const [frame] = buildPlaybackFrames(hurt, classOf);
    expect(frame!.clips.kit).toBe("hitHidden");
  });
});
