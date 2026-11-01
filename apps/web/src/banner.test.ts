import { describeRules } from "game-core";
import { describe, expect, it } from "vitest";
import { bannerText } from "./banner";

describe("bannerText", () => {
  it("shows the value returned by game-core", () => {
    expect(bannerText()).toBe(describeRules());
  });
});
