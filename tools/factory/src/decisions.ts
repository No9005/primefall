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

/**
 * Hidden markers that identify the factory's single comment of each kind (see upsertComment).
 * Every kind needs its own marker, otherwise one comment overwrites the other.
 */
export const CommentMarker = {
  BlastRadius: "<!-- factory:blast-radius -->",
  NeedsHuman: "<!-- factory:needs-human -->",
  NeedsHumanMerge: "<!-- factory:needs-human-merge -->",
  ReviewNotRun: "<!-- factory:review-not-run -->",
  ImplementFailed: "<!-- factory:implement-failed -->",
} as const;

export const ReviewVerdict = { Pass: "pass", Fail: "fail" } as const;
export type ReviewVerdict = (typeof ReviewVerdict)[keyof typeof ReviewVerdict];

/** What a review run amounts to. `NotRun` means no result file exists, so no review happened. */
export const ReviewOutcome = { Pass: ReviewVerdict.Pass, Fail: ReviewVerdict.Fail, NotRun: "not-run" } as const;
export type ReviewOutcome = (typeof ReviewOutcome)[keyof typeof ReviewOutcome];

export const MAX_FAILED_REVIEWS = 2;
export const AGENT_BRANCH_PREFIX = "agent/";

export function blastRadiusLabel(level: BlastRadius): string {
  return level === BlastRadius.High ? Label.BlastRadiusHigh : Label.BlastRadiusLow;
}

export const SelectTrigger = { Labeled: "labeled", Closed: "closed", Manual: "manual" } as const;
export type SelectTrigger = (typeof SelectTrigger)[keyof typeof SelectTrigger];

/**
 * Issues the implement run may start, in the order they are tried. A labelled or manually started
 * issue is the only candidate. When any issue closes, every open ready issue is a candidate (lowest
 * number first): a closed issue can free several tickets, and a ticket freed earlier but not
 * started must not be forgotten.
 */
export function candidateIssues(trigger: SelectTrigger, issueNumber: number, openReadyIssues: number[]): number[] {
  if (trigger !== SelectTrigger.Closed) return [issueNumber];
  return [...new Set(openReadyIssues)].sort((a, b) => a - b);
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
  if (issue.labels.includes(Label.NeedsHuman)) return { startable: false, reason: "labelled needs-human (a run failed; remove the label to retry)" };
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

/**
 * A missing result file means the review never ran (for example the Claude action skipped itself
 * because the workflow files of the branch differ from the default branch): that is not a failed
 * review and must not start a rework. A file with unusable content is a failed review.
 */
export function reviewOutcome(input: { resultFileExists: boolean; parsed: ReviewResult | undefined }): ReviewOutcome {
  if (!input.resultFileExists) return ReviewOutcome.NotRun;
  return input.parsed?.verdict ?? ReviewOutcome.Fail;
}

export interface AgentRunSummary {
  /** The commands or tools the run was not allowed to use. */
  deniedTools: string[];
  /** What the agent said last. */
  finalMessage: string;
}

const MAX_DENIED_SHOWN = 10;
const MAX_FIELD_LENGTH = 200;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Reads the execution log the Claude action saves (a JSON array of messages) and extracts what a
 * human needs to see when a run ends without a pull request: the denied tools and the last words.
 * Anything unexpected in the log is skipped rather than failing the report.
 */
export function summarizeAgentRun(log: unknown): AgentRunSummary {
  const messages = Array.isArray(log) ? (log as Record<string, unknown>[]) : [];
  const result = messages.find((m) => m?.type === "result");
  const denials = Array.isArray(result?.permission_denials) ? (result.permission_denials as Record<string, unknown>[]) : [];
  const deniedTools = denials.slice(0, MAX_DENIED_SHOWN).map((d) => {
    const input = (d.tool_input ?? {}) as Record<string, unknown>;
    const detail = typeof input.command === "string" ? input.command : typeof input.file_path === "string" ? input.file_path : JSON.stringify(input);
    return `${String(d.tool_name ?? "unknown tool")}: ${truncate(detail, MAX_FIELD_LENGTH)}`;
  });
  const lastAssistant = [...messages].reverse().find((m) => m?.type === "assistant");
  const content = ((lastAssistant?.message as Record<string, unknown> | undefined)?.content ?? []) as Record<string, unknown>[];
  const text = content.filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("\n");
  return { deniedTools, finalMessage: truncate(text, 1500) };
}
