// Pure decisions of the software factory: who may start runs, when to rework, when to merge.
import { BlastRadius } from "./blast-radius.ts";

export const Label = {
  ReadyForAgent: "ready-for-agent",
  ReadyForHuman: "ready-for-human",
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
  ReworkStalled: "<!-- factory:rework-stalled -->",
} as const;

export const ReviewVerdict = { Pass: "pass", Fail: "fail" } as const;
export type ReviewVerdict = (typeof ReviewVerdict)[keyof typeof ReviewVerdict];

/** What a review run amounts to. `NotRun` means no result file exists, so no review happened. */
export const ReviewOutcome = { Pass: ReviewVerdict.Pass, Fail: ReviewVerdict.Fail, NotRun: "not-run" } as const;
export type ReviewOutcome = (typeof ReviewOutcome)[keyof typeof ReviewOutcome];

export const MAX_FAILED_REVIEWS = 2;
/** A review that did not run is repeated automatically this many times per commit; then a human looks. */
export const MAX_REVIEW_RETRIES = 1;

/** `notRunCount` includes the run that just did not run. */
export function reviewRetryDue(notRunCount: number): boolean {
  return notRunCount <= MAX_REVIEW_RETRIES;
}

/** Hidden marker at the start of every review the factory posts; the verdict is part of it. */
export function reviewMarker(verdict: ReviewVerdict): string {
  return `<!-- factory-review:${verdict} -->`;
}
export const AGENT_BRANCH_PREFIX = "agent/";

/**
 * The owner can switch the blast radius rating off (repository variable BLAST_RADIUS_ENABLED=false),
 * for example while the basic MVP is built. Anything but the exact value "false" keeps it on.
 */
export function blastRadiusEnabled(variable: string | undefined): boolean {
  return variable !== "false";
}

/** With the rating switched off every pull request counts as low, whatever labels it carries. */
export function effectiveBlastRadius(level: BlastRadius, enabled: boolean): BlastRadius {
  return enabled ? level : BlastRadius.Low;
}

export function blastRadiusLabel(level: BlastRadius): string {
  return level === BlastRadius.High ? Label.BlastRadiusHigh : Label.BlastRadiusLow;
}

/**
 * Issues the run may start, in the order they are tried: every open ready issue, lowest number first. A
 * run always scans all of them, so a ticket that was skipped earlier (blocked, or its run was replaced
 * while waiting) is never forgotten.
 */
export function candidateIssues(openReadyIssues: number[]): number[] {
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
  if (issue.hasOpenPullRequest) return { startable: false, reason: "an open pull request exists" };
  if (issue.hasAgentBranch) return { startable: false, reason: "an agent branch already exists" };
  return { startable: true, reason: "ready" };
}

/** A pull request is the factory's own when it comes from an `agent/` branch of this repository. */
export function isFactoryPullRequest(input: { headRef: string; headRepo: string; baseRepo: string }): boolean {
  return input.headRef.startsWith(AGENT_BRANCH_PREFIX) && input.headRepo === input.baseRepo;
}

export const RETRO_BRANCH_PREFIX = `${AGENT_BRANCH_PREFIX}retro-`;
export const DEFAULT_RETRO_EVERY = 10;

/** A retro pull request comes from `agent/retro-<n>`; it is never counted and never starts a retro. */
export function isRetroBranch(headRef: string): boolean {
  return headRef.startsWith(RETRO_BRANCH_PREFIX);
}

/**
 * How many merged agent pull requests make one retro (repository variable RETRO_EVERY).
 * Unset or invalid means the default; "0" switches the retro off (returned as 0).
 */
export function retroInterval(variable: string | undefined): number {
  const text = variable?.trim();
  if (text === "0") return 0;
  return text !== undefined && /^[1-9]\d*$/.test(text) ? Number(text) : DEFAULT_RETRO_EVERY;
}

/**
 * A merged pull request starts a retro when it is an agent pull request (not a retro itself) and the
 * number of merged agent pull requests, this one included, is a multiple of the interval.
 */
export function retroDue(input: { headRef: string; mergedAgentPullRequests: number; interval: number }): boolean {
  if (input.interval === 0 || !input.headRef.startsWith(AGENT_BRANCH_PREFIX) || isRetroBranch(input.headRef)) return false;
  return input.mergedAgentPullRequests > 0 && input.mergedAgentPullRequests % input.interval === 0;
}

/**
 * The issues a pull request closes, as normalised lines ("Closes #12"). They become the body of the squash
 * commit, so the closing keyword is also in the commit that lands on the default branch. A pull request that
 * the factory merges with auto-merge did not close its issue from the description alone.
 */
export function closingReferences(description: string | null | undefined): string[] {
  const numbers = [...(description ?? "").matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)\b/gi)].map((match) => match[1] as string);
  return [...new Set(numbers)].map((number) => `Closes #${number}`);
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

export function mergeGateDecision(input: { level: BlastRadius; reviewPassed: boolean; needsHuman: boolean; automergeEnabled: boolean; humanOnly?: boolean }): MergeGateAction {
  if (!input.reviewPassed || input.needsHuman) return MergeGateAction.Nothing;
  if (input.level === BlastRadius.High || input.humanOnly) return MergeGateAction.AwaitHumanMerge;
  return input.automergeEnabled ? MergeGateAction.EnableAutoMerge : MergeGateAction.Nothing;
}

