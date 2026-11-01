# Software factory

The factory turns unblocked `ready-for-agent` issues into pull requests and merges the low-risk ones automatically. A human decides every high-risk one. This page uses the terms of the `software-factory` skill. Setup steps are in `docs/agents/factory-setup.md`.

## Slots

| Service | Product |
|---|---|
| Ticket tracker | GitHub Issues (native blocking links) |
| Git host | GitHub |
| Orchestrator and runner | GitHub Actions with `anthropics/claude-code-action` |
| Continuous deployment | Vercel (preview per pull request, deploy from `main`) |
| Observability platform | None on purpose: the Actions run pages suffice |

The factory code (decisions and CLI) lives in `tools/factory`. The workflows are `factory-implement.yml` and `factory-pull-request.yml` next to `ci.yml`. The workflows always run the factory code and rules from the default branch, never from the pull request they judge.

## Tasks

| Task | Trigger | Does | Triggers next |
|---|---|---|---|
| **Implement** | The owner labels an issue `ready-for-agent`, or any issue closes, or the owner starts it by hand (Actions, "Factory implement", issue number) | Picks the first startable issue (below), then runs the agent. When an issue closes, every open `ready-for-agent` issue is checked, lowest number first, so tickets that became free earlier are not forgotten: own branch `agent/issue-<n>-<slug>` from `origin/main`, build, test, lint, pull request with `Closes #<n>` | Blast radius and Review (the pull request) |
| **Blast radius** | Pull request from an `agent/` branch opened or updated | Computes `low` or `high` from the diff with the rules in `tools/factory/blast-radius-rules.json`; sets one `blast-radius:*` label and a comment with the reasons | Review |
| **Review** | Same | A separate read-only run in a fresh context reviews the diff against the issue, `CLAUDE.md`, the ADRs, the glossary and the specs. It writes a result file; the CLI posts it as a review with inline comments and sets the status `agent-review`. It may raise the class to high, never lower it. It also runs for high-risk pull requests | Rework on fail, Merge gate on pass |
| **Rework** | `agent-review` failed and fewer than 2 reviews have failed | Fixes only what the review named, pushes, and runs the pipeline again for the new commit | Review. After the second failed review: label `needs-human`, no more runs |
| **Merge gate** | Review passed | Low and `AUTOMERGE_ENABLED=true`: enables GitHub's native auto-merge (squash). High: label `needs-human-merge` with a comment, no auto-merge | The merge closes the issue, which triggers Implement for the tickets it unblocked |

Agents never merge. Only the merge gate enables auto-merge, and GitHub merges once the rules of `main` are satisfied (CI, `agent-review`, Vercel preview, resolved conversations, code owner review where required).

## A startable issue

All of these must hold (`isIssueStartable`): it carries `ready-for-agent` and not `ready-for-human`; the latest `ready-for-agent` label was set by the repository owner; it has no open blocker; no run is marked `agent-working`; it has no open pull request from `agent/issue-<n>-…`; no `agent/issue-<n>-…` branch exists.

## Blast radius

High when any one applies (`classifyPullRequest`; the rules are in `tools/factory/blast-radius-rules.json`):

- It touches **design, decision, spec or agent files**: ADRs, specs, the design documents (`docs/design/**/*.md`), `GLOSSARY.md`, `CLAUDE.md`, `docs/agents` and `.claude` (skills). Other markdown (READMEs, process notes, the pitch) is low.
- It touches **the factory or tooling**: `.github`, `tools/factory`, lint and TypeScript configuration, any `package.json`, the lockfile (dependencies).
- It touches the **business logic of the rules package**, meaning how the game is resolved: everything under `packages/game-core/src` except card data (`cards.ts`), map data (`reactor-deck.ts`), the package exports (`index.ts`) and tests.
- The pull request or its ticket carries `high-risk`.

Everything else is low: other markdown, UI, rendering, assets, card and map data, tests and exports, however large the change. Size limits exist in the rules file as optional fields and are not set. A pull request that mixes low and high parts is high.

