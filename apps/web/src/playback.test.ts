import { type EnemyView, EventKind, HeroClass, type MatchEvent, Visibility } from "game-core";
import { describe, expect, it } from "vitest";
import { buildPlaybackFrames, enemyIsDrawn, enemyTokens, STEP_MS, tickCountOf, walkProgress } from "./playback";

const step = (tick: number, heroId: string, col: number): MatchEvent => ({
  kind: EventKind.Step,
  tick,
  heroId,
  from: { col: col - 1, row: 0 },
  to: { col, row: 0 },
});

describe("buildPlaybackFrames", () => {
  it("plays one step at a time, with Heroes of the same Tick side by side", () => {
    const frames = buildPlaybackFrames([step(1, "a", 1), step(1, "b", 5), step(1, "a", 2), step(2, "a", 3)]);
    expect(frames.map((frame) => [frame.tick, Object.keys(frame.moves)])).toEqual([
      [1, ["a", "b"]],
      [1, ["a"]],
      [2, ["a"]],
    ]);
    expect(frames[1]!.moves.a).toEqual({ col: 2, row: 0 });
  });

  it("does not move a Hero that places Cover or reveals an area on a tile", () => {
    const frames = buildPlaybackFrames([
      { kind: EventKind.CoverPlaced, tick: 1, heroId: "a", to: { col: 3, row: 3 } },
      { kind: EventKind.AreaRevealed, tick: 2, heroId: "a", to: { col: 6, row: 3 }, amount: 3 },
    ]);
    expect(frames.map((frame) => frame.moves)).toEqual([{}, {}]);
  });

  it("shows a pushed Hero moving one tile per frame", () => {
    const push = (to: number): MatchEvent => ({
      kind: EventKind.Knockback,
      tick: 1,
      heroId: "b",
      from: { col: to - 1, row: 0 },
      to: { col: to, row: 0 },
    });
    const frames = buildPlaybackFrames([push(5), push(6)]);
    expect(frames.map((frame) => frame.moves.b)).toEqual([{ col: 5, row: 0 }, { col: 6, row: 0 }]);
  });

  describe("aims", () => {
    const classes = (id: string) => (id === "a" ? HeroClass.Bruiser : HeroClass.Assassin);
    const attack = (kind: EventKind, card: string, targetId = "b"): MatchEvent => ({ kind, tick: 1, heroId: "a", targetId, card, damage: 1, absorbed: 0 });

    it("names the target of an aimed Attack, hit or failed", () => {
      expect(buildPlaybackFrames([attack(EventKind.AttackHit, "Slam Shot")], classes)[0]!.aims).toEqual({ a: "b" });
      expect(buildPlaybackFrames([attack(EventKind.AttackFailed, "Slam Shot")], classes)[0]!.aims).toEqual({ a: "b" });
    });

    it("has no aim for Shockwave, Block, Wait, Vanish or Reposition", () => {
      const shockwave = buildPlaybackFrames([attack(EventKind.AttackHit, "Shockwave")], classes)[0]!;
      expect(shockwave.aims).toEqual({});
      const others: MatchEvent[] = [
        { kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 1 },
        { kind: EventKind.Wait, tick: 1, heroId: "a" },
        { kind: EventKind.HiddenGained, tick: 1, heroId: "a", card: "Vanish" },
        { kind: EventKind.Step, tick: 1, heroId: "a", from: { col: 0, row: 0 }, to: { col: 1, row: 0 }, card: "Reposition" },
      ];
      for (const event of others) expect(buildPlaybackFrames([event], classes)[0]!.aims).toEqual({});
    });
  });

  it("keeps a frame for a Tick in which every move was blocked", () => {
    const blocked: MatchEvent = { kind: EventKind.MoveBlocked, tick: 1, heroId: "a", from: { col: 1, row: 0 } };
    expect(buildPlaybackFrames([blocked])).toMatchObject([{ tick: 1, moves: {}, shields: {}, hits: [], exhausted: [] }]);
  });

  it("shows Deck Damage and Exhaustion in the frame of their event", () => {
    const hit: MatchEvent = { kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "b", absorbed: 1, damage: 1 };
    const exhausted: MatchEvent = { kind: EventKind.Exhausted, tick: 1, heroId: "b" };
    const [frame] = buildPlaybackFrames([hit, exhausted]);
    expect(frame!.hits).toEqual([{ targetId: "b", damage: 1, absorbed: 1 }]);
    expect(frame!.exhausted).toEqual(["b"]);
  });

  it("passes the card, the Overdrive flag and the Range of a hit on, in the hit and in the logged event", () => {
    const hit: MatchEvent = {
      kind: EventKind.AttackHit, tick: 1, heroId: "a", targetId: "b", absorbed: 0, damage: 4, card: "Long Shot", overdrive: true, distance: 6,
    };
    const [frame] = buildPlaybackFrames([hit]);
    expect(frame!.hits).toEqual([{ targetId: "b", damage: 4, absorbed: 0, card: "Long Shot", overdrive: true, distance: 6 }]);
    expect(frame!.events).toEqual([hit]);
  });

  it("shows Shield in the frame of the Tick in which it was gained", () => {
    const shield: MatchEvent = { kind: EventKind.ShieldGained, tick: 2, heroId: "a", amount: 2 };
    expect(buildPlaybackFrames([step(1, "a", 1), shield])).toMatchObject([
      { tick: 1, moves: { a: { col: 1, row: 0 } }, shields: {} },
      { tick: 2, moves: {}, shields: { a: 2 } },
    ]);
  });

  it("has no frames and no Ticks without events", () => {
    expect(buildPlaybackFrames([])).toEqual([]);
    expect(tickCountOf([])).toBe(0);
    expect(tickCountOf([step(1, "a", 1), step(3, "a", 2)])).toBe(3);
  });
});