export interface ReviewFinding {
  path: string;
  line: number;
  body: string;
}

/** An earlier review thread the reviewer judges fixed, with the reason it gives. */
export interface ResolvedThread {
  id: string;
  reason: string;
}

export interface ReviewResult {
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
  raiseBlastRadiusReason: string | undefined;
  resolvedThreads: ResolvedThread[];
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
  // Optional part: entries that are not well formed are dropped instead of failing the whole review.
  const resolvedThreads: ResolvedThread[] = [];
  for (const item of Array.isArray(value.resolvedThreads) ? (value.resolvedThreads as unknown[]) : []) {
    const t = item as Record<string, unknown>;
    if (typeof t?.id === "string" && t.id.length > 0 && typeof t.reason === "string" && t.reason.trim().length > 0) resolvedThreads.push({ id: t.id, reason: t.reason.trim() });
  }
  return { verdict, summary: value.summary, findings, raiseBlastRadiusReason: reason, resolvedThreads };
}

/**
 * A missing result file means the review never ran (for example the Claude action skipped itself
 * because the workflow files of the branch differ from the default branch): that is not a failed
 * review and must not start a rework. A file with unusable content is a failed review.
 */
export function reviewOutcome(input: { resultFileExists: boolean; parsed: ReviewResult | undefined }): ReviewOutcome {
  // A missing or unreadable result file means no review happened. It is not a failed review: a failed
  // review hands findings to a rework run, and there are none to hand over.
  if (!input.resultFileExists || input.parsed === undefined) return ReviewOutcome.NotRun;
  return input.parsed.verdict;
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

/**
 * One markdown block for the job summary of an agent step: the session id (to see that steps used separate
 * sessions), turns, duration, cost and the denied commands. No agent text: the summary is for the owner
 * reading the run, and the final message stays in the issue comment that already reports failures.
 */
export function formatRunSummary(title: string, log: unknown): string {
  const messages = Array.isArray(log) ? (log as Record<string, unknown>[]) : [];
  const result = messages.find((m) => m?.type === "result");
  const init = messages.find((m) => m?.type === "system" && typeof m.session_id === "string");
  const sessionId = [result?.session_id, init?.session_id].find((id) => typeof id === "string") as string | undefined;
  const fact = (name: string, value: unknown): string => `- ${name}: ${typeof value === "string" || typeof value === "number" ? String(value) : "unknown"}`;
  const seconds = typeof result?.duration_ms === "number" ? Math.round(result.duration_ms / 1000) : undefined;
  const cost = typeof result?.total_cost_usd === "number" ? `$${result.total_cost_usd.toFixed(2)}` : undefined;
  const denied = summarizeAgentRun(log).deniedTools;
  return [
    `### ${title}`,
    fact("session", sessionId),
    fact("turns", result?.num_turns),
    fact("duration", seconds === undefined ? undefined : `${seconds} s`),
    fact("cost", cost),
    fact("result", result?.subtype),
    ...(denied.length > 0 ? ["- denied:", ...denied.map((d) => `  - \`${d.replaceAll("`", "'")}\``)] : ["- denied: none"]),
    "",
  ].join("\n");
}

/** The factory posts its reviews with the workflow token, so GitHub reports this author. */
const REVIEW_BOT_LOGIN = "github-actions";

export function isReviewBot(login: string | undefined): boolean {
  return login?.replace(/\[bot\]$/, "") === REVIEW_BOT_LOGIN;
}

export interface ReviewThread {
  id: string;
  authorLogin: string | undefined;
  resolved: boolean;
  path: string;
  line: number | null;
  /** Text of the first comment of the thread. */
  body: string;
}

/** Only unresolved threads that the review bot started; threads of people are never touched. */
export function openBotThreads(threads: ReviewThread[]): ReviewThread[] {
  return threads.filter((thread) => !thread.resolved && isReviewBot(thread.authorLogin));
}

/**
 * Which threads may be resolved after a review. Only when the review passed, only threads that the
 * bot started and that are still open, each with a reason, and each at most once.
 */
export function threadsToResolve(input: { verdict: ReviewVerdict; reported: ResolvedThread[]; openBotThreads: ReviewThread[] }): ResolvedThread[] {
  if (input.verdict !== ReviewVerdict.Pass) return [];
  const allowed = new Set(input.openBotThreads.map((thread) => thread.id));
  const seen = new Set<string>();
  return input.reported.filter((entry) => {
    if (!allowed.has(entry.id) || seen.has(entry.id) || entry.reason.trim().length === 0) return false;
    seen.add(entry.id);
    return true;
  });
}

export interface PostedReview {
  nodeId: string;
  body: string | null;
  commitId: string;
}

/** Earlier failed reviews of the factory for other commits, to be collapsed once a review passes. */
export function supersededFailedReviews(reviews: PostedReview[], headSha: string): string[] {
  return reviews.filter((review) => review.commitId !== headSha && review.body?.includes(reviewMarker(ReviewVerdict.Fail))).map((review) => review.nodeId);
}
