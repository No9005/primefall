import { MatchEndReason, MatchMode, type MatchResult, SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { defenderZone, endTexts, modeForRole, parseRole, previewLayout, roleGoal, roleOf, roundsLeftText } from "./attack-defend";

const result = (winner: SquadId, reason: MatchEndReason, round: number): MatchResult => ({ winner, reason, round, deckTotals: { [SquadId.Left]: 10, [SquadId.Right]: 8 } });

describe("the role of the player", () => {
  it("makes the player's Squad the Defender for Defend and the Attacker for Attack", () => {
    expect(modeForRole("defend")).toEqual({ kind: MatchMode.AttackAndDefend, defender: SquadId.Left });
    expect(modeForRole("attack")).toEqual({ kind: MatchMode.AttackAndDefend, defender: SquadId.Right });
  });

  it("is read from the Squad View of a match started in that mode, and absent in the classic mode", async () => {
    for (const role of ["attack", "defend"] as const) {
      const view: SquadView = await createLocalHost(7, modeForRole(role)).getSquadView(SquadId.Left);
      expect(roleOf(view)).toBe(role);
    }
    expect(roleOf(await createLocalHost(7).getSquadView(SquadId.Left))).toBeUndefined();
  });

  it("parses the start parameter", () => {
    expect(parseRole("defend")).toBe("defend");
    expect(parseRole("nonsense")).toBeUndefined();
    expect(parseRole(null)).toBeUndefined();
  });
});

describe("HUD texts", () => {
  it("names the goal of each role", () => {
    expect(roleGoal("attack", 12)).toBe("Control the Prime Zone for 3 Resolutions");
    expect(roleGoal("defend", 12)).toBe("Hold out for 12 Rounds");
  });

  it("tells the state of the Zone to the Defender", () => {
    expect(defenderZone({ own: true, enemy: false }, 0)).toBe("yours");
    expect(defenderZone({ own: true, enemy: true }, 0)).toBe("contested");
    expect(defenderZone({ own: false, enemy: true }, 0)).toBe("enemy");
    expect(defenderZone({ own: true, enemy: false }, 1)).toBe("enemy");
  });

  it("counts the Rounds left", () => {
    expect(roundsLeftText(8)).toBe("8 ROUNDS LEFT");
    expect(roundsLeftText(1)).toBe("1 ROUND LEFT");
  });
});

describe("end texts", () => {
  it("gives the four endings of the design", () => {
    expect(endTexts(result(SquadId.Left, MatchEndReason.PrimeZoneHeld, 7), "attack", 12)).toMatchObject({ youWere: "YOU WERE: ATTACK", headline: "VICTORY", reason: "Prime Zone controlled for 3 Resolutions" });
    expect(endTexts(result(SquadId.Left, MatchEndReason.DefenceHeld, 12), "defend", 12)).toMatchObject({ youWere: "YOU WERE: DEFEND", headline: "VICTORY", reason: "Defence held · 12 Rounds played" });
    expect(endTexts(result(SquadId.Right, MatchEndReason.DefenceHeld, 12), "attack", 12)).toMatchObject({ headline: "DEFEAT", reason: "Defence held · 12 Rounds played" });
    expect(endTexts(result(SquadId.Right, MatchEndReason.AllHeroesExhausted, 9), "defend", 12)).toMatchObject({
      headline: "DEFEAT",
      reason: "All your Heroes were Exhausted",
      detail: "Reached Round 9 of 12",
    });
  });
});

describe("the side screen preview", () => {
  it("starts the Defenders in the Prime Zone and the Attackers on their Spawn", () => {
    const attack = previewLayout("attack");
    expect(attack.heroes.map((hero) => hero.position.col)).toEqual([2, 2, 2]);
    expect(attack.enemies.map((hero) => hero.position.col)).toEqual([24, 24, 24]);
    const defend = previewLayout("defend");
    expect(defend.heroes.map((hero) => hero.position.col)).toEqual([20, 20, 20]);
    expect(defend.enemies.map((hero) => hero.position.col)).toEqual([42, 42, 42]);
  });
});
