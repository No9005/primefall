import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGHT_SCENE, TUTORIAL_STEPS, TutorialTopic } from "./tutorial";

const glossary = readFileSync(path.resolve(__dirname, "../../../GLOSSARY.md"), "utf8");
const definedTerms = [...glossary.matchAll(/^\*\*(.+?)\*\*:/gm)].map((match) => match[1]);

describe("Tutorial steps", () => {
  it("cover the seven topics in order", () => {
    expect(TUTORIAL_STEPS.map((step) => step.topic)).toEqual([
      TutorialTopic.Goal,
      TutorialTopic.Move,
      TutorialTopic.Block,
      TutorialTopic.Pitch,
      TutorialTopic.Attack,
      TutorialTopic.Overdrive,
      TutorialTopic.Sight,
    ]);
  });

  it("use only terms defined in GLOSSARY.md, and each listed term appears in its caption", () => {
    for (const step of TUTORIAL_STEPS) {
      for (const term of step.terms) {
        expect(definedTerms, `${term} in ${step.topic}`).toContain(term);
        expect(step.caption, `${term} in the ${step.topic} caption`).toContain(term);
      }
    }
  });

  it("reuses the game's own card face, drop targets and Board instead of defining its own", () => {
    const screen = readFileSync(path.resolve(__dirname, "TutorialScreen.tsx"), "utf8");
    expect(screen).toMatch(/import \{[^}]*\bCardFace\b[^}]*\bModeFaceCard\b[^}]*\} from "\.\/game-parts"/);
    expect(screen).toMatch(/import \{[^}]*\bBlockChip\b[^}]*\bEnergyPill\b[^}]*\} from "\.\/game-parts"/);
    expect(screen).toContain('from "./Board"');
    expect(screen).not.toMatch(/className="card-(name|cost|text|type)"/);
    expect(screen).not.toMatch(/inShadow|tutorial-sight-line/);
    // Static data only: no match host, no saved match.
    expect(screen).not.toMatch(/match-storage|local-host/);
  });

  it("puts the seen enemy in sight, the enemy behind the Wall out of it, and draws the shot at the seen one", () => {
    const lit = (tile: { col: number; row: number }) => SIGHT_SCENE.visibleTiles.some((t) => t.col === tile.col && t.row === tile.row);
    expect(lit(SIGHT_SCENE.seenEnemy.position)).toBe(true);
    expect(lit(SIGHT_SCENE.hiddenEnemy.position)).toBe(false);
    expect(SIGHT_SCENE.shot.targetId).toBe(SIGHT_SCENE.seenEnemy.id);
  });

  it("takes its numbers from the card data", () => {
    const attack = TUTORIAL_STEPS.find((step) => step.topic === TutorialTopic.Attack)!;
    expect(attack.caption).toContain(`costs ${attack.card!.energyCost} Energy`);
    expect(attack.caption).toContain(attack.card!.name);
  });
});
