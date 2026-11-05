import { HERO_DECKS, HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { cardListTitle, cardRowName, cardRows, SELECTABLE_HEROES } from "./hero-select";
import { createSelectPose, feetX, sampleSelectPose } from "./hero-select-poses";

describe("the card list", () => {
  it("has one row per distinct card with the number of copies, for every Hero", () => {
    for (const heroClass of SELECTABLE_HEROES) {
      const rows = cardRows(heroClass);
      expect(rows.reduce((sum, row) => sum + row.copies, 0)).toBe(HERO_DECKS[heroClass].length);
      expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    }
  });

  it("writes duplicates as x2 and takes the text from the card data", () => {
    const [pulseBolt] = cardRows(HeroClass.Controller);
    expect(cardRowName(pulseBolt!)).toBe("Pulse Bolt x2");
    expect(pulseBolt).toMatchObject({ type: "Attack", cost: 1, effect: "2 damage" });
    expect(cardRows(HeroClass.Controller).map((row) => row.effect).join(" ")).not.toContain("undefined");
  });

  it("titles the list with the Hero and the size of its Deck", () => {
    expect(cardListTitle(HeroClass.Controller)).toBe("CONTROLLER: 12 CARDS");
  });
});

describe("the poses of the Hero Select", () => {
  const pose = (heroClass: HeroClass, state: "idle" | "ready", ms: number, reduced = false) =>
    structuredClone(sampleSelectPose(heroClass, state, ms, reduced, createSelectPose()));

  it("holds the Bruiser's muzzle to the sky when idle and swings it to the side, firing, when ready", () => {
    expect(pose(HeroClass.Bruiser, "idle", 0).pose.armF.rotation).toBeCloseTo(-168);
    expect(pose(HeroClass.Bruiser, "ready", 6000 * 0.16).pose.armF.rotation).toBeCloseTo(-94);
    expect(pose(HeroClass.Bruiser, "ready", 6000 * 0.225).extras.muzzle).toBe(1);
    expect(pose(HeroClass.Bruiser, "ready", 5000).pose.armF.rotation).toBeCloseTo(-93);
  });

  it("lets the Controller's drone go and leaves it hovering over the Hero", () => {
    const idle = pose(HeroClass.Controller, "idle", 0).pose;
    expect(idle.drone.alpha).toBe(1);
    expect(idle.gun.alpha).toBe(0);
    const ready = pose(HeroClass.Controller, "ready", 5000).pose;
    expect(ready.drone.y).toBeLessThan(idle.drone.y - 30);
    expect(ready.gun.alpha).toBe(1);
  });

  it("turns the Assassin invisible, with a faint ring and the Hidden label", () => {
    const ready = pose(HeroClass.Assassin, "ready", 5000);
    expect(ready.pose.rig.alpha).toBeCloseTo(0.35);
    expect(ready.pose.teamRing.alpha).toBeCloseTo(0.25);
    expect(ready.extras.label).toBe(1);
  });

  it("loops an idle pose and plays a ready pose once, then holds it breathing", () => {
    const first = pose(HeroClass.Assassin, "idle", 100).pose.head.rotation;
    expect(pose(HeroClass.Assassin, "idle", 100 + 3200).pose.head.rotation).toBeCloseTo(first);
    const held = (ms: number) => pose(HeroClass.Bruiser, "ready", ms).pose;
    expect(held(4200 + 1000).armF.rotation).toBeCloseTo(held(60000).armF.rotation);
    expect(held(4200 + 1000).torso.y).not.toBeCloseTo(held(4200).torso.y);
  });

  it("does not move with reduced motion: the first idle frame, the last frame of the ready transition", () => {
    for (const heroClass of SELECTABLE_HEROES) {
      expect(pose(heroClass, "idle", 0, true)).toEqual(pose(heroClass, "idle", 1234, true));
      expect(pose(heroClass, "ready", 0, true)).toEqual(pose(heroClass, "ready", 5000, true));
    }
    expect(pose(HeroClass.Bruiser, "ready", 0, true).pose.armF.rotation).toBeCloseTo(-93);
    expect(pose(HeroClass.Bruiser, "ready", 0, true).extras.muzzle).toBe(0);
  });

  it("moves the selected Bruiser's feet left so its tracer stays in its area", () => {
    expect(feetX(HeroClass.Bruiser, true)).toBe(62);
    expect(feetX(HeroClass.Bruiser, false)).toBe(120);
    expect(feetX(HeroClass.Controller, true)).toBe(120);
  });
});
