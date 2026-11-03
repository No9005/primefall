import { describe, expect, it } from "vitest";
import { calloutClassName, calloutStyleVars } from "./callout";

describe("callout", () => {
  it("picks the keyframes by kind and the colour by tone", () => {
    expect(calloutClassName("word", "gold")).toBe("callout-word callout-tone-gold");
    expect(calloutClassName("number", "amber")).toBe("callout-number callout-tone-amber");
  });

  it("turns the duration into a CSS time", () => {
    expect(calloutStyleVars(1200)).toEqual({ "--callout-ms": "1200ms" });
    expect(calloutStyleVars(0)).toEqual({ "--callout-ms": "1ms" });
  });
});
