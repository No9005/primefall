import { describe, expect, it } from "vitest";
import { calloutClassName, calloutStyleVars, countdownCallout, formatTimer, timerTone } from "./callout";

describe("countdownCallout", () => {
  it("shows the 10 once in amber and 5 to 1 in red", () => {
    expect(countdownCallout(10)).toEqual({ text: "10", tone: "amber" });
    for (const n of [5, 4, 3, 2, 1]) expect(countdownCallout(n)).toEqual({ text: String(n), tone: "red" });
  });

  it("shows nothing at the other seconds, whatever the total time", () => {
    for (const n of [0, 6, 7, 8, 9, 11, 30, 45, 60, 120]) expect(countdownCallout(n)).toBeUndefined();
  });
});

describe("timer pill", () => {
  it("turns amber at 10 s and red at 5 s", () => {
    expect([60, 11, 10, 6, 5, 0].map(timerTone)).toEqual(["normal", "normal", "amber", "amber", "red", "red"]);
  });

  it("formats minutes and seconds", () => {
    expect(formatTimer(45)).toBe("0:45");
    expect(formatTimer(60)).toBe("1:00");
    expect(formatTimer(5)).toBe("0:05");
  });
});

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
