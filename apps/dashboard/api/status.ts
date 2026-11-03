// Vercel function: one JSON status for everybody, cached at the edge so viewers share one set of GitHub calls.
import { collectSnapshot } from "../src/github.ts";
import { buildStatus } from "../src/status.ts";

const DEFAULT_REPOSITORY = "No9005/primefall";
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(): Promise<Response> {
  const repository = process.env.DASHBOARD_REPOSITORY || DEFAULT_REPOSITORY;
  try {
    const snapshot = await collectSnapshot({ repo: repository, token: process.env.GITHUB_TOKEN || undefined, fetcher: fetch, now: new Date() });
    return Response.json(buildStatus(snapshot, repository), { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/Bearer\s+\S+/g, "") : "unknown error";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
