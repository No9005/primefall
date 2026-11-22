# Session handover

A new chat session starts cold: it knows only `CLAUDE.md` and the files of the repository, not the earlier conversation. So a session that ends (or grows long and starts to forget decisions) leaves a handover note, and the next session is pointed at it.

## When

- At the end of a work package, or when the owner says to start a new session.
- Before the context of a long session is lost: write the note first, then continue.

## Where

`docs/process/handover/<yyyy-mm-dd>-<topic>.md`, committed on the working branch. The newest note for a topic replaces the older one (delete the old file in the same commit).

## Template

```markdown
# <Topic>: handover <date>

## Goal
One or two sentences: what this work package is for.

## State
- Branch and pull request (open or merged, never merged without the owner's word).
- What is done, what is verified (commands and results), what is not.

## Decisions (do not ask again)
- Each decision of the owner, one line, with the reason when known.

## Open decisions
- What the owner still has to decide, with the options and a recommendation.

## Files
- The files that matter and what each is for.

## Next step
The first thing the next session does.
```

## Starting a session from a note

The owner (or the chat agent) opens the new chat with: "Read `CLAUDE.md`, `docs/agents/working-agreements.md` and `docs/process/handover/<note>.md`, then continue with the next step." Decisions that are lasting (not just for this package) move from the note to `docs/agents/working-agreements.md` or `docs/design/decisions.md`.
