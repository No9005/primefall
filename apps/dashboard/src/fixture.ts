import { buildStatus, CiState, type PullInput, type Snapshot, type Status } from "./status.ts";

const pull = (over: Partial<PullInput> & Pick<PullInput, "number" | "title">): PullInput => ({
  url: `https://github.com/No9005/primefall/pull/${over.number}`,
  headRef: `agent/issue-${over.number}-sample`,
  labels: ["needs-human-merge", "blast-radius:high"],
  body: `Closes #${over.number - 1}`,
  createdAt: "2026-11-03T08:00:00Z",
  mergedAt: null,
  mergeable: true,
  ci: CiState.Success,
  review: CiState.Success,
  previewUrl: undefined,
  ownerBrief: undefined,
  ...over,
});

const issue = (number: number, title: string, labels: string[], over: Partial<Snapshot["issues"][number]> = {}): Snapshot["issues"][number] => ({
  number,
  title,
  url: `https://github.com/No9005/primefall/issues/${number}`,
  labels,
  createdAt: "2026-11-02T10:00:00Z",
  openBlockers: [],
  events: [{ event: "labeled", actor: "No9005", label: "ready-for-agent" }],
  ...over,
});

/** Sample data for every block; also used by the tests. */
export function fixtureSnapshot(): Snapshot {
  return {
    now: "2026-11-03T12:00:00Z",
    owner: "No9005",
    tokenMissing: false,
    openPulls: [
      pull({ number: 177, title: "Owner dashboard", previewUrl: "https://primefall-dashboard.vercel.app", ownerBrief: "Merge after you set GITHUB_TOKEN in Vercel." }),
      pull({ number: 180, title: "Rework the card hand", ci: CiState.Failure }),
      pull({ number: 181, title: "Cover rules", mergeable: false }),
      pull({ number: 190, title: "Map editor", labels: [], headRef: "agent/issue-190-map" }),
    ],
    mergedPulls: [pull({ number: 170, title: "Hero tiles", mergedAt: "2026-11-03T09:30:00Z", labels: [] })],
    issues: [
      issue(200, "Sound effects", ["ready-for-agent"], { openBlockers: [{ number: 199, title: "Audio engine", url: "https://github.com/No9005/primefall/issues/199" }] }),
      issue(190, "Map editor", ["ready-for-agent"]),
      issue(201, "Pick a font", ["ready-for-agent"]),
      issue(202, "Tutorial", ["needs-human"]),
      issue(203, "Campaign idea", ["needs-triage"]),
    ],
    agentBranches: ["agent/issue-190-map", "agent/issue-177-dashboard"],
    factoryRun: { status: "in_progress", conclusion: null, startedAt: "2026-11-03T11:40:00Z", url: "https://github.com/No9005/primefall/actions/runs/1" },
    retroRun: { status: "completed", conclusion: "success", startedAt: "2026-11-02T18:00:00Z", url: "https://github.com/No9005/primefall/actions/runs/2" },
  };
}

export function fixtureStatus(): Status {
  return buildStatus(fixtureSnapshot(), "No9005/primefall");
}
