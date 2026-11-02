import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, TutorialTopic } from "./tutorial";

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

  it("takes its numbers from the card data", () => {
    const attack = TUTORIAL_STEPS.find((step) => step.topic === TutorialTopic.Attack)!;
    expect(attack.caption).toContain(`costs ${attack.card!.energyCost} Energy`);
    expect(attack.caption).toContain(attack.card!.name);
  });
});
