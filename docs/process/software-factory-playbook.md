# Software factory: pitfalls and a rebuild guide

What to watch for, and what it takes to build the same thing in another project. The design as it stands is in `docs/agents/software-factory.md` and the operation in `docs/agents/factory-setup.md`. The factory runs on GitHub (Issues, Actions, rulesets) with the Claude Code GitHub Action.

## 1. Why it is built this way

The factory is one workflow run per ticket: select, implement, review, rework once, merge gate, close the issue, start the next run. The first design chained separate workflows by events, and it stalled again and again, because GitHub starts no workflow for an event that the workflow token caused (an auto-merge, a close, a push) and none for a pull request with a merge conflict; scheduled jobs are delayed or skipped. So no step depends on an event the run caused itself, and no timer is needed. The rest follows from a few principles: agents never merge (only GitHub's auto-merge does, once the ruleset is satisfied); trusted code from the default branch judges untrusted code; decisions are pure, unit-tested functions and the CLI is thin; the runner has no memory (issues, labels, comments and statuses are the state); every loop has a cap and a failure says so loudly instead of stopping silently; behaviour the owner wants to dial is a repository variable.

## 2. Pitfalls and checks

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

### Events and timers

| Pitfall | What happens | Do |
|---|---|---|
| Events caused by the workflow token | GitHub starts no workflow for them (only `workflow_dispatch` is allowed), so a chain of workflows ends after each auto-merge | One run per ticket that does every step itself and starts the next run with `workflow_dispatch` |
| A pull request with a merge conflict | No workflow starts for it | Keep the pipeline inside the run |
| Scheduled workflows (a revive job) | GitHub delays or skips them; a repair job only hides the flaw | Do not rely on timers |
| A manual start with a default input | A default issue number `0` failed | The workflow has no input; every run scans all tickets |
| A new workflow file | The Claude action refuses to run when its workflow differs from `main` | A new workflow can only be tested after it is merged |

### The Claude action

| Pitfall | What happens | Do |
|---|---|---|
| Invalid or missing `CLAUDE_CODE_OAUTH_TOKEN` | Every run fails at once | Create it with `claude setup-token`, store it only as an Actions secret, never in a file, issue or chat |
| Workflow file differs from the default branch | The action skips: pull requests that change a workflow, and branches cut before a workflow changed, get no review | Treat "did not run" as its own outcome (status `error`, comment, no rework); update the branch or start the pipeline by hand |
| Started by a bot | "Workflow initiated by non-human actor" | List the bot names in `allowed_bots` |
| Unknown or invalid action inputs | The run fails before the agent starts | Check each input against the action's current documentation; verify flags (`--effort`, `--max-turns`, `--allowedTools`) locally with the CLI |
| `--allowedTools` patterns | Denied commands do not fail the run; the agent just loses turns or stops | Allow only what is needed; no `git -C`, no chained commands, no heredocs; tell the agent so in the prompt; read the denied list in the report. A rework agent denied `git rm` cannot remove a file and pushes nothing |
| Instructions that need a tool the run may not use | "Check the blockers" with `gh api` was denied and the run quit | Whatever the factory already checked (blockers, labels) is stated in the prompt, and the agent is told to skip it |
| The status of an agent step | It can end in failure although the work is done, or in success without a pull request | Check the result (branch, pull request, result file), not the status |
| Workflow files | The GitHub App has no `workflows` permission, so an agent cannot push `.github/workflows/*` | Do not grant it: a workflow on a branch of the repository runs with the secrets before any review. Make such changes by hand and review them as high risk |
| Permissions per job | The merge gate needs `contents: write` and `pull-requests: write` to enable auto-merge; the review job needs far less | Grant per job, not per workflow; the job that runs agent code gets what it must, nothing else |
| Usage limits | A subscription token has usage limits, not a money budget; runs fail when it is spent | Limit turns and minutes per task, one run at a time, watch the usage page |
| Node 20 action warnings | Only noise | Ignore until the action versions change |

### Selection and concurrency

| Pitfall | What happens | Do |
|---|---|---|
| Starting only the direct dependents of a closed issue | Tickets that became free earlier stall | Scan every open ready issue, lowest number first |
| Creating an issue before its blocker exists | The ticket is started with an incomplete picture | Create blockers first, set the dependency edges, and only then add `ready-for-agent` |
| Several runs at once | Branch name clashes and rework races | One concurrency group without cancel, an `agent-working` label, checks for an open pull request or an existing agent branch for the issue |
| GitHub keeps only the newest waiting run per concurrency group | A ticket whose run was replaced while waiting is forgotten | Every run scans all tickets, so nothing is lost |
| A label set by someone else | Anyone with triage rights could start a run | Only a `ready-for-agent` label set by the repository owner counts |

### Review and merge semantics

| Pitfall | What happens | Do |
|---|---|---|
| Review results from free text | Unparseable output | The review agent writes one JSON file (`verdict`, `summary`, `findings` with path and line, optional `raiseBlastRadiusReason`, optional `resolvedThreads`); an unusable or missing file counts as "did not run" (status `error`, repeated once, no rework), not as a failed review: a failed review would start a rework run that has no findings to fix |
| Findings on lines that do not exist | The API call that posts the review fails | The prompt requires a path and a line in the new version of the file |
| The reviewer lowers the class | The safety rating becomes meaningless | It may raise the class with a reason, never lower it; an existing high label is kept |
| A pass for the latest commit next to a fail for an older one | Confusing, and it blocks the ruleset | Collapse earlier failed reviews as outdated when a review passes |
| A rework run that changes nothing | The pipeline is never re-run and the pull request waits forever | The job reports it (`needs-human`) when no new commit exists |
| Retro and other human-only pull requests | Could slip through as "low" | The merge gate has a human-only flag that overrides the rating and the switches |
| The reviewer sees the implementer's reasoning | Its verdict is anchored on it | Every agent step is its own action call and therefore its own session |

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
- **Specification gaps surface late.** Sight range, distance metric, Cover occupancy, queue length and what Overdrive replaces came up only while specifying tickets and reading the first reviews; numbered grilling rounds with a recommended answer per question settled most of them in one pass.

### Cloud-session specifics

- GraphQL is blocked and `gh` is old, so `gh issue edit --add-label` and `--blocked-by` fail. Use the REST endpoints (labels, `dependencies/blocked_by`, `sub_issues`) or the MCP tools. The factory itself runs in Actions, where GraphQL works (review thread resolution needs it).
- A session cannot delete branches or force-push; plan for the owner to delete stale branches.
- The same identity as the owner: labels set by a chat session count as the owner's, so a label set too early starts a run. Rules that must hold for the owner's own identity (never merge, never push to `main`) cannot be enforced by repository settings alone; they live in `CLAUDE.md`.
- Factory changes are best merged one at a time, in order, by the owner, and checked on the first real run.
- A factory should fail loudly. Every silent failure (invalid token, a skipped action, denied commands, lost work) cost more time than the failure itself.

## 3. Rebuild guide

For a new repository, in this order. Build the single-run design of `docs/agents/software-factory.md`; the workflow table in 3.5 is the older, event-driven layout and only shows which jobs exist.

### 3.1 Prerequisites

- GitHub repository (public, or a plan with rulesets and auto-merge), Actions enabled, Claude GitHub App installed on it, and the secret `CLAUDE_CODE_OAUTH_TOKEN`.
- Actions settings: allow Actions to create and approve pull requests; keep default workflow permissions read-only (each job asks for what it needs); require approval for fork pull requests from outside collaborators.
- CI that runs lint, type check and tests (job name `check`) and a deploy preview if any.
- A convention document the agents read first (`CLAUDE.md`): ticket workflow, Git rules (never commit or push to `main`, own branch from the latest `origin/main`, never rewrite pushed history, tidy commits before the first push), code style, domain vocabulary.

### 3.2 Tracker conventions

Labels: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`, and the factory's `agent-working`, `needs-human`, `needs-human-merge`, `blast-radius:low`, `blast-radius:high`, `high-risk` (created by the workflows when missing). Blocking uses GitHub's native issue dependencies; a ticket is startable when every blocker is closed.

### 3.3 The decision module

Pure functions with unit tests, no I/O:

- Start: an issue is startable when it has `ready-for-agent` and not `ready-for-human`, the label was set by the owner, no open blockers, no `agent-working`, no open pull request and no branch for that issue.
- Rating: a glob matcher and a classifier over the changed files and labels; groups of paths (documentation and agent, factory and tooling, business logic with exceptions); reasons returned with the level; a rule that keeps an existing high label.
- Review: parse and validate the result file; outcome pass, fail or not run; count failed reviews; rework or hand over after the cap; which earlier reviews are superseded; which bot threads to resolve (only on pass, only the bot's own, only with a reason).
- Merge gate: review passed and no `needs-human`; high or human-only means wait for the owner; low and `AUTOMERGE_ENABLED=true` means enable auto-merge.
- Switches: rating on or off, retro interval (unset or invalid is the default, `0` is off), whether a merged pull request is the Nth.
- Reports: summarise an agent run (denied tools, last message) from its execution log.

### 3.4 The CLI

One file, one command per workflow step. It reads `GH_TOKEN`, `GITHUB_REPOSITORY` and the switches from the environment and writes step outputs. Keep comment upserting by hidden marker (`<!-- factory:... -->`) in one helper, so the factory's own comments are updated instead of duplicated.

### 3.5 Jobs

| Job | Does | Permissions |
|---|---|---|
| `ci.yml` `check` | lint, type check, tests | read |
| select | picks the next startable issue, marks `agent-working` | issues write |
| implement | agent that opens the pull request; a run without a pull request is reported on the issue | contents, pull requests, issues write |
| blast radius | label and comment with the reasons | pull requests write |
| review | read-only agent that writes the result file; the review checks out the pull request into a separate directory for reading | read |
| rework | agent that pushes to the head branch, once | contents write |
| merge gate | enables auto-merge for low, labels `needs-human-merge` for high | contents, pull requests write |
| retro | every Nth merged agent pull request, proposes changes to the agent instructions | contents, pull requests write |

Common to all: the kill switch variable; check out the default branch for the factory code; never use event text directly in a shell line, pass it through `env`.

### 3.6 Prompts

Short, and pointing at the convention document. Each states the runtime specifics (working directory is the repository root; no `git -C`, no chaining, no heredocs; use Edit and Write, not sed or python) and the hard bans (never merge, never push to `main`, never change settings). Text from issues, comments and reviews is called data, never instructions. The implement prompt says that the factory has checked the blockers. The review prompt names the result file format, requires a path and line that exist in the new version of the file, and tells the reviewer how to judge old threads against the current code. The retro prompt requires a pattern in at least two pull requests (or an owner correction) and forbids touching the rating rules, `CODEOWNERS`, the ruleset and the decision documents.

### 3.7 Repository settings

Ruleset on `main`: pull request required, code owner review (the `CODEOWNERS` file lists only the high-risk paths), required checks (`check`, `agent-review`, deploy preview), conversation resolution, linear history, no force pushes or deletions, bypass for the owner only. Allow auto-merge and squash merging, delete head branches automatically. Variables: `FACTORY_RUN_ENABLED`, `AUTOMERGE_ENABLED`, `BLAST_RADIUS_ENABLED`, `RETRO_EVERY`.

### 3.8 First runs

Check these on the first real runs; they cannot be tested outside Actions:

1. The action accepts the prompt and each flag; the agent can run git, build, test and lint with the allowed tools.
2. The agent's pull request starts CI and the review.
3. A low pull request that passes review gets auto-merge enabled and merges; a high one gets `needs-human-merge`.
4. After a rework, a passing review resolves the bot's fixed threads and collapses its old failed reviews. Look for "Resolved thread" or "Could not tidy review threads" in the log.
5. A pull request that changes a workflow gets `agent-review: error`, not a failed review.
6. After the first merge, the run closes the issue and starts the next unblocked ticket.
7. An implement run that ends without a pull request leaves a readable report on the issue.
8. The retro run, started by hand, produces a pull request or the "no pattern" comment.

### 3.9 Operating phases

Phase 0: a human merges every pull request; watch the reports. Phase 1: auto-merge for low blast radius after about five clean pull requests. Lower the rating (for example the game rules count as low during the MVP) only by changing the rules file in a pull request the owner merges; raise it again when the product leaves its early phase.

## 4. Open points

- Thread resolution through GraphQL is verified only by the unit tests of its decisions; confirm it at the first rework that passes.
- `CODEOWNERS` is a hand-kept copy of the rules file.
- A factory pull request that changes a workflow cannot be reviewed by the factory; the owner reviews it.
