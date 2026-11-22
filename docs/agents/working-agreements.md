# Working agreements with the owner

Standing agreements between the owner and the chat agent. They hold for every chat session until the owner changes them. Read this file at the start of a chat session. Anything that only exists in a chat is lost, so a new agreement is added here (one line, with the reason) in the same session it is made.

Related: `docs/process/status.md` (how the owner and the chat agent work together), `docs/design/decisions.md` (design decisions), `docs/agents/session-handover.md` (how a session ends and the next one starts).

## Communication

- The owner writes German in the chat; the repository (code, comments, commits, issues, pull requests, docs) is English.
- Answer short first: the result in a few lines, details on request.
- Do not make the owner repeat a decision. Before asking, look in `docs/design/decisions.md`, the ADRs and this file.

## Before spending, before building

- **External generation (ElevenLabs music or sound, images, video):** show the owner the exact prompt or plan and the expected credit cost (an upload costs extra) and wait for an okay before sending. Never retry a generation call.
- **Visual or audio changes the owner has not seen:** when asked, show a preview (artifact or screenshot) first and build after the owner picks a variant.
- **Tests and benchmarks:** run only what the change needs. A long run (the full end-to-end suite takes about 20 minutes) only when the owner asks. When the owner says "no tests", run none.
- **Pull requests:** open one only when asked. Never merge without the owner's word for that pull request. Say so when a change touches the factory's path rules (`tools/factory/blast-radius-rules.json`, `.github/CODEOWNERS`).

## Product decisions made in chat

- Names: **Notstrom Map** (the board; "Reactor Deck" is gone), **Notstrom Intro** (the film after Start), menu entry **Start** (not "Classic"). Attack and Defend is hidden and only reachable with `?menu=all`.
- Hero pictures live in `apps/web/public/assets/heroes` (the old head PNGs are deleted).
- Scenes (backgrounds, sprites, animation, transitions) are rendered by PixiJS; UI (buttons, text, HUD, cards, menus, glossary) stays HTML and CSS: ADR 0026. The migration is not started; the open choices are in the pull request that introduced the ADR and in the chat summary.
- Hero Select: NEXT is greyed out until a Hero is chosen and starts the match (transition later); no Hero info box for now; clips are idle, select, deselect.
- Music: the menu theme and the Notstrom Intro cue are made with ElevenLabs and archived with prompts and plans in `audio-source/music/`; the Hero Select loop is unchanged. Loops are baked with a cross-fade and scheduled on the audio clock.

## Working with specialists

- No specialist chats or subagent roles are set up now (the owner declined a pilot). If the owner asks for them later, a specialist is a separate chat that starts from `CLAUDE.md`, this file and its handover note.