describe("an enemy that goes Hidden", () => {
  const hidden: MatchEvent = { kind: EventKind.HiddenGained, tick: 1, heroId: "enemy" };

  it("plays the Hidden clip, which the board does not draw for an enemy", () => {
    const [frame] = buildPlaybackFrames([hidden], () => HeroClass.Assassin);
    expect(frame!.clips.enemy).toBe("hidden");
    expect(enemyIsDrawn(frame!.clips.enemy)).toBe(false);
    expect(enemyIsDrawn("idle")).toBe(true);
    expect(enemyIsDrawn(undefined)).toBe(true);
  });

  it("changes no position, Shield or Exhaustion, so skipping or reduced motion (no clips) ends in the same state", () => {
    const [frame] = buildPlaybackFrames([hidden], () => HeroClass.Assassin);
    expect([frame!.moves, frame!.shields, frame!.hits, frame!.exhausted]).toEqual([{}, {}, [], []]);
  });
});

describe("enemyTokens", () => {
  const visible: EnemyView = {
    id: "v",
    heroClass: HeroClass.Bruiser,
    visibility: Visibility.Visible,
    position: { col: 1, row: 1 },
    shield: 0,
    deckCount: 5,
    discardCount: 0,
    exileCount: 0,
    exhausted: false,
    hidden: false,
    slowed: false,
    marked: false,
    attackBonus: 0,
  };
  const ghost: EnemyView = {
    id: "g",
    heroClass: HeroClass.Bruiser,
    visibility: Visibility.Ghost,
    position: { col: 2, row: 2 },
    deckCount: 5,
    discardCount: 0,
    exileCount: 0,
    lastSeenRound: 1,
  };
  const unknown: EnemyView = { id: "u", heroClass: HeroClass.Bruiser, visibility: Visibility.Unknown };

  it("creates no token for an Unknown enemy, a faded one for a Ghost and a normal one for a Visible enemy", () => {
    const tokens = enemyTokens([visible, ghost, unknown], (units) => units.map((unit) => ({ ...unit, exhausted: unit.exhausted })));
    expect(tokens.map((token) => token.id)).toEqual(["v", "g"]);
    expect(tokens.find((token) => token.id === "g")?.ghost).toBe(true);
    expect(tokens.find((token) => token.id === "v")?.ghost).toBeUndefined();
  });
});

describe("walking from tile to tile", () => {
  it("remembers the tile each Hero walks from in every frame", () => {
    const frames = buildPlaybackFrames([step(1, "a", 1), step(1, "a", 2), step(1, "b", 5)]);
    expect(frames[0]!.walks).toEqual({ a: { col: 0, row: 0 }, b: { col: 4, row: 0 } });
    expect(frames[1]!.walks).toEqual({ a: { col: 1, row: 0 } });
  });

  it("does not glide a Hero that is pushed by Knockback or does something else", () => {
    const frames = buildPlaybackFrames([{ kind: EventKind.Knockback, tick: 1, heroId: "a", from: { col: 3, row: 3 }, to: { col: 4, row: 3 } }]);
    expect(frames[0]!.moves.a).toEqual({ col: 4, row: 3 });
    expect(frames[0]!.walks).toEqual({});
  });

  it("covers one tile in one step at a constant speed, and never overshoots", () => {
    expect(walkProgress(0)).toBe(0);
    expect(walkProgress(STEP_MS / 2)).toBe(0.5);
    expect(walkProgress(STEP_MS)).toBe(1);
    expect(walkProgress(STEP_MS * 3)).toBe(1);
    expect(walkProgress(-10)).toBe(0);
  });
});
