import { describe, expect, it } from "vitest";
import { baseFacing, facingAfterStep } from "./facing";
import { VIEW_ANGLE } from "./terrain";

describe("facing", () => {
  it("starts own Heroes right and enemy Heroes left", () => {
    expect(baseFacing(false)).toBe("right");
    expect(baseFacing(true)).toBe("left");
  });

  it("faces the screen direction of a step, whatever the base facing", () => {
    // At the start view a step along the columns goes right on the screen, a step down the rows goes left.
    expect(facingAfterStep({ col: 1, row: 1 }, { col: 2, row: 1 }, "left")).toBe("right");
    expect(facingAfterStep({ col: 2, row: 1 }, { col: 1, row: 1 }, "right")).toBe("left");
    expect(facingAfterStep({ col: 1, row: 1 }, { col: 1, row: 2 }, "right")).toBe("left");
    expect(facingAfterStep({ col: 1, row: 2 }, { col: 1, row: 1 }, "left")).toBe("right");
  });

  it("keeps the facing when the step is straight up or down the screen", () => {
    const from = { col: 3, row: 3 };
    const to = { col: 4, row: 4 };
    expect(facingAfterStep(from, to, "left", VIEW_ANGLE)).toBe("left");
    expect(facingAfterStep(from, to, "right", VIEW_ANGLE)).toBe("right");
    expect(facingAfterStep(from, from, "left")).toBe("left");
  });

  it("follows the view angle", () => {
    expect(facingAfterStep({ col: 1, row: 1 }, { col: 2, row: 1 }, "right", 135)).not.toBe(facingAfterStep({ col: 1, row: 1 }, { col: 2, row: 1 }, "right", 315));
  });
});
