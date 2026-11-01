# Server-Authoritative Match Host and Package Boundary

Only a Match Host computes the outcome of a match. The client sends Squad Plans and renders what it receives; it never runs `resolveRound` and never sees the full Match State. The full Match State (seed, PRNG state, Deck order, Hands, Ghost memory) exists only inside the host, so a client cannot predict draws or read hidden enemy information.

The repository is an npm-workspaces monorepo: `packages/game-core` (rules, simulation, AI, card, Hero and Reactor Deck data) and `apps/web` (Vite, React, PixiJS); a later `apps/server` hosts `game-core` over Colyseus. `game-core` has three entry points: `game-core` (types for Squad View, Squad Plan and events, `validatePlan`, card definitions for display), `game-core/server` (full Match State, `createMatch`, `startRound`, `resolveRound`, `getSquadView`, `getSquadEvents`, `planSquad`, PRNG) and `game-core/local-host`. `apps/web` may import only the first and the last; ESLint forbids `game-core/server` there.

The offline prototype runs the host in the browser's main thread behind the same asynchronous interface (`submitPlan`, receiving Squad View and events) a network host will use, so moving the host to a server changes no client code. The host owns the planning timer; allied and enemy AI plan immediately at round start; if a human Squad has not committed when the timer expires, its Heroes' queues are empty.

## Information visible to a client

Own Hand always; own Deck and Exile as counts. For a Visible enemy Hero: position, Shield, and Deck, Discard and Exile counts. A Ghost shows the last seen values; an Unknown Hero shows nothing. Enemy Hands, Energy, queued actions, the seed and the PRNG state are never sent. Events reach a client only through `getSquadEvents`.

## Randomness

The only randomness is Deck shuffling (initial shuffle and Discard reshuffle). It uses a seeded PRNG whose state is part of the Match State, so consecutive shuffles differ and every match is reproducible from its seed and plans. The core never calls `Math.random()`.

## Considered Options

A client-side simulation shared with the server (as ADR 0012 originally implied) is simpler offline but would leak hidden information and force a rewrite for multiplayer. A single package with a lint rule is less setup, but a package boundary lets the server be deployed separately.
