// Turns a Status into HTML. Pure (the clock is a parameter) so it can be tested and screenshotted from a fixture.
import { RunState, type Hint, type Holder, type RunStatus, type Status } from "./status.ts";

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** "5 min", "3 h", "2 d": the coarse age the owner needs to judge how stale something is. */
export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} d`;
}

const minutesBetween = (from: string, now: string) => Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));

const link = (url: string, text: string) => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
const empty = (text: string) => `<p class="empty">${escapeHtml(text)}</p>`;
const list = (items: string[], emptyText: string) => (items.length === 0 ? empty(emptyText) : `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`);
const section = (id: string, title: string, body: string) => `<section id="${id}"><h2>${escapeHtml(title)}</h2>${body}</section>`;

const HINT_CLASS: Record<Hint, string> = {
  "ready to merge": "good",
  "CI failing": "bad",
  "needs a fix": "bad",
  "automated review running": "wait",
  "CI running": "wait",
  "needs your attention": "bad",
};

function holder(h: Holder): string {
  return h.url ? link(h.url, h.label) : escapeHtml(h.label);
}

function run(name: string, status: RunStatus | null, now: string): string {
  if (!status) return "";
  const since = status.since ? ` since ${formatAge(minutesBetween(status.since, now))} ago` : "";
  const text = `${name}: ${status.state}${since}`;
  return `<p class="run ${status.state === RunState.Failed ? "bad" : status.state === RunState.Running ? "wait" : ""}">${status.url ? link(status.url, text) : escapeHtml(text)}</p>`;
}

function renderUp(status: Status): string {
  const pulls = status.youAreUp.pulls.map((p) => {
    const facts = [
      `blast radius ${p.blastRadius}`,
      `CI ${p.ci}`,
      p.hasConflict ? "merge conflicts" : "no conflicts",
      ...(p.linkedIssues.length > 0 ? [`closes ${p.linkedIssues.map((n) => `#${n}`).join(", ")}`] : []),
      formatAge(p.ageMinutes),
    ];
    return [
      `<strong>${link(p.url, `#${p.number} ${p.title}`)}</strong>`,
      `<span class="hint ${HINT_CLASS[p.hint]}">${escapeHtml(p.hint)}</span>`,
      `<span class="facts">${facts.map(escapeHtml).join(" · ")}</span>`,
      p.previewUrl ? `<span class="facts">${link(p.previewUrl, "preview")}</span>` : "",
      p.recommendation ? `<blockquote>${escapeHtml(p.recommendation)}</blockquote>` : "",
    ].join("");
  });
  const issues = status.youAreUp.issues.map(
    (i) => `<strong>${link(i.url, `#${i.number} ${i.title}`)}</strong><span class="hint bad">${escapeHtml(i.label)}</span><span class="facts">${formatAge(i.ageMinutes)}</span>`,
  );
  return section("up", "You are up", list([...pulls, ...issues], "Nothing waits for you."));
}

function renderRunning(status: Status, now: string): string {
  const { factory, retro, inFlight } = status.running;
  const items = inFlight.map((f) => {
    const what = [f.issue === null ? f.ref : `#${f.issue}`, f.title].filter(Boolean).join(" ");
    return `${link(f.url, what)}<span class="facts">${f.kind === "pull" ? "pull request" : "branch"} ${escapeHtml(f.ref)}</span>`;
  });
  return section("running", "Running", run("Factory", factory, now) + run("Retro", retro, now) + `<h3>In flight</h3>${list(items, "No agent branch or pull request is open.")}`);
}

function renderWaiting(status: Status): string {
  const items = status.waiting.map((w) => {
    const held = w.holders.length > 0 ? `<span class="facts">held by ${w.holders.map(holder).join(", ")}</span>` : "";
    const state = w.startable ? `<span class="hint good">startable</span>` : `<span class="hint wait">${escapeHtml(w.reason)}</span>`;
    return `<strong>${link(w.url, `#${w.number} ${w.title}`)}</strong>${state}${held}`;
  });
  return section("waiting", "Waiting", list(items, "No ticket is labelled ready-for-agent."));
}

function renderTriage(status: Status): string {
  return section("triage", "Needs triage", list(status.needsTriage.map((t) => link(t.url, `#${t.number} ${t.title}`)), "Nothing to triage."));
}

function renderDone(status: Status): string {
  return section("done", "Done today", list(status.doneToday.map((d) => link(d.url, `#${d.number} ${d.title}`)), "Nothing merged in the last 24 hours."));
}

export function renderStatus(status: Status, now: string): string {
  const hint = status.tokenMissing
    ? `<p class="banner">No GITHUB_TOKEN is set: the public API is used with a low rate limit, so data may fail to load.</p>`
    : "";
  const age = `<p class="age">Data is ${formatAge(minutesBetween(status.generatedAt, now))} old · ${escapeHtml(status.repository)}</p>`;
  return hint + age + renderUp(status) + renderRunning(status, now) + renderWaiting(status) + renderTriage(status) + renderDone(status);
}

export function renderError(message: string): string {
  return `<p class="banner bad" role="alert">The status could not be loaded: ${escapeHtml(message)}. Trying again in a minute.</p>`;
}
