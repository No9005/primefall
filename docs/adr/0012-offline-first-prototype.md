# Offline-First Prototype

The first Primefall prototype is an offline-first, mobile-friendly web game deployed on Vercel Free. The deterministic game simulation is TypeScript and runs in the browser inside a local Match Host, behind the same interface a server-side host will use later (see ADR 0017); there is no persistent backend or database in the initial prototype.

The player controls the Bruiser / Vanguard, while AI controls the other two allied Heroes and all three enemy Heroes. AI uses simple legal-action heuristics: move toward the objective, attack visible enemies, and block when appropriate.

The presentation uses stylized 2.5D with an orthographic camera and PixiJS rendering. Match state remains in browser memory, with optional localStorage support.
