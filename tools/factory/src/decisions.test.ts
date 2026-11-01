import { describe, expect, it } from "vitest";
import { BlastRadius } from "./blast-radius.ts";
import {
  candidateIssues,
  CommentMarker,
  isFactoryPullRequest,
  isIssueStartable,
  Label,
  MergeGateAction,
  mergeGateDecision,
  parseReviewResult,
  readyLabelSetByOwner,
  ReviewOutcome,
  reviewOutcome,
  reworkDecision,
  ReworkAction,
  ReviewVerdict,
  SelectTrigger,
  type IssueState,
} from "./decisions.ts";

const startable: IssueState = { labels: [Label.ReadyForAgent], openBlockers: 0, hasOpenPullRequest: false, hasAgentBranch: false, readyLabelSetByOwner: true };

describe("isIssueStartable", () => {
  it("starts a ready, unblocked issue", () => {
    expect(isIssueStartable(startable).startable).toBe(true);
  });

  it.each<[string, Partial<IssueState>]>([
    ["without the ready label", { labels: [] }],
    ["with ready-for-human", { labels: [Label.ReadyForAgent, Label.ReadyForHuman] }],
    ["when the label was not set by the owner", { readyLabelSetByOwner: false }],
    ["with an open blocker", { openBlockers: 1 }],
    ["while a run is working on it", { labels: [Label.ReadyForAgent, Label.AgentWorking] }],
    ["with an open pull request", { hasOpenPullRequest: true }],
    ["with an existing agent branch", { hasAgentBranch: true }],
  ])("does not start %s", (_name, change) => {
    expect(isIssueStartable({ ...startable, ...change }).startable).toBe(false);
  });
});

describe("candidateIssues", () => {
  it("uses only the labelled or manually started issue", () => {
    expect(candidateIssues(SelectTrigger.Labeled, 12, [8, 9, 12])).toEqual([12]);
    expect(candidateIssues(SelectTrigger.Manual, 8, [8, 9])).toEqual([8]);
  });

  it("tries every open ready issue, lowest number first, when an issue closes", () => {
    expect(candidateIssues(SelectTrigger.Closed, 12, [15, 13, 15, 22])).toEqual([13, 15, 22]);
    expect(candidateIssues(SelectTrigger.Closed, 12, [])).toEqual([]);
  });
});

describe("readyLabelSetByOwner", () => {
  it("uses the most recent ready-for-agent label event", () => {
    const events = [
      { event: "labeled", actor: "someone", label: Label.ReadyForAgent },
      { event: "unlabeled", actor: "owner", label: Label.ReadyForAgent },
      { event: "labeled", actor: "owner", label: Label.ReadyForAgent },
    ];
    expect(readyLabelSetByOwner(events, "owner")).toBe(true);
    expect(readyLabelSetByOwner(events.slice(0, 1), "owner")).toBe(false);
    expect(readyLabelSetByOwner([], "owner")).toBe(false);
  });
});

describe("isFactoryPullRequest", () => {
  it("accepts agent branches of this repository only", () => {
    expect(isFactoryPullRequest({ headRef: "agent/issue-1-x", headRepo: "o/r", baseRepo: "o/r" })).toBe(true);
    expect(isFactoryPullRequest({ headRef: "agent/issue-1-x", headRepo: "fork/r", baseRepo: "o/r" })).toBe(false);
    expect(isFactoryPullRequest({ headRef: "feature/x", headRepo: "o/r", baseRepo: "o/r" })).toBe(false);
  });
});

describe("reworkDecision", () => {
  it("reworks after the first failed review and hands over after the second", () => {
    expect(reworkDecision(1)).toBe(ReworkAction.Rework);
    expect(reworkDecision(2)).toBe(ReworkAction.NeedsHuman);
    expect(reworkDecision(3)).toBe(ReworkAction.NeedsHuman);
  });
});

describe("mergeGateDecision", () => {
  const base = { level: BlastRadius.Low, reviewPassed: true, needsHuman: false, automergeEnabled: true };

  it("enables auto-merge only for low blast radius with the switch on", () => {
    expect(mergeGateDecision(base)).toBe(MergeGateAction.EnableAutoMerge);
    expect(mergeGateDecision({ ...base, automergeEnabled: false })).toBe(MergeGateAction.Nothing);
  });

  it("never enables auto-merge for high blast radius", () => {
    expect(mergeGateDecision({ ...base, level: BlastRadius.High })).toBe(MergeGateAction.AwaitHumanMerge);
    expect(mergeGateDecision({ ...base, level: BlastRadius.High, automergeEnabled: false })).toBe(MergeGateAction.AwaitHumanMerge);
  });

  it("does nothing without a passing review or when a human is needed", () => {
    expect(mergeGateDecision({ ...base, reviewPassed: false })).toBe(MergeGateAction.Nothing);
    expect(mergeGateDecision({ ...base, needsHuman: true })).toBe(MergeGateAction.Nothing);
    expect(mergeGateDecision({ ...base, level: BlastRadius.High, needsHuman: true })).toBe(MergeGateAction.Nothing);
  });
});

describe("parseReviewResult", () => {
  it("accepts a well-formed result", () => {
    const result = parseReviewResult({ verdict: "fail", summary: "x", findings: [{ path: "a.ts", line: 3, body: "b" }], raiseBlastRadiusReason: "touches shared state" });
    expect(result?.verdict).toBe(ReviewVerdict.Fail);
    expect(result?.findings).toHaveLength(1);
    expect(result?.raiseBlastRadiusReason).toBe("touches shared state");
  });

  it("rejects malformed results", () => {
    expect(parseReviewResult(null)).toBeUndefined();
    expect(parseReviewResult({ verdict: "maybe", summary: "x", findings: [] })).toBeUndefined();
    expect(parseReviewResult({ verdict: "pass", summary: "x", findings: [{ path: "a" }] })).toBeUndefined();
  });
});

describe("reviewOutcome", () => {
  const parsed = { verdict: ReviewVerdict.Pass, summary: "ok", findings: [], raiseBlastRadiusReason: undefined };

  it("is not-run when no result file exists, so no rework starts", () => {
    expect(reviewOutcome({ resultFileExists: false, parsed: undefined })).toBe(ReviewOutcome.NotRun);
  });

  it("is a failed review when the file has unusable content", () => {
    expect(reviewOutcome({ resultFileExists: true, parsed: undefined })).toBe(ReviewOutcome.Fail);
  });

  it("uses the verdict of a valid result", () => {
    expect(reviewOutcome({ resultFileExists: true, parsed })).toBe(ReviewOutcome.Pass);
    expect(reviewOutcome({ resultFileExists: true, parsed: { ...parsed, verdict: ReviewVerdict.Fail } })).toBe(ReviewOutcome.Fail);
  });
});

describe("CommentMarker", () => {
  it("gives every kind of factory comment its own marker so they never overwrite each other", () => {
    const markers = Object.values(CommentMarker);
    expect(new Set(markers).size).toBe(markers.length);
  });
});
