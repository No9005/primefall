# Where we stand, and what was decided against

A handover for a new session. It holds what the repository files do not say by themselves: the switches that live in GitHub settings, and the approaches that were tried and dropped. The live state of work is in GitHub: open issues and pull requests are the truth, not this file. Update the date line when you change something here.

Last checked: 2026-11-03.

## Work state

- All feature tickets of the offline MVP (#6 to #21) are done, and the UI rework and map tickets (#97, #98, #114 to #126, #131) are merged. Open: #22 (VFX and pose animation, for a human, depends on the final art), #25 (evaluate oblique instead of isometric projection) and #32 (think about parallel factory runs); both are decisions, not agent tickets. Follow-up fixes from the review of the UI work (for example #156, this cleanup) are tracked in GitHub.
- The factory is `factory.yml` (one run per ticket, self-restarting) plus `factory-retro.yml`. Design: `docs/agents/software-factory.md`; the pitfalls and the rebuild guide: `docs/process/software-factory-playbook.md`.
- Art direction: the MVP look is clear and graphic; the final look is 8/16-bit pixel art in a dirty sci-fi setting. Open question, not decided: how pre-drawn pixel art works for eight view angles (ADR 0021).

## Rule for whoever writes tickets

Every requirement of a ticket must be possible with what exists on `main`, or be listed under Blocked by. Evidence: #119 required a drawing that did not exist yet and failed review twice.

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
- The chat agent is the **orchestrator**: it creates and orders tickets, starts and watches the factory, investigates failures and prepares small fixes to the factory itself. The coding tasks go to the factory's agents. It writes product code only when the owner asks for that explicitly.
- Answer **short first**: the result in a few lines, details only when the owner asks. Start with **"Du bist dran:"** and at most three points that depend on the owner; give every decision a default proposal, so that "yes" is enough; one topic per message, and answer several topics one after the other instead of mixed. Reason: the owner follows many threads at once and finds it hard to track what is up to them (retro, #174).
- Open pull requests that wait for the owner carry `needs-human-merge`; a saved GitHub filter `is:open is:pr label:needs-human-merge` is the owner's inbox.
- Anything that only exists in a chat is lost when the chat ends: put decisions into an issue, a pull request or these docs.

## Tried and dropped

| What | Why dropped | Where it left traces |
|---|---|---|
| Generating the final art with Fooocus (an asset plan with prompts and settings) | The owner did not get the results they expected | Deleted from the repository (`docs/process/fooocus-pixijs-asset-plan.md` in git history); `docs/design/asset-contract.md` still describes the file contract, which is independent of the tool |
| Blender (`bpy`, headless) sprite renders of a Bruiser prototype | The result looked cheap even after rework | Nothing in the repository |
| Matt Pocock's `retro` skill | It reviews one coding session; our work runs as cloud agents. The factory retro workflow covers merged pull requests instead | Not installed |
| Timers (a scheduled revive job) and an event chain of several workflows | GitHub does not start scheduled workflows reliably, and events caused by the workflow token start no workflows; every hand-over could stall | Playbook, section 1 and the section 2 table "Events and timers" |
| Several tickets in parallel | Conflicts, usage limits and review load | Issue #32 |
