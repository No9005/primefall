// Pure functions that turn GitHub data into the dashboard status. No network, no clock, no browser.
// The "Waiting" rule is the factory's own (`isIssueStartable`), imported so both always agree.
import {
  AGENT_BRANCH_PREFIX,
  Label,
  closingReferences,
  isIssueStartable,
  readyLabelSetByOwner,
  type IssueEvent,
  type IssueState,
} from "../../../tools/factory/src/decisions.ts";

export const OWNER_BRIEF_MARKER = "<!-- factory:owner-brief -->";
export const NEEDS_OWNER_LABEL = "needs-owner";
export const NEEDS_TRIAGE_LABEL = "needs-triage";

export const CiState = { Success: "success", Failure: "failure", Pending: "pending", None: "none" } as const;
export type CiState = (typeof CiState)[keyof typeof CiState];

export const RunState = { Running: "running", Idle: "idle", Failed: "failed" } as const;
export type RunState = (typeof RunState)[keyof typeof RunState];

export const Hint = {
  ReadyToMerge: "ready to merge",
  CiFailing: "CI failing",
  NeedsFix: "needs a fix",
  ReviewRunning: "automated review running",
  CiRunning: "CI running",
  NeedsAttention: "needs your attention",
} as const;
export type Hint = (typeof Hint)[keyof typeof Hint];

/** What the GitHub layer hands over. Only fields the dashboard may show are read from it. */
export interface PullInput {
  number: number;
  title: string;
  url: string;
  headRef: string;
  labels: string[];
  body: string | null;
  createdAt: string;
  mergedAt: string | null;
  /** `null` while GitHub has not computed it yet. */
  mergeable: boolean | null;
  ci: CiState;
  /** State of the `agent-review` status of the head commit. */
  review: CiState;
  previewUrl: string | undefined;
  ownerBrief: string | undefined;
}

export interface BlockerInput {
  number: number;
  title: string;
  url: string;
}

export interface IssueInput {
  number: number;
  title: string;
  url: string;
  labels: string[];
  createdAt: string;
  openBlockers: BlockerInput[];
  events: IssueEvent[];
}

export interface RunInput {
  status: string;
  conclusion: string | null;
  startedAt: string;
  url: string;
}

export interface Snapshot {
  now: string;
  owner: string;
  tokenMissing: boolean;
  openPulls: PullInput[];
  mergedPulls: PullInput[];
  /** Open issues carrying one of the labels the dashboard looks at (pull requests excluded). */
  issues: IssueInput[];
  /** Names of the remote `agent/…` branches. */
  agentBranches: string[];
  factoryRun: RunInput | undefined;
  retroRun: RunInput | undefined;
}

export interface UpPull {
  number: number;
  title: string;
  url: string;
  linkedIssues: number[];
  blastRadius: "low" | "high" | "unrated";
  ci: CiState;
  hasConflict: boolean;
  previewUrl: string | null;
  ageMinutes: number;
  hint: Hint;
  recommendation: string | null;
}

export interface UpIssue {
  number: number;
  title: string;
  url: string;
  label: string;
  ageMinutes: number;
}

export interface RunStatus {
  state: RunState;
  since: string | null;
  url: string | null;
}

export interface InFlightItem {
  kind: "branch" | "pull";
  issue: number | null;
  title: string | null;
  ref: string;
  url: string;
}

export interface Holder {
  kind: "blocker" | "pull" | "branch";
  label: string;
  url: string | null;
}

export interface WaitingItem {
  number: number;
  title: string;
  url: string;
  startable: boolean;
  reason: string;
  holders: Holder[];
}

export interface TriageItem {
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface DonePull {
  number: number;
  title: string;
  url: string;
  mergedAt: string;
}

export interface Status {
  generatedAt: string;
  tokenMissing: boolean;
  repository: string;
  youAreUp: { pulls: UpPull[]; issues: UpIssue[] };
  running: { factory: RunStatus; retro: RunStatus | null; inFlight: InFlightItem[] };
  waiting: WaitingItem[];
  needsTriage: TriageItem[];
  doneToday: DonePull[];
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const AGENT_BRANCH = new RegExp(`^${AGENT_BRANCH_PREFIX}issue-(\\d+)-`);

function ageMinutes(from: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / MINUTE));
}

function issueOfBranch(ref: string): number | undefined {
  const match = AGENT_BRANCH.exec(ref);
  return match ? Number(match[1]) : undefined;
}

export function pullHint(pull: Pick<PullInput, "ci" | "review" | "mergeable" | "labels">): Hint {
  if (pull.mergeable === false) return Hint.NeedsFix;
  if (pull.ci === CiState.Failure) return Hint.CiFailing;
  if (pull.review === CiState.Pending || pull.review === CiState.None) return Hint.ReviewRunning;
  if (pull.review === CiState.Failure || pull.labels.includes(Label.NeedsHuman)) return Hint.NeedsAttention;
  if (pull.ci === CiState.Pending) return Hint.CiRunning;
  return Hint.ReadyToMerge;
}

function blastRadiusOf(labels: string[]): UpPull["blastRadius"] {
  if (labels.includes(Label.BlastRadiusHigh)) return "high";
  if (labels.includes(Label.BlastRadiusLow)) return "low";
  return "unrated";
}

