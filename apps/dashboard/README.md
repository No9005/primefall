# Owner dashboard

One page that shows what needs the owner, what the factory runs, what is blocked, what needs triage and what was merged today. Plain TypeScript and HTML, no framework. The page polls `/api/status` every 60 seconds; the Vercel function `api/status.ts` reads GitHub with a read-only token and caches its answer for about 60 seconds (`s-maxage`, `stale-while-revalidate`), so all viewers share one set of GitHub calls.

- `src/status.ts`: pure functions from GitHub data to the status JSON. The "Waiting" rule is `isIssueStartable` from `tools/factory/src/decisions.ts`, imported, not copied.
- `src/github.ts`: the GitHub REST calls; copies only the fields the dashboard shows. The token goes into the `Authorization` header and nowhere else.
- `src/render.ts`, `src/main.ts`: the page. `?fixture` shows sample data without a token.

## Setup (owner)

1. Vercel: add a new project from this repository. Root Directory `apps/dashboard`; enable "Include source files outside of the Root Directory" (the page imports `tools/factory`).
2. GitHub: Settings, Developer settings, Fine-grained personal access tokens. Resource owner: you; repository access: only `No9005/primefall`; read-only permissions: Pull requests, Issues, Actions, Metadata (and Commit statuses / Checks for the CI state).
3. Vercel project, Settings, Environment Variables: `GITHUB_TOKEN` = that token (never commit it). Optionally `DASHBOARD_REPOSITORY` (default `No9005/primefall`).
4. Optional: switch on Vercel deployment protection so only you can open the page. Everything shown is public anyway.

Without `GITHUB_TOKEN` the function uses the unauthenticated GitHub API (60 calls per hour) and the page shows a hint. Running locally: `vercel dev` in this folder (the function needs the Vercel runtime); `npm run dev -w apps/dashboard` serves only the page, use `?fixture`.
