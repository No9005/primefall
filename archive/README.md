# Archive

Sources and pictures that the app does not load, kept out of `apps/web/public` so that the build does not ship them. Nothing here is read by the game at run time; tools and tests read it.

| Folder | What | Who reads it |
|---|---|---|
| `hangar/strips/` | The strips of frames of the hangar Heroes Max and Kit (`<hero>-<clip>.png`, and the `bridge` strips), drawn on the design canvas. They are the **only source** of their atlases. Tilly's strips are gone: her atlas comes from the rig (`docs/design/heroes/tools/export-hangar.mjs`), and `make_hangar_shadows.py` can no longer run for her | `npm run atlas -w apps/web` (the packer and its check), `src/hangar-select.test.ts`, `archive/hangar/tools/make_hangar_shadows.py` |
| `hangar/tools/` | `make_hangar_wide.py` (writes `hangar-wide.png`) and `make_hangar_shadows.py` (writes the contact shadows `shadow.png`, `hangar-shadows.css` and `.ts` from the strips) | run by hand |
| `hangar/pictures/` | `hangar.png` (the plain hangar, 1280 x 732) and `flap.png` (the wall part that flaps, kept for the throw of Max). The scene draws `hangar-wide.png` instead | `archive/hangar/tools/make_hangar_wide.py` (makes `hangar-wide.png` from `hangar.png`) |
| `notstrom-intro/sheets/` | The two sprite sheets of the Notstrom Intro (95 pictures of 640 x 296, 6 per row) | `docs/design/notstrom-intro/tools/encode_video.mjs` (makes the video the app plays), `src/notstrom-intro.test.ts`, `pack_sheets.py` (writes them) |
| `audio-source/` | Everything made with ElevenLabs for the game's music, voice lines and effects that is not a final file: the plans (prompts and settings as JSON), song and request ids, every take, discarded takes with the owner's verdict, the loop and cut scripts. `audio-source/music/` (menus, themes, the Notstrom Intro cue, loop tools) and `audio-source/voice-sfx/` (voice lines, effects, review pages). **Archive every generation here, used or not** (`docs/agents/working-agreements.md`); only the final file goes to `apps/web/public/assets/audio/` | the `composer` and `sound-designer` skills, the READMEs inside (`audio-source/music/README.md`, `audio-source/voice-sfx/README.md`), the loop and export scripts under `tools/` and `voice-sfx/` |

Rules: an asset the app loads belongs in `apps/web/public/assets`; a file that only a tool or a test reads belongs here, in a subfolder named for the screen it came from and the kind of file. When something moves here, change the tool or test that reads it in the same pull request.
