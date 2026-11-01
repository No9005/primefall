# Claude Code Session Log: from planning to a software factory

This document records what one long Claude Code session did on Primefall, and what got in the way. It complements `primefall-skill-process-log.md` (the earlier design session) and is meant as a reference for revising the skills, the software factory and the way work is split between a human and agents.

## Session

- **Tool and environment:** a Claude Code session in the cloud (Claude Code on the web), working in a container with a clone of `No9005/primefall`. The session ran on 2026-11-01 for roughly nine and a half hours (about 08:00 to 17:40 UTC). The model and its version are part of the session record that Claude Code keeps and are not repeated in the repository.
- **Working language:** the owner wrote in German; everything in the repository (code, docs, commits, issues, pull requests) is English, as `CLAUDE.md` requires.
- **Other repositories used:** `mattpocock/skills` (read only, cloned to copy the setup and triage skills), `No9005/moon-sun-fire` (read only, attached on request to compare its `CLAUDE.md` and automation plan).
- **Skills used:** `grilling` and `domain-modeling` (through `grill-with-docs`) for the design rounds, `to-tickets` (followed by hand, because it is not model-invocable), `triage` (copied into the repository), `artifact-design` for the clickable mockups.
- **Mode:** the session's permission mode was automatic; actions on GitHub went through the owner's own login, which matters below.
- **Effort setting:** medium.

## What was done

### 1. Gap analysis against the Matt Pocock skills
The repository had a spec, 16 ADRs and a glossary but no code, no issue tracker configuration and no setup skill. The session listed what `to-tickets` needed (tracker configuration, label vocabulary, a place for architecture decisions) and recommended one short architecture grill instead of a larger one.

### 2. Tracker and agent configuration
`setup-matt-pocock-skills` was copied from the upstream repository and run by hand: GitHub Issues as the tracker, the five triage labels created, `docs/agents/*`, a `CLAUDE.md` with an "Agent skills" block, and later the `triage` skill. `CLAUDE.md` was extended after comparing it with the other repository: how to work on a ticket, code style (readability first, no file per function, extract only when DRY is violated), Git rules and project rules.

### 3. Architecture grill (four rounds)
Decisions made with the owner, recorded as ADRs 0017 to 0019:
- npm workspaces with `game-core` (rules, simulation, AI, data) and `apps/web`; Vite, React, PixiJS, Vitest, ESLint; CI runs lint, type check and tests.
- **Server-authoritative by design:** the full Match State (seed, Deck order, Hands) exists only in a match host; clients get a Squad View and filtered events. The offline prototype runs the host in the browser behind the same asynchronous interface a server will use. Seeded PRNG, so shuffles are random per match but reproducible.
- Declarative card data with one interpreter per effect kind; round limit of 30 with a Deck-size tiebreak (ADR 0019).
- Visibility rules for Deck, Discard and Exile counts; base sight range 7.

### 4. Clean-up and specification gaps
Inconsistencies found while reading the existing documents were settled: a 20 by 12 grid cannot be mirror-symmetric with a 3 by 3 Prime Zone (now 21 by 11, three Spawn tiles per Squad); duplicated skill folders (the full versions were kept); undefined distance metric, Cover model, Pitch and queue length (ADR 0020); the Overdrive rules (replaces the standard effect; same name means identical card; three modes on at most four cards) and two new Controller cards.

### 5. UI designs and prototype assets
`docs/design/ui-spec.md`, an asset contract, 47 generated placeholder assets with a PixiJS manifest and a clickable HTML mockup (landscape first), also published as an artifact.

