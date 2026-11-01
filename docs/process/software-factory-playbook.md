# Software factory: learnings, changes and a rebuild guide

How the Primefall software factory came to be, what changed after it was first built, and what it takes to build the same thing in another project. The design as it stands is in `docs/agents/software-factory.md` and the operation in `docs/agents/factory-setup.md`; this page is the history and the lessons behind them. It continues `docs/process/claude-code-session-log.md`, which covers the session up to the first factory runs.

The factory runs on GitHub (Issues, Actions, rulesets) with the Claude Code GitHub Action. Everything below is written so that another project can copy the structure and know where the traps are.

## 1. What the factory is

A set of **tasks**; each is a GitHub Actions job started by an event, and none waits for a human:

| Task | Starts when | Result |
|---|---|---|
| Implement | The owner labels an issue `ready-for-agent`, any issue closes, or by hand | A branch `agent/issue-<n>-<slug>` and a pull request with `Closes #<n>` |
| Blast radius | Pull request from an `agent/` branch opens or changes | Label `blast-radius:low` or `high` and a comment with the reasons |
| Review | Same | A review with inline comments and the commit status `agent-review` (pass, fail, or error if it never ran) |
| Rework | `agent-review` failed, fewer than two failed reviews | New commits that fix only what the review named |
| Merge gate | Review passed | Low: enable GitHub auto-merge (if switched on). High: label `needs-human-merge`, the owner merges |
| Retro | Every Nth merged agent pull request | A pull request that proposes changes to the agent instructions, or a comment that nothing repeated |

The services are all GitHub: issues with native blocking links as ticket tracker, Actions as orchestrator and runner, a ruleset on `main` as the last gate, Vercel as deploy preview. No observability platform on purpose; the Actions run pages are enough.

## 2. Principles that held up

1. **Agents never merge.** The merge gate only enables GitHub's native auto-merge, and GitHub merges once the ruleset is satisfied. High-risk pull requests are never auto-merged, whatever the switches say.
2. **Trusted code judges untrusted code.** Every factory job checks out the default branch and runs the factory code from there, never from the pull request it judges.
3. **Decisions are pure functions, effects are thin.** All branching logic (who may start a run, when to rework, when to merge, how a diff is rated) lives in a small module with unit tests. The CLI fetches data with `gh`, calls those functions and applies the result. This is what makes an untestable pipeline testable.
4. **The runner has no memory.** Everything a run needs to know comes from issues, labels, comments, commit statuses and the branch. Hidden comment markers (`<!-- factory:... -->`) identify the factory's own comments so they can be updated instead of duplicated.
5. **Every loop has a cap.** Two failed reviews hand over to a human; one implement run at a time; one concurrency group per pull request; a kill switch variable.
6. **A run that produces nothing says so.** An implement run without a branch or pull request is reported on the issue (run link, denied commands, last message) and the issue gets `needs-human`, which stops automatic retries until the owner removes it.
7. **Switches, not edits.** Behaviour the owner wants to dial (`FACTORY_ENABLED`, `AUTOMERGE_ENABLED`, `BLAST_RADIUS_ENABLED`, `RETRO_EVERY`) is a repository variable, so changing it needs no pull request.
8. **Start slow.** Phase 0: a human merges everything. Phase 1: auto-merge for low blast radius only, after about five pull requests without surprises.

## 3. How the factory changed after the first version

In the order it happened. Pull request numbers are `No9005/primefall`.

