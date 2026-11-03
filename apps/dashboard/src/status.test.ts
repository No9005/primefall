import { describe, expect, it } from "vitest";
import { fixtureSnapshot } from "./fixture.ts";
import { buildStatus, CiState, Hint, RunState, type Snapshot } from "./status.ts";

const build = (change: (s: Snapshot) => void = () => {}) => {
  const snapshot = fixtureSnapshot();
  change(snapshot);
  return buildStatus(snapshot, "No9005/primefall");
};
const emptySnapshot = (): Snapshot => ({ ...fixtureSnapshot(), openPulls: [], mergedPulls: [], issues: [], agentBranches: [], factoryRun: undefined, retroRun: undefined });

describe("You are up", () => {
  it("shows a ready pull request with its facts and the owner brief", () => {
    const pull = build().youAreUp.pulls.find((p) => p.number === 177);
    expect(pull).toMatchObject({
      hint: Hint.ReadyToMerge,
      ci: CiState.Success,
      hasConflict: false,
      blastRadius: "high",
      linkedIssues: [176],
      previewUrl: "https://primefall-dashboard.vercel.app",
      recommendation: "Merge after you set GITHUB_TOKEN in Vercel.",
      ageMinutes: 240,
    });
  });

  it("hints that CI is failing", () => {
    expect(build().youAreUp.pulls.find((p) => p.number === 180)?.hint).toBe(Hint.CiFailing);
  });

  it("hints that a pull request with conflicts needs a fix", () => {
    const pull = build().youAreUp.pulls.find((p) => p.number === 181);
    expect(pull).toMatchObject({ hint: Hint.NeedsFix, hasConflict: true });
  });

  it("hints that the automated review is still running", () => {
    const status = build((s) => {
      s.openPulls[0]!.review = CiState.Pending;
    });
    expect(status.youAreUp.pulls.find((p) => p.number === 177)?.hint).toBe(Hint.ReviewRunning);
  });

  it("lists only pull requests that need the owner, plus needs-human issues", () => {
    const status = build();
    expect(status.youAreUp.pulls.map((p) => p.number)).toEqual([177, 180, 181]);
    expect(status.youAreUp.issues.map((i) => i.number)).toEqual([202]);
  });
});

describe("Running", () => {
  it("reports the factory run state and the work in flight", () => {
    const { running } = build();
    expect(running.factory.state).toBe(RunState.Running);
    expect(running.retro?.state).toBe(RunState.Idle);
    expect(running.inFlight.map((f) => f.ref).sort()).toEqual(["agent/issue-177-dashboard", "agent/issue-181-sample", "agent/issue-190-map", "agent/issue-177-sample", "agent/issue-180-sample"].sort());
  });

  it("reports a failed run and no retro", () => {
    const { running } = build((s) => {
      s.factoryRun = { status: "completed", conclusion: "failure", startedAt: "2026-11-03T11:00:00Z", url: "u" };
      s.retroRun = undefined;
    });
    expect(running.factory.state).toBe(RunState.Failed);
    expect(running.retro).toBeNull();
  });
});

describe("Waiting", () => {
  const item = (n: number) => build().waiting.find((w) => w.number === n)!;

  it("holds a ticket back while a blocker is open", () => {
    expect(item(200)).toMatchObject({ startable: false, holders: [{ kind: "blocker", label: "#199 Audio engine" }] });
  });

  it("holds a ticket back while a pull request is open", () => {
    expect(item(190).holders.map((h) => h.kind)).toContain("pull");
    expect(item(190).startable).toBe(false);
  });

  it("holds a ticket back while only an agent branch exists", () => {
    const status = build((s) => {
      s.openPulls = [];
    });
    expect(status.waiting.find((w) => w.number === 190)).toMatchObject({ startable: false, holders: [{ kind: "branch", label: "agent/issue-190-map" }] });
  });

  it("marks a free ticket as startable", () => {
    expect(item(201)).toMatchObject({ startable: true, holders: [] });
  });

  it("does not start a ticket whose ready label the owner did not set", () => {
    const status = build((s) => {
      s.issues.find((i) => i.number === 201)!.events = [{ event: "labeled", actor: "someone", label: "ready-for-agent" }];
    });
    expect(status.waiting.find((w) => w.number === 201)?.startable).toBe(false);
  });
});

describe("Needs triage and Done today", () => {
  it("lists needs-triage issues, newest first", () => {
    const status = build((s) => {
      s.issues.push({ ...s.issues[0]!, number: 300, labels: ["needs-triage"], createdAt: "2026-11-03T01:00:00Z" });
    });
    expect(status.needsTriage.map((t) => t.number)).toEqual([300, 203]);
  });

  it("lists only pull requests merged in the last 24 hours", () => {
    const status = build((s) => {
      s.mergedPulls.push({ ...s.mergedPulls[0]!, number: 150, mergedAt: "2026-11-01T09:00:00Z" });
    });
    expect(status.doneToday.map((d) => d.number)).toEqual([170]);
  });
});

describe("empty state", () => {
  it("builds every block empty", () => {
    const status = buildStatus(emptySnapshot(), "No9005/primefall");
    expect(status.youAreUp).toEqual({ pulls: [], issues: [] });
    expect(status.running).toEqual({ factory: { state: RunState.Idle, since: null, url: null }, retro: null, inFlight: [] });
    expect(status.waiting).toEqual([]);
    expect(status.needsTriage).toEqual([]);
    expect(status.doneToday).toEqual([]);
  });
});
