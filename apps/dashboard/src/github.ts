// Reads GitHub's REST API and maps the answers to the small `Snapshot` the pure code works on.
// Only fields the dashboard shows are copied; the token is used for the Authorization header and nowhere else.
import { Label, type IssueEvent } from "../../../tools/factory/src/decisions.ts";
import {
  CiState,
  NEEDS_OWNER_LABEL,
  NEEDS_TRIAGE_LABEL,
  ownerBriefText,
  type BlockerInput,
  type IssueInput,
  type PullInput,
  type RunInput,
  type Snapshot,
} from "./status.ts";

export type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

interface ApiLabel { name: string }
interface ApiPull {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  created_at: string;
  merged_at: string | null;
  labels: ApiLabel[];
  head: { ref: string; sha: string };
  mergeable?: boolean | null;
}
interface ApiIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  labels: ApiLabel[];
  pull_request?: unknown;
}
interface ApiBlocker { number: number; title: string; html_url: string; state: string }
interface ApiEvent { event: string; actor?: { login: string } | null; label?: { name: string } }
interface ApiComment { body: string; user: { login: string } | null }
interface ApiCheckRuns { check_runs: { status: string; conclusion: string | null }[] }
interface ApiStatuses { statuses: { context: string; state: string }[] }
interface ApiRuns { workflow_runs: { status: string; conclusion: string | null; run_started_at?: string; created_at: string; html_url: string }[] }

const ISSUE_LABELS = [Label.NeedsHuman, NEEDS_OWNER_LABEL, Label.ReadyForAgent, NEEDS_TRIAGE_LABEL];
const REVIEW_CONTEXT = "agent-review";
const VERCEL_URL = /https:\/\/[\w.-]+\.vercel\.app\S*/;
const PAGE = "per_page=100";

class GitHub {
  private readonly repo: string;
  private readonly token: string | undefined;
  private readonly fetcher: Fetcher;

  constructor(repo: string, token: string | undefined, fetcher: Fetcher) {
    this.repo = repo;
    this.token = token;
    this.fetcher = fetcher;
  }

  async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await this.fetcher(`https://api.github.com/repos/${this.repo}${path}`, { headers });
    if (!response.ok) throw new Error(`GitHub ${path} answered ${response.status}`);
    return (await response.json()) as T;
  }

  /** For calls whose failure should not take the whole page down. */
  async getOr<T>(path: string, fallback: T): Promise<T> {
    try {
      return await this.get<T>(path);
    } catch {
      return fallback;
    }
  }
}

const names = (labels: ApiLabel[]) => labels.map((l) => l.name);

function runState(run: ApiCheckRuns["check_runs"][number]): CiState {
  if (run.status !== "completed") return CiState.Pending;
  return ["success", "neutral", "skipped"].includes(run.conclusion ?? "") ? CiState.Success : CiState.Failure;
}

function statusState(status: ApiStatuses["statuses"][number]): CiState {
  if (status.state === "success") return CiState.Success;
  return status.state === "pending" ? CiState.Pending : CiState.Failure;
}

function checksState(runs: ApiCheckRuns["check_runs"], statuses: ApiStatuses["statuses"]): CiState {
  const states = [...runs.map(runState), ...statuses.map(statusState)];
  if (states.length === 0) return CiState.None;
  if (states.includes(CiState.Failure)) return CiState.Failure;
  return states.includes(CiState.Pending) ? CiState.Pending : CiState.Success;
}

function pullInput(pull: ApiPull): PullInput {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    headRef: pull.head.ref,
    labels: names(pull.labels),
    body: pull.body,
    createdAt: pull.created_at,
    mergedAt: pull.merged_at,
    mergeable: null,
    ci: CiState.None,
    review: CiState.None,
    previewUrl: undefined,
    ownerBrief: undefined,
  };
}