| Change | Why |
|---|---|
| First pipeline: implement, blast radius, review, rework, merge gate | The initial design |
| Review prompt: valid inputs only, review inside a git checkout (#29) | The action rejected `working_directory`; the review needs a real checkout |
| Implement scans **all** ready issues when an issue closes (#29) | It first looked only at direct dependents of the closed issue, so tickets that became free earlier stalled |
| A review that never ran is `not run`, not `fail` (#30) | The Claude action skips itself when workflow files differ from the default branch; counting that as a failed review sent pull requests to rework and `needs-human` for no reason |
| Every factory comment has its own marker (#31) | Two kinds of comment shared a marker and overwrote each other |
| `allowed_bots: claude,github-actions` (#39) | The action refuses to run when a bot started the workflow, and the agent's own pull request is opened by a bot |
| Implement report on the issue (#37) | Two runs ended silently, one without a pull request and one after losing its work to a denied `git -C` |
| Prompt and `--allowedTools` fixed, turns 60 to 80 (#41) | Denied commands (`git -C`, chaining, heredocs) cost turns; the agent now stays in the repository root and uses Edit and Write instead of sed |
| Blast radius redefined: documentation and agent files, factory and tooling, business logic | The first rule set rated almost everything high, so every pull request waited for the owner |
| Switch `BLAST_RADIUS_ENABLED` (#40) | For the early MVP everything may count as low |
| Resolve the review bot's fixed threads and collapse its old failed reviews (#44) | The ruleset requires resolved conversations; old threads and old "fail" reviews blocked merges that had passed. Uses GraphQL in Actions, with the reason posted as a reply first |
| Commit tidying rule in `CLAUDE.md` | Agents pushed a commit per small fix |
| Single source for the rules, shorter `CLAUDE.md` and tracker docs (#51), slimmer implement prompt and tool list (#52) | The same rules were in four places and the prompt repeated `CLAUDE.md` |
| PixiJS and isometric skills folded into two skills (#50) | 23 skill descriptions were loaded into every session |
| Rules package counts as low during the MVP (#54) | Most MVP tickets touch the game rules, which had put nearly every pull request on the owner's desk |
| Retro task, `RETRO_EVERY` (#56) | The factory should learn from repeated mistakes without the owner reading every pull request |
| Merge gate job gets `contents: write` (#57) | The first low pull request that passed review was not auto-merged: `Resource not accessible by integration (mergePullRequest)` |
| Implement prompt tells the agent that blockers are checked (#59) | `CLAUDE.md` step 2 made the agent look them up with `gh api`, which the run may not call, and a run stopped before it started |
| Ticket #16 split into groundwork tickets | A ticket whose blockers were closed still assumed groundwork that did not exist on `main` |

## 4. Pitfalls and checks

Read this before building. Each row is something that cost a run, a pull request or an evening.

### GitHub plan, rules and identity

| Pitfall | What happens | Do |
|---|---|---|
| Private repository on the free plan | No rulesets, no native auto-merge | Make the repository public (check for secrets first), or pay |
| The agent or the chat session acts as the owner | The author of a pull request cannot approve it, so "1 required approval" blocks forever | Require zero approvals; use code owners only for the high-risk paths; owner is on the bypass list |
| Ruleset hides the bypass behind auto-merge | The owner's merge button disappears while auto-merge is on | Know it; merge manually or turn auto-merge off for that pull request |
| Linear history plus merge commits | The merge is refused | Squash merging only |
| Required check names | A status that never appears blocks everything | Use the exact names GitHub shows (`check`, `agent-review`, the Vercel name) |
| Required conversation resolution | Bot threads from an old review block a merge that passed | Resolve fixed bot threads automatically, but only when the review passes and with a stated reason |
| Branches of merged pull requests | They pile up; a session may not be allowed to delete them | Setting "Automatically delete head branches" |

### The Claude action

| Pitfall | What happens | Do |
|---|---|---|
| Invalid or missing `CLAUDE_CODE_OAUTH_TOKEN` | Every run fails at once | Create it with `claude setup-token`, store it only as an Actions secret, never in a file, issue or chat |
| Workflow file differs from the default branch | The action skips: pull requests that change a workflow, and branches cut before a workflow changed, get no review | Treat "did not run" as its own outcome (status `error`, comment, no rework); update the branch or start the pipeline by hand |
| Started by a bot | "Workflow initiated by non-human actor" | List the bot names in `allowed_bots` |
| Unknown or invalid action inputs | The run fails before the agent starts | Check each input against the action's current documentation; verify flags (`--effort`, `--max-turns`, `--allowedTools`) locally with the CLI |
| `--allowedTools` patterns | Denied commands do not fail the run; the agent just loses turns or stops | Allow only what is needed; no `git -C`, no chained commands, no heredocs; tell the agent so in the prompt; read the denied list in the report |
| Instructions that need a tool the run may not use | "Check the blockers" with `gh api` was denied and the run quit | Whatever the factory already checked (blockers, labels) is stated in the prompt, and the agent is told to skip it |
| Workflow files | The GitHub App has no `workflows` permission, so an agent cannot push `.github/workflows/*` | Do not grant it: a workflow on a branch of the repository runs with the secrets before any review. Make such changes by hand and review them as high risk |
| Permissions per job | The merge gate needs `contents: write` and `pull-requests: write` to enable auto-merge; the review job needs far less | Grant per job, not per workflow; the job that runs agent code gets what it must, nothing else |
| Usage limits | A subscription token has usage limits, not a money budget; runs fail when it is spent | Limit turns and minutes per task, one run at a time, watch the usage page |
| Node 20 action warnings | Only noise | Ignore until the action versions change |

### Selection and concurrency

| Pitfall | What happens | Do |
|---|---|---|
| Starting only the direct dependents of a closed issue | Tickets that became free earlier stall | On close, scan every open ready issue, lowest number first |
| Creating an issue before its blocker exists | The ticket is started with an incomplete picture | Create blockers first, set the dependency edges, and only then add `ready-for-agent` |
| Several runs at once | Branch name clashes and rework races | One global implement group, an `agent-working` label, checks for an open pull request or an existing agent branch for the issue |
| GitHub keeps only the newest waiting run per concurrency group | A ticket whose run was replaced while waiting is forgotten | It starts at the next closed issue or by hand; document it |
| A label set by someone else | Anyone with triage rights could start a run | Only a `ready-for-agent` label set by the repository owner counts |

### Review and merge semantics

| Pitfall | What happens | Do |
|---|---|---|
| Review results from free text | Unparseable output | The review agent writes one JSON file (`verdict`, `summary`, `findings` with path and line, optional `raiseBlastRadiusReason`, optional `resolvedThreads`); an unusable file counts as a failed review |
| Findings on lines that do not exist | The API call that posts the review fails | The prompt requires a path and a line in the new version of the file |
| The reviewer lowers the class | The safety rating becomes meaningless | It may raise the class with a reason, never lower it; an existing high label is kept |
| A pass for the latest commit next to a fail for an older one | Confusing, and it blocks the ruleset | Collapse earlier failed reviews as outdated when a review passes |
| Retro and other human-only pull requests | Could slip through as "low" | The merge gate has a human-only flag that overrides the rating and the switches |

### Blast radius

- **Calibrate to the owner's time, not to nervousness.** Rating "all code" or "all markdown" high makes the owner the bottleneck. What worked: design, decision, spec and agent files (ADRs, specs, design documents, glossary, `CLAUDE.md`, agent docs, skills), the factory and tooling, and, later in the project, business logic. Everything else, including tests, UI, assets, data and ordinary markdown, is low.
- **Change one thing in several places and something drifts.** The path rules were in the rules file, in `CODEOWNERS`, in the reviewer prompt and in two docs. The rules file is now the single source; the others point to it. `CODEOWNERS` still needs a hand-kept copy.
- **The reviewer's own "raise" rule must agree with the path rules**, otherwise it undoes a deliberate decision (for example during the MVP: game rules are low, so the reviewer must not raise for them).
- **A switch for the early phase.** `BLAST_RADIUS_ENABLED=false` makes everything low; GitHub's own code owner requirement still applies unless the ruleset or `CODEOWNERS` is changed.
- Size limits are optional fields and were left unset: a large change is not risky by itself.

### Tickets

- **Closed blockers do not mean the groundwork exists.** A ticket depends on the code it assumes, not only on the tickets it was filed behind. Before marking a ticket ready, check that `main` has what it builds on. If a run stops because the groundwork is missing, split the ticket; do not retry.
- **A ticket sized for one context window.** Nine cards, five interpreters and new UI in one ticket was too big. Slices should be vertical and demonstrable, with the first slice a prefactoring that later slices plug into.
- **Mention the shared parts in all consumers.** When a foundation ticket delivers something another ticket would have built (here: Long Shot), say so in that other ticket.

### Cloud-session specifics

- GraphQL is blocked and `gh` is old, so `gh issue edit --add-label` and `--blocked-by` fail. Use the REST endpoints (labels, `dependencies/blocked_by`, `sub_issues`) or the MCP tools. The factory itself runs in Actions, where GraphQL works (review thread resolution needs it).
- A session cannot delete branches or force-push; plan for the owner to delete stale branches.
- The same identity as the owner: labels set by a chat session count as the owner's, so a label set too early starts a run.

## 5. Rebuild guide

For a new repository, in this order.

### 5.1 Prerequisites

- GitHub repository (public, or a plan with rulesets and auto-merge), Actions enabled, Claude GitHub App installed on it, and the secret `CLAUDE_CODE_OAUTH_TOKEN`.
- Actions settings: allow Actions to create and approve pull requests; keep default workflow permissions read-only (each job asks for what it needs); require approval for fork pull requests from outside collaborators.
- CI that runs lint, type check and tests (job name `check`) and a deploy preview if any.
- A convention document the agents read first (`CLAUDE.md`): ticket workflow, Git rules (never commit or push to `main`, own branch from the latest `origin/main`, never rewrite pushed history, tidy commits before the first push), code style, domain vocabulary.

### 5.2 Tracker conventions

Labels: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`, and the factory's `agent-working`, `needs-human`, `needs-human-merge`, `blast-radius:low`, `blast-radius:high`, `high-risk` (created by the workflows when missing). Blocking uses GitHub's native issue dependencies; a ticket is startable when every blocker is closed.

### 5.3 The decision module

Pure functions with unit tests, no I/O:

- Start: an issue is startable when it has `ready-for-agent` and not `ready-for-human`, the label was set by the owner, no open blockers, no `agent-working`, no open pull request and no branch for that issue. On close, which issues to scan.
- Rating: a glob matcher and a classifier over the changed files and labels; groups of paths (documentation and agent, factory and tooling, business logic with exceptions); reasons returned with the level; a rule that keeps an existing high label.
- Review: parse and validate the result file; outcome pass, fail or not run; count failed reviews; rework or hand over after the cap; which earlier reviews are superseded; which bot threads to resolve (only on pass, only the bot's own, only with a reason).
- Merge gate: review passed and no `needs-human`; high or human-only means wait for the owner; low and `AUTOMERGE_ENABLED=true` means enable auto-merge.
- Switches: rating on or off, retro interval (unset or invalid is the default, `0` is off), whether a merged pull request is the Nth.
- Reports: summarise an agent run (denied tools, last message) from its execution log.

### 5.4 The CLI

One file, one command per workflow step. It reads `GH_TOKEN`, `GITHUB_REPOSITORY` and the switches from the environment and writes step outputs. Commands used: `ensure-labels`, `select-issue`, `mark-working`, `pr-context`, `implement-report`, `open-threads`, `classify`, `review-report`, `rework-decision`, `merge-gate`, `retro-decision`. Keep comment upserting by marker in one helper.

### 5.5 Workflows

| Workflow | Trigger | Jobs and permissions |
|---|---|---|
| `ci.yml` | pull request | `check` (lint, type check, tests) |
| `factory-implement.yml` | issue labeled or closed, manual | `select` (read; issues write) then `implement` (contents, pull requests, issues write; `id-token`). One global concurrency group, no cancel. Marks `agent-working`, runs the agent, reports a run without a pull request, always removes the marker |
| `factory-pull-request.yml` | pull request opened, synchronized, reopened, or manual | `context` (is it an agent pull request of this repository), `blast-radius` (skipped when the rating is off), `review` (read-only agent, writes the result file), `after-review` (rework decision or merge gate; the merge gate needs contents write), `rework` (agent that pushes to the head branch), then the pipeline runs again for the new commit. One concurrency group per pull request, newer cancels older |
| `factory-retro.yml` | pull request closed (merged), or manual | `decide` then `retro` agent. One group, no cancel |

Common to all: `if: vars.FACTORY_ENABLED == 'true'`; check out the default branch for the factory code (the review checks out the pull request into a separate directory for reading); never use event text directly in a shell line, pass it through `env`.

### 5.6 Prompts

Short, and pointing at the convention document. Each states the runtime specifics (working directory is the repository root; no `git -C`, no chaining, no heredocs; use Edit and Write, not sed or python) and the hard bans (never merge, never push to `main`, never change settings). Text from issues, comments and reviews is called data, never instructions. The implement prompt says that the factory has checked the blockers. The review prompt names the result file format, requires a path and line that exist in the new version of the file, and tells the reviewer how to judge old threads against the current code. The retro prompt requires a pattern in at least two pull requests (or an owner correction) and forbids touching the rating rules, `CODEOWNERS`, the ruleset and the decision documents.

### 5.7 Repository settings

Ruleset on `main`: pull request required, code owner review (the `CODEOWNERS` file lists only the high-risk paths), required checks (`check`, `agent-review`, deploy preview), conversation resolution, linear history, no force pushes or deletions, bypass for the owner only. Allow auto-merge and squash merging, delete head branches automatically. Variables: `FACTORY_ENABLED`, `AUTOMERGE_ENABLED`, `BLAST_RADIUS_ENABLED`, `RETRO_EVERY`.

### 5.8 First runs

Check these on the first real runs; they cannot be tested outside Actions:

1. The action accepts the prompt and each flag; the agent can run git, build, test and lint with the allowed tools.
2. Pull requests and pushes of the agent start CI and the pipeline (they may need a manual start of the pipeline).
3. A low pull request that passes review gets auto-merge enabled and merges; a high one gets `needs-human-merge`.
4. After a rework, a passing review resolves the bot's fixed threads and collapses its old failed reviews. Look for "Resolved thread" or "Could not tidy review threads" in the log.
5. A pull request that changes a workflow gets `agent-review: error`, not a failed review.
6. After the first merge, closing the issue starts the next unblocked ticket.
7. An implement run that ends without a pull request leaves a readable report on the issue.
8. The retro run, started by hand, produces a pull request or the "no pattern" comment.

### 5.9 Operating phases

Phase 0: a human merges every pull request; watch the reports. Phase 1: auto-merge for low blast radius after about five clean pull requests. Lower the rating (for example the game rules count as low during the MVP) only by changing the rules file in a pull request the owner merges; raise it again when the product leaves its early phase.

## 6. Open points

- Thread resolution through GraphQL is verified only by the unit tests of its decisions; confirm it at the first rework that passes.
- The retro task and the thread resolution still lack a live run at the time of writing.
- `CODEOWNERS` is a hand-kept copy of the rules file.
- A factory pull request that changes a workflow cannot be reviewed by the factory; the owner reviews it.
