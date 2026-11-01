import { ActionKind, type QueuedAction } from "game-core";
import { describe, expect, it } from "vitest";
import { selectHero } from "./planning-selection";

const queue: readonly QueuedAction[] = [{ kind: ActionKind.Move, card: 0, destination: { col: 1, row: 1 } }];

describe("selectHero", () => {
  it("discards the Queue and the armed card when another Hero is selected", () => {
    expect(selectHero({ selectedId: "a", queue, armed: 2 }, "b", false)).toEqual({ selectedId: "b", queue: [], armed: undefined });
  });

  it("keeps the draft when the same Hero is selected again", () => {
    const draft = { selectedId: "a", queue, armed: undefined };
    expect(selectHero(draft, "a", false)).toBe(draft);
  });

  it("ignores selection during the playback", () => {
    const draft = { selectedId: "a", queue, armed: undefined };
    expect(selectHero(draft, "b", true)).toBe(draft);
  });
});
