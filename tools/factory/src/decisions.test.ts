import { describe, expect, it } from "vitest";
import { BlastRadius } from "./blast-radius.ts";
import {
  blastRadiusEnabled,
  candidateIssues,
  CommentMarker,
  effectiveBlastRadius,
  isFactoryPullRequest,
  isReviewBot,
  openBotThreads,
  reviewMarker,
  supersededFailedReviews,
  threadsToResolve,
  type ReviewThread,
  isIssueStartable,
  closingReferences,
  isRetroBranch,
  reviewRetryDue,
  retroDue,
  retroInterval,
  Label,
  MergeGateAction,
  mergeGateDecision,
  parseReviewResult,
  readyLabelSetByOwner,
  ReviewOutcome,
  reviewOutcome,
  summarizeAgentRun,
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
    ["after a failed run (needs-human)", { labels: [Label.ReadyForAgent, Label.NeedsHuman] }],
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

  it("never enables auto-merge for a human-only pull request such as a retro, even with the rating off", () => {
    expect(mergeGateDecision({ ...base, humanOnly: true })).toBe(MergeGateAction.AwaitHumanMerge);
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
  const parsed = { verdict: ReviewVerdict.Pass, summary: "ok", findings: [], raiseBlastRadiusReason: undefined, resolvedThreads: [] };

  it("is not-run when no result file exists, so no rework starts", () => {
    expect(reviewOutcome({ resultFileExists: false, parsed: undefined })).toBe(ReviewOutcome.NotRun);
  });

  it("is not run when the file has unusable content (there are no findings to rework)", () => {
    expect(reviewOutcome({ resultFileExists: true, parsed: undefined })).toBe(ReviewOutcome.NotRun);
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

describe("summarizeAgentRun", () => {
  const log = [
    { type: "system", subtype: "init" },
    { type: "assistant", message: { content: [{ type: "text", text: "Starting." }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }, { type: "text", text: "I could not push the branch." }] } },
    {
      type: "result",
      permission_denials: [
        { tool_name: "Bash", tool_input: { command: "git push -u origin agent/issue-9-x" } },
        { tool_name: "Write", tool_input: { file_path: "/tmp/x" } },
        { tool_name: "Other", tool_input: { a: 1 } },
      ],
    },
  ];

  it("lists the denied tools and the last assistant text", () => {
    const summary = summarizeAgentRun(log);
    expect(summary.deniedTools).toEqual(["Bash: git push -u origin agent/issue-9-x", "Write: /tmp/x", 'Other: {"a":1}']);
    expect(summary.finalMessage).toBe("I could not push the branch.");
  });

  it("limits the number and length of the denied tools", () => {
    const many = { type: "result", permission_denials: Array.from({ length: 30 }, () => ({ tool_name: "Bash", tool_input: { command: "x".repeat(500) } })) };
    const summary = summarizeAgentRun([many]);
    expect(summary.deniedTools).toHaveLength(10);
    expect(summary.deniedTools[0]!.length).toBeLessThan(230);
  });

  it("copes with an unexpected log", () => {
    expect(summarizeAgentRun(null)).toEqual({ deniedTools: [], finalMessage: "" });
    expect(summarizeAgentRun([{ type: "result" }, 5, null])).toEqual({ deniedTools: [], finalMessage: "" });
  });
});

describe("resolving the review bot's own threads", () => {
  const thread = (id: string, overrides: Partial<ReviewThread> = {}): ReviewThread => ({
    id,
    authorLogin: "github-actions",
    resolved: false,
    path: "a.ts",
    line: 3,
    body: "fix this",
    ...overrides,
  });

  it("recognises the review bot with and without the [bot] suffix", () => {
    expect(isReviewBot("github-actions")).toBe(true);
    expect(isReviewBot("github-actions[bot]")).toBe(true);
    expect(isReviewBot("No9005")).toBe(false);
    expect(isReviewBot("claude")).toBe(false);
    expect(isReviewBot(undefined)).toBe(false);
  });

  it("lists only unresolved threads started by the bot", () => {
    const threads = [thread("a"), thread("b", { resolved: true }), thread("c", { authorLogin: "No9005" }), thread("d", { authorLogin: undefined })];
    expect(openBotThreads(threads).map((t) => t.id)).toEqual(["a"]);
  });

  describe("threadsToResolve", () => {
    const open = [thread("a"), thread("b")];
    const reported = [
      { id: "a", reason: "The Queue is now reset in changeSelection." },
      { id: "b", reason: "Covered by the new test." },
    ];

    it("resolves the reported threads when the review passed", () => {
      expect(threadsToResolve({ verdict: ReviewVerdict.Pass, reported, openBotThreads: open }).map((t) => t.id)).toEqual(["a", "b"]);
    });

    it("resolves nothing when the review failed", () => {
      expect(threadsToResolve({ verdict: ReviewVerdict.Fail, reported, openBotThreads: open })).toEqual([]);
    });

    it("never resolves a thread that is not an open thread of the bot", () => {
      const result = threadsToResolve({ verdict: ReviewVerdict.Pass, reported: [{ id: "someone-elses", reason: "x" }, ...reported], openBotThreads: open });
      expect(result.map((t) => t.id)).toEqual(["a", "b"]);
    });

    it("drops duplicates and entries without a reason", () => {
      const result = threadsToResolve({
        verdict: ReviewVerdict.Pass,
        reported: [reported[0]!, reported[0]!, { id: "b", reason: "   " }],
        openBotThreads: open,
      });
      expect(result.map((t) => t.id)).toEqual(["a"]);
    });
  });

  it("collapses earlier failed reviews of other commits, not the current one and not passes", () => {
    const reviews = [
      { nodeId: "old-fail", body: `${reviewMarker(ReviewVerdict.Fail)}\nfail`, commitId: "111" },
      { nodeId: "old-pass", body: `${reviewMarker(ReviewVerdict.Pass)}\npass`, commitId: "111" },
      { nodeId: "human", body: "Looks odd", commitId: "111" },
      { nodeId: "current-fail", body: reviewMarker(ReviewVerdict.Fail), commitId: "222" },
      { nodeId: "no-body", body: null, commitId: "111" },
    ];
    expect(supersededFailedReviews(reviews, "222")).toEqual(["old-fail"]);
  });

  it("reads resolvedThreads from the review result and drops malformed entries", () => {
    const result = parseReviewResult({
      verdict: "pass",
      summary: "ok",
      findings: [],
      resolvedThreads: [{ id: "a", reason: " fixed in changeSelection " }, { id: "", reason: "x" }, { id: "b" }, "nope"],
    });
    expect(result?.resolvedThreads).toEqual([{ id: "a", reason: "fixed in changeSelection" }]);
    expect(parseReviewResult({ verdict: "pass", summary: "ok", findings: [] })?.resolvedThreads).toEqual([]);
  });
});

describe("the blast radius switch", () => {
  it("is on unless the variable is exactly false", () => {
    expect(blastRadiusEnabled(undefined)).toBe(true);
    expect(blastRadiusEnabled("")).toBe(true);
    expect(blastRadiusEnabled("true")).toBe(true);
    expect(blastRadiusEnabled("false")).toBe(false);
  });

  it("rates every pull request low when switched off, and keeps the rating when on", () => {
    expect(effectiveBlastRadius(BlastRadius.High, false)).toBe(BlastRadius.Low);
    expect(effectiveBlastRadius(BlastRadius.Low, false)).toBe(BlastRadius.Low);
    expect(effectiveBlastRadius(BlastRadius.High, true)).toBe(BlastRadius.High);
    expect(effectiveBlastRadius(BlastRadius.Low, true)).toBe(BlastRadius.Low);
  });

  it("lets the merge gate enable auto-merge for a high pull request when the rating is off", () => {
    const high = { level: BlastRadius.High, reviewPassed: true, needsHuman: false, automergeEnabled: true };
    expect(mergeGateDecision({ ...high, level: effectiveBlastRadius(high.level, false) })).toBe(MergeGateAction.EnableAutoMerge);
    expect(mergeGateDecision({ ...high, level: effectiveBlastRadius(high.level, true) })).toBe(MergeGateAction.AwaitHumanMerge);
  });
});

describe("retroInterval", () => {
  it.each<[string | undefined, number]>([
    [undefined, 10],
    ["", 10],
    ["5", 5],
    [" 20 ", 20],
    ["0", 0],
    ["-3", 10],
    ["abc", 10],
    ["2.5", 10],
    ["07", 10],
  ])("RETRO_EVERY=%j means %i", (variable, expected) => {
    expect(retroInterval(variable)).toBe(expected);
  });
});

describe("retroDue", () => {
  const merged = { headRef: "agent/issue-5-foo", interval: 10 };

  it.each([
    [9, false],
    [10, true],
    [11, false],
    [20, true],
    [0, false],
  ])("with %i merged agent pull requests: %s", (mergedAgentPullRequests, expected) => {
    expect(retroDue({ ...merged, mergedAgentPullRequests })).toBe(expected);
  });

  it("follows the configured interval and is off at 0", () => {
    expect(retroDue({ ...merged, mergedAgentPullRequests: 5, interval: 5 })).toBe(true);
    expect(retroDue({ ...merged, mergedAgentPullRequests: 10, interval: 0 })).toBe(false);
  });

  it("is never started by a retro pull request or a pull request that is not from an agent branch", () => {
    expect(retroDue({ ...merged, headRef: "agent/retro-10", mergedAgentPullRequests: 10 })).toBe(false);
    expect(retroDue({ ...merged, headRef: "feature/thing", mergedAgentPullRequests: 10 })).toBe(false);
  });

  it("recognises retro branches", () => {
    expect(isRetroBranch("agent/retro-10")).toBe(true);
    expect(isRetroBranch("agent/issue-10-retro")).toBe(false);
  });
});

describe("closingReferences", () => {
  it.each<[string | null | undefined, string[]]>([
    [undefined, []],
    [null, []],
    ["No keyword, see #12", []],
    ["Closes #12", ["Closes #12"]],
    ["closes #12 and fixes #13.", ["Closes #12", "Closes #13"]],
    ["Resolved: #7\nCloses #7", ["Closes #7"]],
    ["Part of #16", []],
  ])("%j gives %j", (description, expected) => {
    expect(closingReferences(description)).toEqual(expected);
  });
});

describe("reviewRetryDue", () => {
  it("repeats a review that did not run once per commit", () => {
    expect(reviewRetryDue(1)).toBe(true);
    expect(reviewRetryDue(2)).toBe(false);
    expect(reviewRetryDue(3)).toBe(false);
  });
});