### 6. Tickets
17 tickets as vertical slices with native blocking links (#6 to #22), plus later issues for an isometric-versus-oblique evaluation (#25), the factory (#26), parallel runs (#32) and a hardening follow-up (#43).

### 7. First implementation tickets by hand
#6 (monorepo skeleton, boundaries, CI) and #7 (Reactor Deck on screen with PixiJS). Rules added on the way: no commits or force pushes to `main`, an own branch from the latest `origin/main`, enums instead of string comparisons, tidy commits before the first push.

### 8. The software factory
Issue #26 and about fifteen follow-up pull requests built a pipeline on GitHub Actions:
- **Implement:** an unblocked `ready-for-agent` issue starts an agent that opens a pull request; the next ticket starts when the previous one closes.
- **Blast radius:** a deterministic rating (design, decision, spec and agent files, the factory and tooling, the business logic of the rules package, changed or removed tests are high; new tests, card and map data, UI and assets are low), a reviewer that can raise but never lower it, a switch to turn the rating off for the early MVP.
- **Review:** a separate read-only agent run reports a status, posts inline comments and, after a pass, resolves its own fixed threads and collapses old failed reviews.
- **Rework** after a failed review, a **merge gate** (native auto-merge only for low blast radius and only when the owner switches it on), a kill switch and run limits.
- The factory then built the first real tickets by itself: #8 (match setup), #9 (local host and planning layout) and #10 (first move, still in review at the time of writing).

## Obstacles

### Environment and permissions
- **GraphQL blocked, old `gh`:** `gh repo view`, `--blocked-by` and `--parent` did not work. REST endpoints for issue dependencies and sub-issues were used and written down in `docs/agents/issue-tracker.md`. The GitHub MCP tools disconnected several times.
- **Repository scope:** only `primefall` was attached. Reading the other repository needed an explicit request.
- **Force push:** after the first pull request was merged, the session branch could only be updated by rewriting history; the permission check denied the force push. The workaround (merging the old history in) led to the rule "never rewrite shared history, always branch from `origin/main`". Later rebases were done only on own pull request branches and only on request.
- **No branch deletion:** the proxy refused deleting remote branches (HTTP 403, a dropped connection); the owner deletes them by hand.

### GitHub plan, rules and identity
- **Free private repository:** no branch protection, no rulesets, no native auto-merge. The repository was made public.
- **Rules that blocked merges unexpectedly:** one required approval for every pull request (an author cannot approve their own), required linear history (merge commits refused), required conversation resolution (one stale inline thread blocked a pull request whose problem was already fixed), and enabled auto-merge hiding the bypass option in the merge box. Required check names (such as `agent-review`) can only be added once they have been reported once.
- **The session acts as the owner:** pull requests and label events from the chat are made by the owner's account. They cannot be approved by the owner, and the owner's bypass role also applies to the chat agent. This is why the Git rules and the "agents never merge" rule are written down and are not technically enforced for that identity.

### The Claude action and the factory
- **Invalid token:** the first agent run failed after 0.2 seconds with 0 turns and no readable message. The cause was only found by exclusion (limits and flags were fine); replacing the token fixed it.
- **A wrong option:** `working_directory` is not an input of the action; the review ran outside a git repository and failed.
- **Workflow validation:** the action refuses to run when the workflow files of a branch differ from the default branch. The review was skipped silently, and the missing result file was reported as a failed review and started a pointless rework. Now "did not run" is a separate outcome. Pull requests that change a workflow cannot be reviewed automatically.
- **Bot actors:** a pull request opened by the Claude app starts workflows as that bot, which the action refuses unless `allowed_bots` lists it.
- **Silent agent failures:** the run for #9 ended without a branch or pull request and showed green; the run for #10 built the whole ticket but could not push, because the agent used `git -C <path>`, which does not match the tool patterns, and the work was lost with the runner. The action's log hides which commands were denied. The factory now reports such a run on the issue (run link, denied commands, last message) and labels it `needs-human`.
- **Selection and concurrency:** the first version only looked at the direct dependents of a closed issue and started one, so the chain could stall at branches of the ticket graph; GitHub also keeps only the newest waiting run per concurrency group. Now every open ready issue is checked after each close. Creating an issue with the label before its blocker raced the selection (it was skipped correctly).
- **Trusted code from the default branch:** the review job runs the factory code from `main`, so a pull request that adds a new command and uses it in the same workflow fails until it is merged. The optional step now cannot fail the job.
- **Many small factory pull requests in a row** conflicted with each other (several workflow and CLI files); two needed rebasing, one is still open and in conflict.

### Review semantics
- Each review belongs to a commit. After an automatic rework, a failed review for the old commit and a passing review for the new one sit side by side and looked contradictory.
- Two kinds of comment shared one marker and overwrote each other.
- Inline threads of the bot are not closed by a fix elsewhere. The remedy (resolving the bot's own fixed threads after a pass, with a reason, using GraphQL) could not be tested outside Actions.

### Specification gaps found late
Base sight range, distance metric, Cover occupancy, whether Pitch is queued, queue length, what Overdrive replaces, whether copies of a card may differ, and the Overdrive card count per Deck were all undefined or contradictory until they were hit while specifying tickets or reading the first reviews. Whether to keep the isometric projection is deliberately open (#25): it fills only about 45 percent of its bounding box on a landscape phone.

### Usage
The owner's Claude Pro limits were not reached (about a third of the session window and five percent of the week at the time checked). A long session with several agent runs is still close to what such a plan allows.

## Observations for the skills and the factory

- `grill-with-docs` worked well in numbered rounds with a recommended answer per question; the answers settled most decisions in one pass, and the contradictions it surfaced were real.
- `to-tickets` needs the tracker configuration first; with native blocking links the order of tickets is checkable by the factory.
- A factory should fail loudly: every silent failure above (invalid token, skipped action, denied commands, lost work) cost more time than the failure itself. Reports on the issue or pull request are worth more than extra logging.
- Keep agent tool permissions narrow but test them with the exact way an agent formulates commands (working directory, `git -C`, chaining).
- Rules that must hold for the owner's own identity (never merge, never push to `main`) cannot be enforced by repository settings alone; they live in `CLAUDE.md`.
- Factory changes are best merged one at a time, in order, by the owner, and checked on the first real run.

## State at the end

- Merged: the skeleton (#23), the Reactor Deck (#24), the factory and its fixes, the Overdrive rules and card data, the blast radius rules and switch, match setup (#28) and the local host and planning layout (#38).
- Open: #42 (first move and playback, awaiting the owner's review), #36 (rule for changed tests, needs a rebase), #43 (hardening of `resolveRound`, waits for #10), the evaluation tickets #25 and #32, and the remaining feature tickets #11 to #21 (ticket #22, VFX and poses, is for a human).
- Untested until the first real run: resolving the bot's own threads and collapsing old reviews through GraphQL.
- Repository variables the owner controls: `FACTORY_ENABLED`, `AUTOMERGE_ENABLED` (off in phase 0), `BLAST_RADIUS_ENABLED`.
