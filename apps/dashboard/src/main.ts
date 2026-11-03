import { fixtureStatus } from "./fixture.ts";
import { renderError, renderStatus } from "./render.ts";
import type { Status } from "./status.ts";

const POLL_MS = 60_000;
const root = document.getElementById("app");

async function loadStatus(): Promise<Status> {
  // `?fixture` shows sample data, for screenshots and for working on the layout without a token.
  if (new URLSearchParams(location.search).has("fixture")) return fixtureStatus();
  const response = await fetch("/api/status");
  if (!response.ok) throw new Error(`the function answered ${response.status}`);
  return (await response.json()) as Status;
}

async function refresh(): Promise<void> {
  if (!root) return;
  try {
    root.innerHTML = renderStatus(await loadStatus(), new Date().toISOString());
  } catch (error) {
    root.innerHTML = renderError(error instanceof Error ? error.message : "unknown error");
  }
}

void refresh();
setInterval(() => void refresh(), POLL_MS);
