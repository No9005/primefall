import { HERO_DECKS, HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { type Face, faceViews, heldCard, IDLE, move, press, PULL_THRESHOLD, release, showsFaces, tap } from "./card-pull";
import { CardUse } from "./planning-selection";

const origin = { x: 100, y: 300 };
const HAND_TOP = 250;
const up = (distance: number) => ({ x: origin.x, y: origin.y - distance });

describe("the card pull state machine", () => {
  it("a press holds the card without showing the faces", () => {
    const state = press(2, origin);
    expect(heldCard(state)).toBe(2);
    expect(showsFaces(state)).toBe(false);
    expect(heldCard(IDLE)).toBeUndefined();
  });

  it("small movements keep the press; pulling up beyond the threshold shows the faces", () => {
    const pressed = press(2, origin);
    expect(move(pressed, up(PULL_THRESHOLD), HAND_TOP).phase).toBe("pressed");
    expect(move(pressed, { x: 400, y: origin.y }, HAND_TOP).phase).toBe("pressed");
    expect(move(pressed, up(PULL_THRESHOLD + 1), HAND_TOP)).toEqual({ phase: "pulled", card: 2, origin });
  });

  it("dropping on a face chooses it", () => {
    const pulled = move(press(2, origin), up(60), HAND_TOP);
    expect(release(pulled, CardUse.Move)).toEqual({ state: IDLE, chosen: { card: 2, face: CardUse.Move } });
    expect(release(pulled, "overdrive").chosen).toEqual({ card: 2, face: "overdrive" });
  });

  it("releasing without a face puts the card back unchanged", () => {
    const pulled = move(press(2, origin), up(60), HAND_TOP);
    expect(release(pulled, undefined)).toEqual({ state: IDLE });
  });

  it("dragging back down into the Hand puts the card back", () => {
    const pulled = move(press(2, origin), up(60), HAND_TOP);
    expect(move(pulled, { x: 100, y: HAND_TOP }, HAND_TOP)).toEqual(IDLE);
  });

  it("a tap opens the faces; tapping a face chooses it, tapping elsewhere cancels", () => {
    const open = release(press(1, origin), undefined).state;
    expect(open).toEqual({ phase: "open", card: 1 });
    expect(showsFaces(open)).toBe(true);
    expect(tap(open, CardUse.Pitch)).toEqual({ state: IDLE, chosen: { card: 1, face: CardUse.Pitch } });
    expect(tap(open, undefined)).toEqual({ state: IDLE });
  });

  it("steps that do not fit the phase change nothing", () => {
    expect(release(IDLE, CardUse.Move)).toEqual({ state: IDLE });
    expect(tap(press(1, origin), CardUse.Move).chosen).toBeUndefined();
    expect(move(IDLE, up(100), HAND_TOP)).toEqual(IDLE);
  });
});

describe("the faces of a card", () => {
  const allFree = { [CardUse.Primary]: undefined, [CardUse.Pitch]: undefined, [CardUse.Move]: undefined, [CardUse.Block]: undefined };
  const withOverdrive = HERO_DECKS[HeroClass.Assassin].find((card) => card.overdrive)!;
  const without = HERO_DECKS[HeroClass.Assassin].find((card) => !card.overdrive)!;

  it("has four faces, five on a card with an Overdrive", () => {
    expect(faceViews(without, allFree, undefined, { primary: "x", overdrive: undefined }).map(({ face }) => face)).toEqual([
      CardUse.Primary,
      CardUse.Pitch,
      CardUse.Move,
      CardUse.Block,
    ]);
    expect(faceViews(withOverdrive, allFree, undefined, { primary: "x", overdrive: "y" }).map(({ face }) => face)).toEqual([
      CardUse.Primary,
      CardUse.Pitch,
      CardUse.Move,
      CardUse.Block,
      "overdrive",
    ]);
  });

  it("shows an unaffordable cost as Not enough Energy and keeps other reasons", () => {
    const faces = faceViews(withOverdrive, { ...allFree, [CardUse.Primary]: "needs 2 Energy", [CardUse.Move]: "Queue is full" }, "needs 2 Energy", { primary: "x", overdrive: "y" });
    const reason = (face: Face) => faces.find((candidate) => candidate.face === face)?.reason;
    expect(reason(CardUse.Primary)).toBe("Not enough Energy");
    expect(reason("overdrive")).toBe("Not enough Energy");
    expect(reason(CardUse.Move)).toBe("Queue is full");
    expect(reason(CardUse.Pitch)).toBeUndefined();
  });
});
