# Where we stand, and what was decided against

A handover for a new session. It holds what the repository files do not say by themselves: the switches that live in GitHub settings, and the approaches that were tried and dropped. The live state of work is in GitHub: open issues and pull requests are the truth, not this file. Update the date line when you change something here.

Last checked: 2026-11-02.

## Work state

- All feature tickets of the offline MVP (#6 to #21) are done. Open: #22 (VFX and pose animation, for a human, depends on the final art), #25 (evaluate oblique instead of isometric projection) and #32 (think about parallel factory runs); both are decisions, not agent tickets.
- The factory is `factory.yml` (one run per ticket, self-restarting) plus `factory-retro.yml`. Design: `docs/agents/software-factory.md`; the story of how it got there and what to avoid: `docs/process/software-factory-playbook.md`.

## Switches (GitHub: Settings, Secrets and variables, Actions, Variables)

Values as last seen in run logs; check the settings page, this table can be stale.

| Variable | Value | Effect |
|---|---|---|
| `FACTORY_RUN_ENABLED` | `true` | Kill switch of the factory workflows |
| `AUTOMERGE_ENABLED` | `true` | Low blast radius pull requests are merged by auto-merge |
| `BLAST_RADIUS_ENABLED` | `true` | The rating is on; during the MVP only the path rules for the rules package are relaxed (`businessLogicPaths` is empty), see `tools/factory/blast-radius-rules.json` |
| `RETRO_EVERY` | unset (10) | The retro runs after every 10th merged agent pull request |
| `FACTORY_ENABLED` | may still exist | Not used any more; can be deleted |

## How the owner and the chat agent work together

- The owner writes German in the chat; everything in the repository is English (`CLAUDE.md`).
- A chat session acts through the owner's GitHub account, so repository settings cannot tell it apart from the owner. Merge a pull request only when the owner says so for that pull request. High blast radius pull requests (factory, agent files, `package.json`, `tsconfig`, the lock file, ADRs, specs) are the owner's decision.
- Files that only the owner decides on are in `.github/CODEOWNERS`.
- Anything that only exists in a chat is lost when the chat ends: put decisions into an issue, a pull request or these docs.

## Tried and dropped

| What | Why dropped | Where it left traces |
|---|---|---|
| Generating the final art with Fooocus (an asset plan with prompts and settings) | The owner did not get the results they expected | Deleted from the repository (`docs/process/fooocus-pixijs-asset-plan.md` in git history); `docs/design/asset-contract.md` still describes the file contract, which is independent of the tool |
| Blender (`bpy`, headless) sprite renders of a Bruiser prototype | The result looked cheap even after rework | Nothing in the repository |
| Matt Pocock's `retro` skill | It reviews one coding session; our work runs as cloud agents. The factory retro workflow covers merged pull requests instead | Not installed |
| Timers (a scheduled revive job) and an event chain of several workflows | GitHub does not start scheduled workflows reliably, and events caused by the workflow token start no workflows; every hand-over could stall | Playbook, section 7 |
| Several tickets in parallel | Conflicts, usage limits and review load | Issue #32 |
