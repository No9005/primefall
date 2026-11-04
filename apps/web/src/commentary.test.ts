import { EventKind, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { buildCommentary, type CommentarySide } from "./commentary";

const names: Record<string, string> = { me: "Bruiser", ally: "Controller", foe: "Enemy Bruiser" };
const sides: Record<string, CommentarySide> = { me: "own", ally: "ally", foe: "enemy" };
const build = (events: MatchEvent[]) => buildCommentary(events, { nameOf: (id) => names[id]!, sideOf: (id) => sides[id]! });
const event = (kind: EventKind, heroId: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({ kind, tick: 1, heroId, ...extra });

describe("buildCommentary", () => {
  it("makes one entry for a Move of two steps, and tells why a blocked Move stopped", () => {
    const to = { col: 1, row: 1 };
    expect(build([event(EventKind.Step, "me", { to }), event(EventKind.Step, "me", { to })])).toEqual([
      { side: "own", title: "Bruiser  ·  Move", detail: "Walks to the marked tile" },
    ]);
    const blocked = build([event(EventKind.Step, "me", { to }), event(EventKind.MoveBlocked, "me")]);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.detail).toContain("Stops");
  });

  it("uses the real numbers of an Attack that hit, with and without Shield", () => {
    const hit = (damage: number, absorbed: number) => build([event(EventKind.AttackHit, "foe", { targetId: "me", damage, absorbed })])[0]!;
    expect(hit(2, 0)).toMatchObject({ side: "enemy", title: "Enemy Bruiser  ·  Attack on Bruiser", detail: "Hits for 2: 2 cards burn from the Deck" });
    expect(hit(0, 2).detail).toBe("The Shield absorbs 2 damage: no card burns");
    expect(hit(1, 1).detail).toBe("The Shield absorbs 1, 1 card burns from the Deck");
  });

  it("covers Block, a failed Attack, Utility and Exhaustion", () => {
    const entries = build([
      event(EventKind.ShieldGained, "me", { amount: 2 }),
      event(EventKind.AttackFailed, "ally", { targetId: "foe" }),
      event(EventKind.SlowApplied, "ally", { targetId: "foe" }),
      event(EventKind.Exhausted, "foe"),
    ]);
    expect(entries.map((entry) => entry.detail)).toEqual([
      "Shield 2 until it is hit",
      "Target is out of range, out of sight or already Exhausted: nothing happens",
      "Its next Move 2 becomes a Move 1",
      "Out of cards: Exhausted",
    ]);
    expect(entries[1]).toMatchObject({ side: "ally", title: "Controller  ·  Attack on Enemy Bruiser" });
  });

  it("lists only your own Wait and skips follow-up events", () => {
    const entries = build([
      event(EventKind.Wait, "ally"),
      event(EventKind.Wait, "foe"),
      event(EventKind.Wait, "me"),
      event(EventKind.HiddenEnded, "foe"),
      event(EventKind.DeckShuffled, "me", { amount: 3 }),
    ]);
    expect(entries).toEqual([{ side: "own", title: "Bruiser  ·  Wait", detail: "Holds position, no Energy used" }]);
  });
});
