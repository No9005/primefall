# Primefall

Mobile-first, 2.5D tactical 3v3 game: both Squads plan simultaneously, commit commands, and a deterministic Resolution plays out. A Squad wins by holding the Prime Zone for three consecutive Resolutions.

The current product spec is `docs/specs/offline-mvp-prototype.md` (card effects: `docs/specs/mvp-card-set.md`). The vocabulary is `GLOSSARY.md`. Decisions are in `docs/adr/`. Work is tracked as GitHub issues. Switch values, working agreements and approaches that were tried and dropped: `docs/process/status.md`.

## Language

- Code, comments, commit messages, issues and pull requests are in English.
- Use the terms exactly as defined in `GLOSSARY.md` (for example Hero, Squad, Deck, Hand, Pitch, Shield, Exhaustion, Tick, Resolution). Do not use the terms the glossary lists under _Avoid_ (for example "HP", "health", "death", "team"). If a concept is missing from the glossary, say so in the pull request instead of inventing a name.

## Stack and commands

TypeScript (strict), PixiJS v8 for presentation (stylized 2.5D, orthographic camera), React and Vite for the web app. An npm-workspaces monorepo (ADR 0017, ADR 0018):

- `packages/game-core`: rules, simulation, AI and game data. Entry points: `game-core` (shared: types, `validatePlan`, card display data), `game-core/server` (full simulation) and `game-core/local-host` (in-browser host for the offline prototype).
- `apps/web`: React UI and PixiJS rendering. It may import only `game-core` and `game-core/local-host`; ESLint forbids `game-core/server`. `game-core` must not use browser APIs or `Math.random()`.

The simulation is deterministic and, for the offline prototype, runs in a local host in the browser behind the same interface a server will use; there is no backend. No Matter.js.

Root scripts, all run from the repository root: `dev`, `build`, `test`, `lint`, `typecheck`. Run `build`, `test`, `lint` and `typecheck` before finishing any ticket; all must pass. CI runs lint, type check and tests on every pull request; Vercel builds the web app.

## How to work on a ticket

1. Read the whole issue, including its comments, and the spec, ADRs and glossary parts it touches.
2. Check the issue's blocking relationships (see `docs/agents/issue-tracker.md`). If a blocking issue is still open, stop and comment on the issue instead of starting. (A factory run has already checked this: skip the step, `gh api` and `gh issue list` are not available to it.)
3. Work on your own new branch named `agent/issue-<number>-<short-slug>`, cut from the latest `origin/main` (`git fetch origin main`, then `git switch -c <branch> origin/main`). See _Git rules_ below.
4. Keep the change small and limited to the ticket. Do not fix unrelated things; mention them in the pull request.
5. Write tests as the issue asks. Test behaviour through the public interface (for the simulation: the Match Simulation seam), not internals.
6. **Tidy your commits before the first push.** Squash commits that belong together into logical commits: one commit per coherent change, usually one to three per ticket, never a commit per small edit or fix-up. Do this locally, before the branch is pushed (for example `git reset --soft $(git merge-base origin/main HEAD)` and then commit again in logical pieces; agents cannot use interactive rebase). Pushed history is shared and is never rewritten (see _Git rules_).
7. Open a pull request against `main` that references the issue (`Closes #<number>`). Agents never merge. The product owner merges, or GitHub auto-merge does for low blast radius pull requests that the software factory enables (see _Software factory_).
8. In the pull request: a short summary, how you verified it (commands and results), and anything open or decided on your own.

If the issue is unclear or contradicts the spec, an ADR or the glossary, do not guess. Comment on the issue with the question and stop.

## Git rules

- **Never commit to `main`. Never push to `main`. Never force-push `main`. No exceptions.** `main` only changes through a pull request that the product owner merges.
- Always work on your own branch, cut fresh from the latest `origin/main`. Never work on `main` itself and never reuse a branch whose pull request has already been merged: start a new branch from the current `origin/main` instead.
- If the session or tooling prescribes a branch name, use that name, but it must still be a branch cut from the latest `origin/main`, and the rules above still apply.
- In a chat session, merge a pull request only when the owner explicitly says so for that pull request; the session acts through the owner's account, which settings cannot tell apart from the owner.
- Squashing your own commits that have not been pushed yet is expected (see _How to work on a ticket_). Do not rewrite shared history, that is, anything already pushed. If a push is rejected, stop and ask the product owner instead of forcing it.

## Code style

- **Code must be readable first.** Clear names, small focused functions, comments only where the _why_ is not obvious.
- **No file-per-function.** Do not put every function in its own file. Keep related code together in one cohesive module.
- **A check in code beats a rule in prose.** If a program can verify a rule (lint, types, a test, CI), build that check; write a rule here or in `CODING_STANDARDS.md` only for judgement calls.
- **Extract only when DRY is violated.** Move code into a shared module only when it is actually duplicated (for example business logic repeated in several places) or when a function is used from several different files. Do not extract speculatively "for reuse later".

## Rules that matter for this project

- **The simulation is pure and deterministic.** Rules (movement, Line of Sight, Cover, Energy, Deck Damage, Exhaustion, victory) live in a module with no knowledge of rendering, browser APIs or storage. Given the same Match State and Squad Plans it must always produce the same result. Rendering and AI consume the simulation; they never reimplement its rules.
- **Respect the ADRs.** If your change contradicts an ADR, surface it explicitly in the pull request instead of silently overriding it.
- Do not edit `GLOSSARY.md`, ADRs or specs unless the issue asks for it. Propose changes in the pull request description.
- Do not add dependencies beyond the decided stack without a reason stated in the pull request.
- Tickets without the `ready-for-agent` label are not for agents. Work only on the ticket or tickets the product owner names in the chat, one at a time, and stop after opening the pull request.

## Software factory

Unblocked `ready-for-agent` issues are started automatically and their pull requests are reviewed by a separate agent run. Pull requests with a **high blast radius** are always merged by the product owner; only low ones may get auto-merge, and only when the owner has switched it on. Agents never merge and never change the factory's rules to lower a pull request's class. The rules, switches and setup are in `docs/agents/software-factory.md` and `docs/agents/factory-setup.md`; the path rules are only in `tools/factory/blast-radius-rules.json`.

In a factory run, the issue named in the run prompt is your ticket (there is no chat to name one); everything else in this file applies unchanged. The agent's tool permissions are narrow, so run commands exactly like this or they are denied and the work is lost:

- Work from the repository root. Run every command on its own: no chaining (`&&`, `;`), no `git -C <path>`, no heredoc scripts. Change files with the Edit and Write tools, not with `sed` or `python`.
- Push with the full branch name, as its own command: `git push -u origin agent/issue-<number>-<short-slug>`. Never push `HEAD`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues of `No9005/primefall` (via `gh` / REST API). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
