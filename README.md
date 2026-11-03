# Primefall

Mobile-first, 2.5D tactical 3v3 game. Both Squads plan at the same time, commit their commands, and a deterministic Resolution plays out. A Squad wins by holding the Prime Zone for three Resolutions in a row.

The current state is an **offline prototype**: you command the Bruiser of a Squad of three against an AI-controlled enemy Squad, on the Reactor Deck map, in a browser, held in landscape. There is no backend yet. The simulation runs in the browser behind the same interface a server will use later.

## Where to read what

| You want | Read |
|---|---|
| The idea and the design | `docs/PITCH.md`, the spec `docs/specs/offline-mvp-prototype.md`, the card set `docs/specs/mvp-card-set.md` |
| The words the project uses | `GLOSSARY.md` |
| Why things are the way they are | `docs/adr/` (one decision per file) |
| The UI and the assets | `docs/design/ui-spec.md`, `docs/design/asset-contract.md` |
| How agents and the owner work | `CLAUDE.md`, `CODING_STANDARDS.md`, `docs/agents/`, `docs/process/status.md` |
| What is planned and in progress | the GitHub issues and pull requests (they are the truth, not the docs) |

## Development

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run dev        # start the web app
npm run build      # production build of the web app
npm test           # unit tests of all workspaces (no browser)
npm run test:e2e   # browser smoke test with Playwright (builds first)
npm run lint
npm run typecheck
npm run sim        # AI-versus-AI simulations for balance analysis
```

CI runs lint, type check and tests on every pull request. The browser smoke test runs only when a pull request touches `apps/web/**` or the map data.

Layout:

- `packages/game-core`: rules, simulation, AI and game data. No browser APIs, no `Math.random()`; the same inputs always give the same result.
- `apps/web`: the React interface and the PixiJS rendering. It imports only `game-core` and `game-core/local-host`.
- `tools/factory`: the code of the software factory (see below).

See ADR 0017 and ADR 0018.

## How work happens

Work is tracked as GitHub issues. Issues labelled `ready-for-agent` are picked up one at a time by the **software factory**: a GitHub Actions workflow in which a Claude agent implements the ticket, a separate agent reviews the pull request, and low-risk pull requests merge automatically. Pull requests that touch design, decision, spec or agent files, the factory, or tooling are always merged by the owner. Design: `docs/agents/software-factory.md`; setup and switches: `docs/agents/factory-setup.md`. Code owners are listed in `.github/CODEOWNERS`.

## Deployment (Vercel)

The web app is a static single-page app. Expected project settings:

- Root Directory: `apps/web` (keep "Include source files outside of the Root Directory" enabled so the workspace package `game-core` is installed).
- Build Command: `npm run build`; Output Directory: `dist`.

These settings are not verified yet; check them when the Vercel project is first connected.

## License

Primefall is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, study and change it for any noncommercial purpose; commercial use is not allowed.
