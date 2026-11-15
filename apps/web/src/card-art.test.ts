import { existsSync } from "node:fs";
import path from "node:path";
import { HERO_DECKS, HeroClass } from "game-core";
import { describe, expect, it } from "vitest";
import { CARD_ART_FILES, cardArtUrl } from "./card-art";

const FOLDER = path.join(import.meta.dirname, "../public/assets/cards");

describe("the pictures of the cards", () => {
  it("has a file for every picture that is named", () => {
    for (const file of Object.values(CARD_ART_FILES)) expect(existsSync(path.join(FOLDER, `${file}.png`)), file).toBe(true);
  });

  it("gives every card of every Hero a picture, and a card that does not exist none", () => {
    for (const heroClass of Object.values(HeroClass)) {
      for (const card of HERO_DECKS[heroClass]) expect(cardArtUrl(card.name), card.name).toMatch(/assets\/cards\/.+\.png$/);
    }
    expect(cardArtUrl("Precision Shot")).toBeUndefined();
  });
});
