# Primefall

Mobile-first, 2.5D tactical 3v3 game with simultaneous planning and deterministic Resolution. See `docs/PITCH.md`, the spec in `docs/specs/` and the decisions in `docs/adr/`.

## Development

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run dev        # start the web app
npm run build      # production build of the web app
npm test           # tests of all workspaces
npm run lint
npm run typecheck
```

Layout: `packages/game-core` (rules, simulation, AI) and `apps/web` (React and PixiJS UI). See ADR 0017 and ADR 0018.

## Deployment (Vercel)

The web app is a static single-page app. Expected project settings:

- Root Directory: `apps/web` (keep "Include source files outside of the Root Directory" enabled so the workspace package `game-core` is installed).
- Build Command: `npm run build`; Output Directory: `dist`.

These settings are not verified yet; check them when the Vercel project is first connected.

## License

Primefall is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, study and change it for any noncommercial purpose; commercial use is not allowed.
