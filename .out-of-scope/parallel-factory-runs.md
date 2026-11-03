# Parallel factory runs

The software factory works on **one ticket at a time**. We do not run several implement runs in parallel.

## Why this is out of scope

Running two or more tickets at once costs more than it gives:

- **Merge conflicts.** Parallel branches change the same files. Most feature work in this project goes through a few hot files (`Board.tsx`, `PlanningScreen.tsx`, `plan.ts`, `resolution.ts`, the card and map data), so the second pull request would regularly fall behind `main`. There is no automatic rebase step, and a conflict ends in a person resolving it by hand, which is what the factory exists to avoid.
- **Workflow validation.** The Claude action refuses to run when the workflow files of a branch differ from `main`. A branch that is behind in workflow files gets "did not run" instead of a review, so parallel branches need constant updating.
- **Usage limits.** On the subscription the factory runs under, two agents use the limits about twice as fast. The limits already end a day's work earlier than the ticket list does.
- **The owner is the bottleneck, not the agents.** A run takes about seven minutes per ticket; high blast radius pull requests wait for the owner to merge them. More parallel runs would only make the queue of waiting pull requests longer.
- **Little to gain.** The ticket graph is nearly a chain (blocked-by relations), so at most two tickets are free at the same time. The select step already looks at all tickets after each run and takes the lowest startable one.

A single global concurrency group (`factory`) keeps the pipeline simple and its failure modes easy to read.

## What would change this

A permanent parallel setup would have to solve the conflict problem first (for example tickets that touch disjoint areas, with an automatic rebase before review), and the owner's review load would have to stop being the limit. Neither is the case today.

See `docs/process/status.md`, section "Tried and dropped".

## Prior requests

- #32: "Consider running several factory tickets in parallel"
