import { HERO_DECKS, HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { cancel, type Face, faceReveal, faceViews, heldCard, IDLE, move, openCard, press, PULL_THRESHOLD, release, REVEAL_SPAN, REVEAL_START, showsFaces, tap } from "./card-pull";
import { CardUse } from "./planning-selection";

const origin = { x: 100, y: 360 };
const MIDDLE = 250;
const HAND_TOP = 328;
const up = (distance: number) => ({ x: origin.x, y: origin.y - distance });

describe("the card pull state machine", () => {
  it("a press holds the card without showing the faces", () => {
    const state = press(2, origin);
    expect(heldCard(state)).toBe(2);
    expect(showsFaces(state)).toBe(false);
    expect(heldCard(IDLE)).toBeUndefined();
  });

  it("small movements keep the press; moving beyond the threshold pulls the card out", () => {
    const pressed = press(2, origin);
    expect(move(pressed, up(PULL_THRESHOLD)).phase).toBe("pressed");
    const pulled = move(pressed, up(PULL_THRESHOLD + 1));
    expect(pulled).toEqual({ phase: "pulled", card: 2, origin, point: up(PULL_THRESHOLD + 1) });
    expect(showsFaces(pulled)).toBe(true);
    expect(move(pulled, up(100))).toMatchObject({ phase: "pulled", point: up(100) });
  });

  it.each([
    ["the first card of a Hand of 4", 0],
    ["the middle card of a Hand of 4", 2],
    ["the last card of a Hand of 4", 3],
    ["the only card of a Hand of 1", 0],
  ])("a drag from %s released above the middle line parks it with the faces open", (_name, card) => {
    const pulled = move(press(card, origin), up(150));
    const { state, chosen } = release(pulled, undefined, MIDDLE);
    expect(state).toEqual({ phase: "parked", card });
    expect(showsFaces(state)).toBe(true);
    expect(chosen).toBeUndefined();
  });

  it("a release below the middle line puts the card back, nothing chosen", () => {
    const pulled = move(press(2, origin), up(40));
    expect(release(pulled, undefined, MIDDLE)).toEqual({ state: IDLE });
  });

  it("dropping on an enabled face chooses it, on a disabled face (no face found) chooses nothing", () => {
    const pulled = move(press(2, origin), up(200));
    expect(release(pulled, CardUse.Move, MIDDLE)).toEqual({ state: IDLE, chosen: { card: 2, face: CardUse.Move } });
    expect(release(pulled, "overdrive", MIDDLE).chosen).toEqual({ card: 2, face: "overdrive" });
    expect(release(pulled, undefined, MIDDLE).chosen).toBeUndefined();
  });

  it("a tap parks the card; tapping a face chooses it, tapping elsewhere or the parked card puts it back", () => {
    const parked = release(press(1, origin), undefined, MIDDLE).state;
    expect(parked).toEqual({ phase: "parked", card: 1 });
    expect(showsFaces(parked)).toBe(true);
    expect(tap(parked, CardUse.Pitch)).toEqual({ state: IDLE, chosen: { card: 1, face: CardUse.Pitch } });
    expect(tap(parked, undefined)).toEqual({ state: IDLE });
  });

  it("a cancelled gesture leaves nothing held", () => {
    expect(heldCard(cancel())).toBeUndefined();
    expect(cancel()).toEqual(IDLE);
  });

  it("steps that do not fit the phase change nothing", () => {
    expect(release(IDLE, CardUse.Move, MIDDLE)).toEqual({ state: IDLE });
    expect(tap(press(1, origin), CardUse.Move).chosen).toBeUndefined();
    expect(move(IDLE, up(100))).toEqual(IDLE);
    const parked = openCard(1);
    expect(move(parked, up(100))).toEqual(parked);
    expect(release(parked, CardUse.Move, MIDDLE)).toEqual({ state: parked });
  });

  it("the faces fade in with the height of the finger: nothing in the Hand, everything at the middle", () => {
    expect(faceReveal(HAND_TOP, HAND_TOP)).toBe(0);
    expect(faceReveal(HAND_TOP - REVEAL_START, HAND_TOP)).toBe(0);
    expect(faceReveal(HAND_TOP - REVEAL_START - REVEAL_SPAN / 2, HAND_TOP)).toBeCloseTo(0.5);
    expect(faceReveal(HAND_TOP - REVEAL_START - REVEAL_SPAN, HAND_TOP)).toBe(1);
    expect(faceReveal(0, HAND_TOP)).toBe(1);
  });
});

describe("the faces of a card", () => {
  const allFree = { [CardUse.Primary]: undefined, [CardUse.Pitch]: undefined, [CardUse.Move]: undefined, [CardUse.Block]: undefined };
  const withOverdrive = HERO_DECKS[HeroClass.Assassin].find((card) => card.overdrive)!;
  const without = HERO_DECKS[HeroClass.Assassin].find((card) => !card.overdrive)!;

  it("has four faces, five on a card with an Overdrive, and no Block face in the classic mode", () => {
    expect(faceViews(without, allFree, undefined, { primary: "x", overdrive: undefined }, true).map(({ face }) => face)).toEqual([
      CardUse.Primary,
      CardUse.Pitch,
      CardUse.Move,
      CardUse.Block,
    ]);
    expect(faceViews(withOverdrive, allFree, undefined, { primary: "x", overdrive: "y" }, true).map(({ face }) => face)).toEqual([
      CardUse.Primary,
      CardUse.Pitch,
      CardUse.Move,
      CardUse.Block,
      "overdrive",
    ]);
    expect(faceViews(withOverdrive, allFree, undefined, { primary: "x", overdrive: "y" }, false).map(({ face }) => face)).toEqual([
      CardUse.Primary,
      CardUse.Pitch,
      CardUse.Move,
      "overdrive",
    ]);
  });

  it("shows an unaffordable cost as Not enough Energy and keeps other reasons", () => {
    const faces = faceViews(withOverdrive, { ...allFree, [CardUse.Primary]: "needs 2 Energy", [CardUse.Move]: "Queue is full" }, "needs 2 Energy", { primary: "x", overdrive: "y" }, true);
    const reason = (face: Face) => faces.find((candidate) => candidate.face === face)?.reason;
    expect(reason(CardUse.Primary)).toBe("Not enough Energy");
    expect(reason("overdrive")).toBe("Not enough Energy");
    expect(reason(CardUse.Move)).toBe("Queue is full");
    expect(reason(CardUse.Pitch)).toBeUndefined();
  });
});
