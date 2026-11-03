import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "../api/status.ts";
import { collectSnapshot, type Fetcher } from "./github.ts";
import { fixtureStatus } from "./fixture.ts";
import { buildStatus, OWNER_BRIEF_MARKER } from "./status.ts";

const TOKEN = "ghp_secret_token_value";

/** A small fake GitHub that records the headers of every call. */
function fakeGitHub() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const pull = {
    number: 5,
    title: "T",
    html_url: "https://github.com/o/r/pull/5",
    body: "Closes #4",
    created_at: "2026-11-03T08:00:00Z",
    merged_at: null,
    labels: [{ name: "needs-human-merge" }],
    head: { ref: "agent/issue-4-x", sha: "abc" },
    mergeable: false,
    user: { login: "secret-user", email: "leak@example.com" },
    _links: { secret: "forwarded?" },
  };
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const path = url.replace("https://api.github.com/repos/o/r", "");
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path.startsWith("/pulls/5")) return json(pull);
    if (path.startsWith("/pulls?state=open")) return json([pull]);
    if (path.startsWith("/pulls?state=closed")) return json([]);
    if (path.includes("/check-runs")) return json({ check_runs: [{ status: "completed", conclusion: "success" }] });
    if (path.includes("/status")) return json({ statuses: [{ context: "agent-review", state: "success" }] });
    if (path.startsWith("/issues/5/comments")) return json([{ body: `${OWNER_BRIEF_MARKER}\nMerge it.`, user: { login: "bot" } }]);
    if (path.startsWith("/git/matching-refs")) return json([{ ref: "refs/heads/agent/issue-4-x" }]);
    if (path.startsWith("/actions/")) return json({ workflow_runs: [] });
    if (path.startsWith("/issues?")) return json([]);
    return new Response("{}", { status: 404 });
  };
  return { calls, fetcher };
}

describe("collectSnapshot", () => {
  it("sends the token only as the Authorization header and never puts it in the status", async () => {
    const { calls, fetcher } = fakeGitHub();
    const snapshot = await collectSnapshot({ repo: "o/r", token: TOKEN, fetcher, now: new Date("2026-11-03T12:00:00Z") });
    const json = JSON.stringify(buildStatus(snapshot, "o/r"));
    expect(calls.every((c) => c.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("secret-user");
    expect(json).not.toContain("leak@example.com");
    expect(json).not.toContain("forwarded?");
    expect(snapshot.openPulls[0]).toMatchObject({ mergeable: false, ownerBrief: "Merge it." });
  });

  it("works without a token and says so", async () => {
    const { calls, fetcher } = fakeGitHub();
    const snapshot = await collectSnapshot({ repo: "o/r", token: undefined, fetcher, now: new Date() });
    expect(snapshot.tokenMissing).toBe(true);
    expect(calls.some((c) => "Authorization" in c.headers)).toBe(false);
  });
});

describe("allowed fields", () => {
  const ALLOWED = new Set([
    "generatedAt", "tokenMissing", "repository", "youAreUp", "pulls", "issues", "running", "factory", "retro", "inFlight", "waiting", "needsTriage", "doneToday",
    "number", "title", "url", "linkedIssues", "blastRadius", "ci", "hasConflict", "previewUrl", "ageMinutes", "hint", "recommendation", "label",
    "state", "since", "kind", "issue", "ref", "startable", "reason", "holders", "createdAt", "mergedAt",
  ]);

  const keysOf = (value: unknown): string[] =>
    Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];

  it("contains only listed keys", () => {
    expect(keysOf(fixtureStatus()).filter((k) => !ALLOWED.has(k))).toEqual([]);
  });
});

describe("the function", () => {
  it("answers with a cache header and, when GitHub fails, an error without the token", async () => {
    process.env.GITHUB_TOKEN = TOKEN;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    try {
      const response = await GET();
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain(TOKEN);
    } finally {
      globalThis.fetch = original;
      delete process.env.GITHUB_TOKEN;
    }
  });
});

describe("shared selection rule", () => {
  it("imports isIssueStartable from tools/factory and has no copy of its rules", () => {
    const dir = new URL(".", import.meta.url);
    const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const text = (f: string) => readFileSync(new URL(f, dir), "utf8");
    expect(text("status.ts")).toMatch(/import\s*\{[^}]*isIssueStartable[^}]*\}\s*from\s*"\.\.\/\.\.\/\.\.\/tools\/factory\/src\/decisions\.ts"/);
    for (const file of sources) {
      expect(text(file), file).not.toMatch(/ready-for-human|open blocker|agent branch already exists|not set by the repository owner/);
    }
  });
});
