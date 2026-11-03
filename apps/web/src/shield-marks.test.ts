import { readFileSync } from "node:fs";
import path from "node:path";
import { ActionKind, EventKind, HERO_DECKS, HeroClass, type MatchEvent, type QueuedAction, Visibility } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames } from "./playback";
import { heroMarks, IconKind, NO_MARKS } from "./shield-marks";

const block: QueuedAction = { kind: ActionKind.Block, card: 0 };
const wait: QueuedAction = { kind: ActionKind.Wait };
const move: QueuedAction = { kind: ActionKind.Move, card: 0, destination: { col: 1, row: 1 } };
const selfCard = HERO_DECKS[HeroClass.Bruiser].findIndex((card) => card.name === "Bulwark");
const bulwark: QueuedAction = { kind: ActionKind.Primary, card: selfCard, target: "b" };
const own = { own: true, heroClass: HeroClass.Bruiser, shield: 0, resolving: false } as const;

describe("heroMarks while planning", () => {
  it("shows two hollow rubies with the Tick for a queued Block 2", () => {
    expect(heroMarks({ ...own, queue: [move, block] })).toMatchObject({ rubies: 2, filled: false, ticks: [2], bubble: false });
  });

  it("shows icons for a Wait and a card played on the Hero itself, in Tick order", () => {
    const { icons } = heroMarks({ ...own, queue: [wait, move, bulwark] });
    expect(icons).toEqual([
      { kind: IconKind.Wait, tick: 1 },
      { kind: IconKind.SelfCard, tick: 3 },
    ]);
  });

  it("shows nothing for a Move-only queue", () => {
    expect(heroMarks({ ...own, queue: [move] })).toEqual(NO_MARKS);
  });
});

describe("heroMarks during the Resolution", () => {
  it("shows as many filled rubies as the Shield value, and the bubble", () => {
    expect(heroMarks({ ...own, resolving: true, shield: 2, queue: [block] })).toMatchObject({ rubies: 2, filled: true, bubble: true, icons: [] });
  });

  it("removes a ruby when damage is absorbed", () => {
    expect(heroMarks({ ...own, resolving: true, shield: 1 })).toMatchObject({ rubies: 1, filled: true, bubble: true });
  });

  it("shows nothing once the Shield is used up or has expired, and no planned marks", () => {
    expect(heroMarks({ ...own, resolving: true, shield: 0, queue: [block, wait] })).toEqual(NO_MARKS);
    expect(heroMarks({ ...own, resolving: false, shield: 0 })).toEqual(NO_MARKS);
  });
});

describe("heroMarks for enemies", () => {
  const enemy = { own: false, heroClass: HeroClass.Assassin, resolving: false } as const;

  it("shows the Shield of a Visible enemy but never its planned Block", () => {
    expect(heroMarks({ ...enemy, visibility: Visibility.Visible, shield: 2 })).toMatchObject({ rubies: 2, filled: true, bubble: true });
    expect(heroMarks({ ...enemy, visibility: Visibility.Visible, shield: 0, queue: [block, wait] })).toEqual(NO_MARKS);
  });

  it("draws nothing for a Ghost or an Unknown enemy", () => {
    for (const visibility of [Visibility.Ghost, Visibility.Unknown]) {
      expect(heroMarks({ ...enemy, visibility, shield: 2, queue: [block] })).toEqual(NO_MARKS);
    }
  });
});

describe("the shield bubble in a replay", () => {
  it("appears in the Tick of the Block and not before", () => {
    const events: MatchEvent[] = [
      { kind: EventKind.Wait, tick: 1, heroId: "b" },
      { kind: EventKind.Wait, tick: 2, heroId: "b" },
      { kind: EventKind.ShieldGained, tick: 3, heroId: "b", amount: 2 },
    ];
    let shield = 0;
    const bubbleByTick = buildPlaybackFrames(events).map((frame) => {
      shield += frame.shields.b ?? 0;
      return [frame.tick, heroMarks({ ...own, resolving: true, shield }).bubble] as const;
    });
    expect(bubbleByTick).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
  });
});

describe("style", () => {
  it("has no colour literal in the marks drawing code outside the style files", () => {
    for (const file of ["shield-marks.ts", "hero-figure.ts"]) {
      expect(readFileSync(path.join(__dirname, file), "utf8"), file).not.toMatch(/0x[0-9a-fA-F]{6}|#[0-9a-fA-F]{6}\b/);
    }
  });
});
