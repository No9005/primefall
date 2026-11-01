# Tooling, Testing and CI

TypeScript in strict mode, npm workspaces, Vite with React for `apps/web` (a static single-page app on Vercel; Next.js is not needed without server rendering), Vitest and ESLint. Root scripts are `dev`, `build`, `test`, `lint` and `sim`. The GitHub CI runs lint, tests and a type check; Vercel already builds every push and pull request.

The Match Simulation is the primary test seam: scenario tests on the Reactor Deck call `resolveRound` and assert the resulting state and events, a determinism test runs identical inputs twice, and an AI-versus-AI smoke test plays 20 fixed seeds of at most 60 rounds each and asserts that every round is legal and every match ends. The smoke test is part of `npm test` and must keep the whole suite quick (target: well under 10 seconds). Large runs (for example 1000 seeds) are the separate `npm run sim` script for manual balance analysis and are not part of CI.

`apps/web` gets unit tests only for real logic (local host, building a Squad Plan from UI input); no browser or PixiJS tests in the MVP. Browser tests are future work, see the offline MVP spec.

Cards are declarative data (type, cost, range, a list of effects such as damage, Shield, Slow, Knockback, place Cover, reveal) with one interpreter per effect kind, so the UI renders card text from data and balance changes are data changes.
