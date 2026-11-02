# Domain Docs

How the engineering skills consume this repo's domain documentation. Single-context repo.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: the ADRs that touch the area you are about to work in.

If one of them does not exist, proceed silently. The `/domain-modeling` skill (reached via `/grill-with-docs`) creates them lazily when terms or decisions come up.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a test name), use the term as defined in `GLOSSARY.md`; do not drift to the synonyms it lists under _Avoid_. If the concept you need is not in the glossary, either you are inventing language the project does not use (reconsider) or there is a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