/** Adds what only the owner's own pull requests need: conflicts, CI, review, preview link and brief. */
async function enrichPull(github: GitHub, pull: PullInput, sha: string): Promise<PullInput> {
  const [detail, checks, combined, comments] = await Promise.all([
    github.getOr<ApiPull | undefined>(`/pulls/${pull.number}`, undefined),
    github.getOr<ApiCheckRuns>(`/commits/${sha}/check-runs?${PAGE}`, { check_runs: [] }),
    github.getOr<ApiStatuses>(`/commits/${sha}/status`, { statuses: [] }),
    github.getOr<ApiComment[]>(`/issues/${pull.number}/comments?${PAGE}`, []),
  ]);
  const review = combined.statuses.find((s) => s.context === REVIEW_CONTEXT);
  const otherStatuses = combined.statuses.filter((s) => s.context !== REVIEW_CONTEXT);
  const brief = comments.map((c) => ownerBriefText(c.body)).filter((text) => text !== undefined).at(-1);
  const preview = comments.filter((c) => c.user?.login === "vercel[bot]").map((c) => VERCEL_URL.exec(c.body)?.[0]).find((url) => url !== undefined);
  return {
    ...pull,
    mergeable: detail?.mergeable ?? null,
    ci: checksState(checks.check_runs, otherStatuses),
    review: review ? checksState([], [review]) : CiState.None,
    previewUrl: preview,
    ownerBrief: brief,
  };
}

async function issueInput(github: GitHub, issue: ApiIssue): Promise<IssueInput> {
  const labels = names(issue.labels);
  const isReady = labels.includes(Label.ReadyForAgent);
  // Blockers and the label events only matter for tickets the factory could start.
  const [blockers, events] = await Promise.all([
    isReady ? github.getOr<ApiBlocker[]>(`/issues/${issue.number}/dependencies/blocked_by`, []) : [],
    isReady ? github.getOr<ApiEvent[]>(`/issues/${issue.number}/events?${PAGE}`, []) : [],
  ]);
  const openBlockers: BlockerInput[] = blockers
    .filter((b) => b.state === "open")
    .map((b) => ({ number: b.number, title: b.title, url: b.html_url }));
  const mapped: IssueEvent[] = events.map((e) => ({ event: e.event, actor: e.actor?.login, label: e.label?.name }));
  return { number: issue.number, title: issue.title, url: issue.html_url, labels, createdAt: issue.created_at, openBlockers, events: mapped };
}

async function latestRun(github: GitHub, workflow: string): Promise<RunInput | undefined> {
  const runs = await github.getOr<ApiRuns>(`/actions/workflows/${workflow}/runs?per_page=1`, { workflow_runs: [] });
  const run = runs.workflow_runs[0];
  return run && { status: run.status, conclusion: run.conclusion, startedAt: run.run_started_at ?? run.created_at, url: run.html_url };
}

export async function collectSnapshot(input: { repo: string; token: string | undefined; fetcher: Fetcher; now: Date }): Promise<Snapshot> {
  const github = new GitHub(input.repo, input.token, input.fetcher);
  const owner = input.repo.split("/")[0] ?? "";
  const [openPulls, closedPulls, branches, factoryRun, retroRun, ...issueLists] = await Promise.all([
    github.get<ApiPull[]>(`/pulls?state=open&${PAGE}`),
    github.get<ApiPull[]>(`/pulls?state=closed&sort=updated&direction=desc&per_page=50`),
    github.getOr<{ ref: string }[]>(`/git/matching-refs/heads/agent/?${PAGE}`, []),
    latestRun(github, "factory.yml"),
    latestRun(github, "factory-retro.yml"),
    ...ISSUE_LABELS.map((label) => github.get<ApiIssue[]>(`/issues?state=open&labels=${label}&${PAGE}`)),
  ]);

  const issuesByNumber = new Map<number, ApiIssue>();
  for (const issue of issueLists.flat()) if (!issue.pull_request) issuesByNumber.set(issue.number, issue);

  const needsOwner = (labels: string[]) => labels.includes(Label.NeedsHumanMerge) || labels.includes(Label.NeedsHuman);
  const open = await Promise.all(openPulls.map((p) => (needsOwner(names(p.labels)) ? enrichPull(github, pullInput(p), p.head.sha) : pullInput(p))));

  return {
    now: input.now.toISOString(),
    owner,
    tokenMissing: input.token === undefined,
    openPulls: open,
    mergedPulls: closedPulls.filter((p) => p.merged_at !== null).map(pullInput),
    issues: await Promise.all([...issuesByNumber.values()].map((issue) => issueInput(github, issue))),
    agentBranches: branches.map((b) => b.ref.replace(/^refs\/heads\//, "")),
    factoryRun,
    retroRun,
  };
}
