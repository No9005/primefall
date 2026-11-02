# Software factory

The factory turns unblocked `ready-for-agent` issues into pull requests and merges the low-risk ones automatically. A human decides every high-risk one. The terms (task, trigger, run, runner, orchestrator) are used as in the tables below. Setup steps are in `docs/agents/factory-setup.md`.

## Slots

| Service | Product |
|---|---|
| Ticket tracker | GitHub Issues (native blocking links) |
| Git host | GitHub |
| Orchestrator and runner | GitHub Actions with `anthropics/claude-code-action` |
| Continuous deployment | Vercel (preview per pull request, deploy from `main`) |
| Observability platform | None on purpose: the Actions run pages suffice |

The factory code (decisions and CLI) lives in `tools/factory`. The workflows are `factory.yml` (the pipeline) and `factory-retro.yml` next to `ci.yml`; the review and rework steps are composite actions in `.github/actions`, always loaded from `main`. The factory code and rules that judge a pull request come from a copy of the default branch taken before the agent runs, never from the pull request.

## How it runs

One run of `factory.yml` takes one ticket from start to end; nothing is handed over between workflows. Events caused by the workflow token (a merge by auto-merge, a closed issue, a push) start no workflows, so every step that used to rely on such an event is now a step inside the same run. When a run is done it starts itself again with `workflow_dispatch`, which the workflow token may do, and it ends when no ticket is startable.

**Triggers** (all by the owner): the label `ready-for-agent` is set; the label `needs-human` is removed; an `agent/` pull request is merged by the owner; "Run workflow" by hand (no input; it scans all tickets). The run before it, if any, finishes first (one concurrency group, GitHub keeps one waiting run, and every run scans all tickets, so no event is lost).

## Steps of a run

| Step | Does |
|---|---|
| **Select** | Picks the lowest startable issue (below). None: the run ends |
| **Implement** | The agent works on its own branch `agent/issue-<n>-<slug>` from `origin/main`: build, test, lint, pull request with `Closes #<n>`. The status of the agent step is not trusted; a check afterwards looks for the branch and the pull request. None: the issue gets `needs-human` with the denied commands and the agent's last message |
| **Blast radius** | Computes `low` or `high` from the diff with the rules in `tools/factory/blast-radius-rules.json`; one `blast-radius:*` label and a comment with the reasons |
| **Review** | A separate read-only agent session (a new session for every step) reviews the diff against the issue, `CLAUDE.md`, the ADRs, the glossary and the specs. The CLI posts it as a review with inline comments and sets the status `agent-review`. It may raise the class to high, never lower it. A review that wrote no usable result did not run: it is repeated once, then a human takes over |
| **Rework** | After a failed review: a new session fixes only what the review named and pushes. No new commit: the pull request gets `needs-human` with what the run was denied. Then a second review. A second failed review: `needs-human` |
| **Merge gate** | Review passed. Low and `AUTOMERGE_ENABLED=true`: enables native auto-merge (squash, with the closing keywords as body); the run waits up to 40 minutes for the merge, closes the issue and tells the retro. High: label `needs-human-merge`, the owner merges |
| **Next** | A failed run labels the issue `needs-human`. Whatever happened, the run starts the next ticket |

**Retro** (`factory-retro.yml`): after an `agent/` pull request is merged, by the owner (event) or by the pipeline (dispatch), and the number of merged `agent/` pull requests (retro pull requests not counted) is a multiple of `RETRO_EVERY` (default 10, `0` = off), or when the owner starts it by hand. A run reads the last N merged agent pull requests (issues, reviews, rework, labels, the owner's comments) and looks for a mistake that appears at least twice or that the owner corrected. If it finds one it opens `agent/retro-<n>` with changes to `CLAUDE.md` or other agent instructions, each tied to the pull requests that motivated it; otherwise it only comments on the latest pull request. It cannot push workflow files and never touches the blast radius rules, `CODEOWNERS`, ADRs, specs or the glossary. The pipeline does not handle the retro pull request: the owner decides.

Agents never merge. Only the merge gate enables auto-merge, and GitHub merges once the rules of `main` are satisfied (CI, `agent-review`, Vercel preview, resolved conversations, code owner review where required).

## A startable issue

All of these must hold (`isIssueStartable`): it carries `ready-for-agent` and not `ready-for-human`; the latest `ready-for-agent` label was set by the repository owner; it has no open blocker; no run is marked `agent-working`; it has no open pull request from `agent/issue-<n>-…`; no `agent/issue-<n>-…` branch exists.

## Blast radius

The path rules are the single source of truth in `tools/factory/blast-radius-rules.json`; `.github/CODEOWNERS` mirrors them so GitHub itself requires the owner's review (keep them in step by hand). Do not list the paths anywhere else. In short: a pull request is **high** when it touches design, decision, spec or agent files, the factory or tooling (and, once the MVP is done, the business logic of the rules package; see below), or when the pull request or its ticket carries `high-risk`. Everything else (other markdown, UI, rendering, assets, the rules package, card and map data, tests, exports) is **low**, however large. A pull request that mixes low and high parts is high. **MVP setting:** `businessLogicPaths` is empty, so changes to `packages/game-core` merge without the owner (CI, tests and the automated review are the brakes). After the MVP, restore `["packages/game-core/src/**"]` in the rules file and the matching lines in `CODEOWNERS` (the code then counts as high again, with data, exports and tests as exceptions). Size limits exist in the rules file as optional fields and are not set.

The reviewer may raise a pull request to high with a reason, only if the change affects the factory or agent behaviour in a way the path rules cannot see; game rules, card data, UI and test changes alone are not a reason during the MVP. An existing high label is kept. A `high-risk` label cannot be expressed in `CODEOWNERS`: for it the merge gate simply never enables auto-merge.

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
- **Automated review:** the separate review session above.
- **Human review:** every high-risk pull request, and every pull request while `AUTOMERGE_ENABLED` is not `true` (phase 0).
- **Throttle and caps:** one ticket at a time; one rework per pull request; a kill switch (`FACTORY_RUN_ENABLED`).
- **Run limits:** every Claude step uses `claude-sonnet-5-5` with medium effort. Implement 80 turns, Rework 40, Review 30; the whole job times out after 150 minutes. Change `--max-turns` and `timeout-minutes` in the workflow if the first runs need it.

## Where a human re-enters

Setting `ready-for-agent`; every high-risk merge; `needs-human` issues and pull requests (remove the label to try again); the switch to automatic merging; the kill switch. A run never waits for a human: it ends, and the human's change starts the next run.

## Known limits

- A run that dies midway (a cancelled or crashed job) leaves its ticket with a branch or a pull request, so it is not startable again; handle it by hand and start the factory with "Run workflow". A failing step inside a run is handled (`needs-human`).
- The Claude action skips itself when the workflow files differ from the default branch. A change to `factory.yml` or to the actions can therefore only be tested after it is on `main`.
- The review and rework composite actions are referenced as `No9005/primefall/.github/actions/...@main`; a fork or rename needs these two references changed.
- The agents cannot push `.github/workflows/*`: the Claude GitHub App has no `workflows` permission, and granting it would let an agent change what runs with the repository's secrets before any review. Workflow changes are made by the owner or in a chat session and reviewed by the owner. An implement run that needs one ends without a pull request and is reported on the issue.
- Only pull requests from `agent/` branches of this repository are handled.
- The merge by auto-merge needs CI and the other required checks to pass; the run waits 40 minutes at most and then leaves the pull request to GitHub (the issue is then closed by the owner's or the next run's scan only if its pull request closed it).