/** The text of an owner brief comment (without its marker), if the comment is one. */
export function ownerBriefText(commentBody: string): string | undefined {
  if (!commentBody.startsWith(OWNER_BRIEF_MARKER)) return undefined;
  return commentBody.slice(OWNER_BRIEF_MARKER.length).trim() || undefined;
}

function upPull(pull: PullInput, now: string): UpPull {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.url,
    linkedIssues: closingReferences(pull.body).map((line) => Number(line.replace("Closes #", ""))),
    blastRadius: blastRadiusOf(pull.labels),
    ci: pull.ci,
    hasConflict: pull.mergeable === false,
    previewUrl: pull.previewUrl ?? null,
    ageMinutes: ageMinutes(pull.createdAt, now),
    hint: pullHint(pull),
    recommendation: pull.ownerBrief ?? null,
  };
}

function runStatus(run: RunInput | undefined): RunStatus {
  if (!run) return { state: RunState.Idle, since: null, url: null };
  const finished = run.status === "completed";
  const failed = run.conclusion === "failure" || run.conclusion === "timed_out";
  const state = !finished ? RunState.Running : failed ? RunState.Failed : RunState.Idle;
  return { state, since: run.startedAt, url: run.url };
}

function waitingItem(issue: IssueInput, snapshot: Snapshot): WaitingItem {
  const pulls = snapshot.openPulls.filter((pull) => issueOfBranch(pull.headRef) === issue.number);
  const branches = snapshot.agentBranches.filter((name) => issueOfBranch(name) === issue.number);
  const state: IssueState = {
    labels: issue.labels,
    openBlockers: issue.openBlockers.length,
    hasOpenPullRequest: pulls.length > 0,
    hasAgentBranch: branches.length > 0,
    readyLabelSetByOwner: readyLabelSetByOwner(issue.events, snapshot.owner),
  };
  const { startable, reason } = isIssueStartable(state);
  const holders: Holder[] = [
    ...issue.openBlockers.map((b): Holder => ({ kind: "blocker", label: `#${b.number} ${b.title}`, url: b.url })),
    ...pulls.map((p): Holder => ({ kind: "pull", label: `PR #${p.number}`, url: p.url })),
    ...branches.map((name): Holder => ({ kind: "branch", label: name, url: null })),
  ];
  return { number: issue.number, title: issue.title, url: issue.url, startable, reason, holders };
}

export function buildStatus(snapshot: Snapshot, repository: string): Status {
  const { now } = snapshot;
  const hasLabel = (labels: string[], ...wanted: string[]) => wanted.some((w) => labels.includes(w));
  const byAge = <T extends { createdAt: string }>(a: T, b: T) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

  const upPulls = snapshot.openPulls
    .filter((p) => hasLabel(p.labels, Label.NeedsHumanMerge, Label.NeedsHuman))
    .sort(byAge)
    .map((p) => upPull(p, now));
  const upIssues = snapshot.issues
    .filter((i) => hasLabel(i.labels, Label.NeedsHuman, NEEDS_OWNER_LABEL))
    .sort(byAge)
    .map((i): UpIssue => ({
      number: i.number,
      title: i.title,
      url: i.url,
      label: i.labels.includes(Label.NeedsHuman) ? Label.NeedsHuman : NEEDS_OWNER_LABEL,
      ageMinutes: ageMinutes(i.createdAt, now),
    }));

  const issueTitles = new Map(snapshot.issues.map((i) => [i.number, i.title]));
  const inFlight: InFlightItem[] = [
    ...snapshot.openPulls
      .filter((p) => p.headRef.startsWith(AGENT_BRANCH_PREFIX))
      .map((p): InFlightItem => ({ kind: "pull", issue: issueOfBranch(p.headRef) ?? null, title: p.title, ref: p.headRef, url: p.url })),
    ...snapshot.agentBranches
      .filter((name) => !snapshot.openPulls.some((p) => p.headRef === name))
      .map((name): InFlightItem => {
        const issue = issueOfBranch(name) ?? null;
        return { kind: "branch", issue, title: issue === null ? null : (issueTitles.get(issue) ?? null), ref: name, url: `https://github.com/${repository}/tree/${name}` };
      }),
  ];

  const waiting = snapshot.issues
    .filter((i) => i.labels.includes(Label.ReadyForAgent))
    .sort((a, b) => a.number - b.number)
    .map((i) => waitingItem(i, snapshot));

  const needsTriage = snapshot.issues
    .filter((i) => i.labels.includes(NEEDS_TRIAGE_LABEL))
    .sort((a, b) => byAge(b, a))
    .map((i): TriageItem => ({ number: i.number, title: i.title, url: i.url, createdAt: i.createdAt }));

  const doneToday = snapshot.mergedPulls
    .filter((p) => p.mergedAt !== null && Date.parse(now) - Date.parse(p.mergedAt) <= DAY)
    .sort((a, b) => Date.parse(b.mergedAt ?? "") - Date.parse(a.mergedAt ?? ""))
    .map((p): DonePull => ({ number: p.number, title: p.title, url: p.url, mergedAt: p.mergedAt ?? "" }));

  return {
    generatedAt: now,
    tokenMissing: snapshot.tokenMissing,
    repository,
    youAreUp: { pulls: upPulls, issues: upIssues },
    running: { factory: runStatus(snapshot.factoryRun), retro: snapshot.retroRun ? runStatus(snapshot.retroRun) : null, inFlight },
    waiting,
    needsTriage,
    doneToday,
  };
}