The reviewer may raise a pull request to high with a reason, only if the change alters how the game is resolved or affects the factory or agent behaviour in a way the path rules cannot see; card data, UI and test changes alone are not a reason. An existing high label is kept. The same paths are in `.github/CODEOWNERS` (a pattern without an owner removes ownership for data, exports and tests), so GitHub itself requires the owner's review for the high paths. A `high-risk` label cannot be expressed there: for it the merge gate simply never enables auto-merge.

### Review threads and earlier reviews

The review stays on the lines (inline comments). When a review **passes**, the factory tidies up after its own earlier reviews, with GraphQL calls (resolving a thread has no REST equivalent):

- Before the review run, `open-threads` lists the bot's own unresolved threads. The reviewer checks each against the **current code** and reports the ones that are demonstrably fixed, each with a concrete reason (`resolvedThreads`).
- The factory resolves only threads that the bot started and that are still open, only when the verdict is pass, and posts the reviewer's reason as a reply in the thread first, so the decision can be audited. A thread without a reason is not resolved. Threads of people are never touched.
- The bot's earlier failed reviews (for older commits) are collapsed as outdated, so a "fail" for an old commit no longer sits next to the current "pass".
- This is housekeeping: if a call fails, the review result is unchanged and the threads stay open for the owner to resolve by hand. A resolved thread can be reopened in the pull request.

### Switching the rating off

The repository variable `BLAST_RADIUS_ENABLED` set to `false` switches the rating off: no blast radius job, no labels or comments, the reviewer's "raise to high" is ignored, and the merge gate treats every pull request as low (old `blast-radius:*` labels are ignored too). The review itself still runs. Intended for the early MVP, when everything should merge cleanly; switch it back on later. It does not change GitHub's own enforcement (code owner review in the ruleset), see the setup guide.

## Brakes

- **Automated checks:** CI (lint, type check, tests) on every pull request.
- **Automated review:** the separate review run above.
- **Human review:** every high-risk pull request, and every pull request while `AUTOMERGE_ENABLED` is not `true` (phase 0).
- **Throttle and caps:** one implement run at a time; at most one run per issue; two failed reviews hand over to a human; a kill switch (`FACTORY_ENABLED`).
- **Run limits:** every Claude run uses `claude-sonnet-5-5` with medium effort. Implement 30 minutes and 80 turns, Rework 20 minutes and 40 turns, Review 15 minutes and 30 turns. These are starting values: change `timeout-minutes` and `--max-turns` in the workflows after the first runs.

## The five questions per task

1. **Trigger:** see the table. All triggers react only to the owner (label events, manual starts) or to pull requests from `agent/` branches of this repository.
2. **Reads and writes:** issues, labels, comments, pull requests, reviews and commit statuses on GitHub; branches and commits for Implement and Rework.
3. **Triggers next:** see the table.
4. **Where a human re-enters:** setting `ready-for-agent`; every high-risk merge; `needs-human` pull requests; the switch to automatic merging; the kill switch. A run never waits for a human: it ends, and the human's change starts the next run.
5. **What stops duplicates:** one global implement run at a time, `agent-working` label, the open-pull-request and agent-branch checks, and one concurrency group per pull request (a newer run cancels an older one). GitHub keeps only the newest waiting run per concurrency group, so a ticket whose run was replaced while waiting starts at the next closed issue, or when it is started by hand.

## Known limits

- The pipeline files are validated by reading and by unit tests of the decision logic, not by real runs. The setup guide has a first-run checklist.
- An implement run that ends without a branch or pull request (for example because the agent was denied a command it needed) is reported on the issue: a comment with the run link, the denied commands and the agent's last message, and the label `needs-human`. A `needs-human` issue is not started again automatically; remove the label to retry.
- A review run that writes a result file with unusable content counts as a failed review. A review that never ran (no result file) is reported as `agent-review: error` with a comment and does not count as a failed review and does not start a rework. The Claude action skips itself when the workflow files of the branch differ from the default branch (for example for pull requests that change a workflow, or an agent branch that was cut before the workflows changed on `main`); update the branch with `main` or start "Factory pull request" by hand.
- Pull requests opened by humans are not handled by the factory.
