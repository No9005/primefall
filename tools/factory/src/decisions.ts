// Pure decisions of the software factory: who may start runs, when to rework, when to merge.
import { BlastRadius } from "./blast-radius.ts";

export const Label = {
  ReadyForAgent: "ready-for-agent",
  ReadyForHuman: "ready-for-human",
  AgentWorking: "agent-working",
  NeedsHuman: "needs-human",
  NeedsHumanMerge: "needs-human-merge",
  BlastRadiusLow: "blast-radius:low",
  BlastRadiusHigh: "blast-radius:high",
  HighRisk: "high-risk",
} as const;

export const ReviewVerdict = { Pass: "pass", Fail: "fail" } as const;
export type ReviewVerdict = (typeof ReviewVerdict)[keyof typeof ReviewVerdict];

export const MAX_FAILED_REVIEWS = 2;
export const AGENT_BRANCH_PREFIX = "agent/";

export function blastRadiusLabel(level: BlastRadius): string {
  return level === BlastRadius.High ? Label.BlastRadiusHigh : Label.BlastRadiusLow;
}

export interface IssueEvent {
  event: string;
  actor: string | undefined;
  label: string | undefined;
}

/** True when the most recent `ready-for-agent` label event was made by the repository owner. */
export function readyLabelSetByOwner(events: IssueEvent[], owner: string): boolean {
  const last = events.filter((e) => e.event === "labeled" && e.label === Label.ReadyForAgent).at(-1);
  return last?.actor === owner;
}

export interface IssueState {
  labels: string[];
  openBlockers: number;
  hasOpenPullRequest: boolean;
  hasAgentBranch: boolean;
  readyLabelSetByOwner: boolean;
}

export interface Startable {
  startable: boolean;
  reason: string;
}

export function isIssueStartable(issue: IssueState): Startable {
  if (!issue.labels.includes(Label.ReadyForAgent)) return { startable: false, reason: "not labelled ready-for-agent" };
  if (issue.labels.includes(Label.ReadyForHuman)) return { startable: false, reason: "labelled ready-for-human" };
  if (!issue.readyLabelSetByOwner) return { startable: false, reason: "ready-for-agent was not set by the repository owner" };
  if (issue.openBlockers > 0) return { startable: false, reason: `${issue.openBlockers} open blocker(s)` };
  if (issue.labels.includes(Label.AgentWorking)) return { startable: false, reason: "a run is already working on it" };
  if (issue.hasOpenPullRequest) return { startable: false, reason: "an open pull request exists" };
  if (issue.hasAgentBranch) return { startable: false, reason: "an agent branch already exists" };
  return { startable: true, reason: "ready" };
}

/** A pull request is the factory's own when it comes from an `agent/` branch of this repository. */
export function isFactoryPullRequest(input: { headRef: string; headRepo: string; baseRepo: string }): boolean {
  return input.headRef.startsWith(AGENT_BRANCH_PREFIX) && input.headRepo === input.baseRepo;
}

export const ReworkAction = { Rework: "rework", NeedsHuman: "needs-human" } as const;
export type ReworkAction = (typeof ReworkAction)[keyof typeof ReworkAction];

/** `failedReviews` counts the failing review that just finished. */
export function reworkDecision(failedReviews: number, maxFailedReviews: number = MAX_FAILED_REVIEWS): ReworkAction {
  return failedReviews >= maxFailedReviews ? ReworkAction.NeedsHuman : ReworkAction.Rework;
}

export const MergeGateAction = {
  EnableAutoMerge: "enable-auto-merge",
  AwaitHumanMerge: "await-human-merge",
  Nothing: "nothing",
} as const;
export type MergeGateAction = (typeof MergeGateAction)[keyof typeof MergeGateAction];

export function mergeGateDecision(input: { level: BlastRadius; reviewPassed: boolean; needsHuman: boolean; automergeEnabled: boolean }): MergeGateAction {
  if (!input.reviewPassed || input.needsHuman) return MergeGateAction.Nothing;
  if (input.level === BlastRadius.High) return MergeGateAction.AwaitHumanMerge;
  return input.automergeEnabled ? MergeGateAction.EnableAutoMerge : MergeGateAction.Nothing;
}

export interface ReviewFinding {
  path: string;
  line: number;
  body: string;
}

export interface ReviewResult {
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
  raiseBlastRadiusReason: string | undefined;
}

/** Validates the JSON the review run wrote; anything malformed counts as a failed review. */
export function parseReviewResult(raw: unknown): ReviewResult | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  const verdict = Object.values(ReviewVerdict).find((v) => v === value.verdict);
  if (!verdict || typeof value.summary !== "string" || !Array.isArray(value.findings)) return undefined;
  const findings: ReviewFinding[] = [];
  for (const item of value.findings as unknown[]) {
    const f = item as Record<string, unknown>;
    if (typeof f?.path !== "string" || typeof f?.line !== "number" || typeof f?.body !== "string") return undefined;
    findings.push({ path: f.path, line: f.line, body: f.body });
  }
  const reason = typeof value.raiseBlastRadiusReason === "string" && value.raiseBlastRadiusReason.length > 0 ? value.raiseBlastRadiusReason : undefined;
  return { verdict, summary: value.summary, findings, raiseBlastRadiusReason: reason };
}
