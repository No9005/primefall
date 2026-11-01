# Primefall

Mobile-first, 2.5D tactical 3v3 game: both Squads plan simultaneously, commit commands, and a deterministic Resolution plays out. A Squad wins by holding the Prime Zone for three consecutive Resolutions.

The current product spec is `docs/specs/offline-mvp-prototype.md` (card effects: `docs/specs/mvp-card-set.md`). The vocabulary is `GLOSSARY.md`. Decisions are in `docs/adr/`. Work is tracked as GitHub issues.

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
2. Check the issue's blocking relationships (see `docs/agents/issue-tracker.md`). If a blocking issue is still open, stop and comment on the issue instead of starting.
3. Work on your own branch named `agent/issue-<number>-<short-slug>`, unless the session prescribes a branch name; then use that. Never push to `main`.
4. Keep the change small and limited to the ticket. Do not fix unrelated things; mention them in the pull request.
5. Write tests as the issue asks. Test behaviour through the public interface (for the simulation: the Match Simulation seam), not internals.
6. Open a pull request against `main` that references the issue (`Closes #<number>`). Do not merge it. The product owner merges manually.
7. In the pull request: a short summary, how you verified it (commands and results), and anything open or decided on your own.

If the issue is unclear or contradicts the spec, an ADR or the glossary, do not guess. Comment on the issue with the question and stop.

## Code style

- **Code must be readable first.** Clear names, small focused functions, comments only where the _why_ is not obvious.
- **No file-per-function.** Do not put every function in its own file. Keep related code together in one cohesive module.
- **Extract only when DRY is violated.** Move code into a shared module only when it is actually duplicated (for example business logic repeated in several places) or when a function is used from several different files. Do not extract speculatively "for reuse later".

## Rules that matter for this project

- **The simulation is pure and deterministic.** Rules (movement, Line of Sight, Cover, Energy, Deck Damage, Exhaustion, victory) live in a module with no knowledge of rendering, browser APIs or storage. Given the same Match State and Squad Plans it must always produce the same result. Rendering and AI consume the simulation; they never reimplement its rules.
- **Respect the ADRs.** If your change contradicts an ADR, surface it explicitly in the pull request instead of silently overriding it.
- Do not edit `GLOSSARY.md`, ADRs or specs unless the issue asks for it. Propose changes in the pull request description.
- Do not add dependencies beyond the decided stack without a reason stated in the pull request.
- Tickets without the `ready-for-agent` label are not for agents. Work only on the ticket or tickets the product owner names in the chat, one at a time, and stop after opening the pull request.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues of `No9005/primefall` (via `gh` / REST API). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
