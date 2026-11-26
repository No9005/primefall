# Working agreements with the owner

Standing agreements between the owner and the chat agent. They hold for every chat session until the owner changes them. Read this file and `docs/design/world-and-style.md` at the start of a chat session. Anything that only exists in a chat is lost, so a new agreement is added here (one line, with the reason) in the same session it is made.

Related: `docs/process/status.md` (how the owner and the chat agent work together), `docs/design/decisions.md` (design decisions), `docs/agents/session-handover.md` (how a session ends and the next one starts).

## Communication

- The owner writes German in the chat; the repository (code, comments, commits, issues, pull requests, docs) is English.
- Answer short first: the result in a few lines, details on request.
- Do not make the owner repeat a decision. Before asking, look in `docs/design/decisions.md`, the ADRs and this file.

## Before spending, before building

- **External generation (ElevenLabs music or sound, images, video):** show the owner the exact prompt or plan and the expected credit cost (an upload costs extra) and wait for an okay before sending. Never retry a generation call.
- **Archive every generation, used or not.** ElevenLabs lets nothing be downloaded again (a song id only works as an audio reference), so a generation that is not archived is lost. Right after a generation: save the audio, the exact prompt or plan, the song or request id, the settings, the credit cost and the owner's verdict (used, discarded, why) in `archive/audio-source/` (music: a folder with a `README.md` and `PROMPTS.md`, as in `archive/audio-source/music/menu-theme/`). Discarded takes stay there too. Only the final file goes to `apps/web/public/assets/audio/`.
- **Generate music lossless** (owner, 2026-11-26), so that we keep the most options to work on it by our own ideas (loops, cuts, EQ, stems). Ask ElevenLabs for the highest-quality format the account allows (a lossless `pcm_44100` or WAV where offered, else the highest MP3, and say so in the archive's `README.md`), archive that file, and encode the game's AAC from it only once, at the end. If the account refuses a lossless format, tell the owner before spending.
- **Visual or audio changes the owner has not seen:** when asked, show a preview (artifact or screenshot) first and build after the owner picks a variant.
- **Tests and benchmarks:** run only what the change needs. A long run (the full end-to-end suite takes about 20 minutes) only when the owner asks. When the owner says "no tests", run none.
- **Pull requests:** open one only when asked. Never merge without the owner's word for that pull request. Say so when a change touches the factory's path rules (`tools/factory/blast-radius-rules.json`, `.github/CODEOWNERS`).

## Where decisions live

A decision is not kept here. Design and product decisions go into `docs/design/decisions.md`, architecture decisions into an ADR (`docs/adr/`), names into `GLOSSARY.md`, open work into an issue. This file holds only how the owner and the chat agent work together.

## Working with specialists

- No specialist chats or subagent roles are set up now (the owner declined a pilot). If the owner asks for them later, a specialist is a separate chat that starts from `CLAUDE.md`, this file and its handover note.
