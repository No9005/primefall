import { describe, expect, it } from "vitest";

import { queueRowState, resolutionBarText, resolutionCommitLabel } from "./resolution-hud";

describe("queueRowState", () => {
  it("lights the row of the current Tick, fades earlier rows and leaves later rows alone", () => {
    expect([0, 1, 2, 3].map((slot) => queueRowState(slot, 2))).toEqual(["past", "current", "future", "future"]);
  });

  it("before the first Tick every row is still to come", () => {
    expect([0, 1].map((slot) => queueRowState(slot, 0))).toEqual(["future", "future"]);
  });

  it("after the last Tick of a longer Queue the earlier rows are past", () => {
    expect([0, 1, 2].map((slot) => queueRowState(slot, 4))).toEqual(["past", "past", "past"]);
  });
});

describe("resolutionCommitLabel", () => {
  it("shows Waiting..., the Tick number, then Done", () => {
    expect(resolutionCommitLabel("waiting", 0)).toBe("Waiting...");
    expect(resolutionCommitLabel("callout", 0)).toBe("Tick 1");
    expect(resolutionCommitLabel("ticks", 2)).toBe("Tick 2");
    expect(resolutionCommitLabel("done", 4)).toBe("Done");
  });
});

describe("resolutionBarText", () => {
  it("shows the Tick on screen out of the Resolution's Ticks, then RESOLUTION COMPLETE", () => {
    expect(resolutionBarText("callout", 0, 4)).toBe("RESOLUTION  ·  TICK 1 / 4");
    expect(resolutionBarText("ticks", 3, 4)).toBe("RESOLUTION  ·  TICK 3 / 4");
    expect(resolutionBarText("done", 4, 4)).toBe("RESOLUTION COMPLETE");
  });
});
