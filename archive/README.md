# Archive

Sources and pictures that the app does not load, kept out of `apps/web/public` so that the build does not ship them. Nothing here is read by the game at run time; tools and tests read it.

| Folder | What | Who reads it |
|---|---|---|
| `hangar/strips/` | The strips of frames of the three hangar Heroes (`<hero>-<clip>.png`, and the `bridge` strips), drawn on the design canvas. They are the **only source** of the hangar atlases | `npm run atlas -w apps/web` (the packer and its check), `src/hangar-select.test.ts`, `docs/design/hero-select/tools/make_hangar_shadows.py` |
| `hangar/pictures/` | `hangar.png` (the plain hangar, 1280 x 732) and `flap.png` (the wall part that flaps, kept for the throw of Max). The scene draws `hangar-wide.png` instead | `docs/design/hero-select/tools/make_hangar_wide.py` (makes `hangar-wide.png` from `hangar.png`) |
| `notstrom-intro/sheets/` | The two sprite sheets of the Notstrom Intro (95 pictures of 640 x 296, 6 per row) | `docs/design/notstrom-intro/tools/encode_video.mjs` (makes the video the app plays), `src/notstrom-intro.test.ts`, `pack_sheets.py` (writes them) |

Rules: an asset the app loads belongs in `apps/web/public/assets`; a file that only a tool or a test reads belongs here, in a subfolder named for the screen it came from and the kind of file. When something moves here, change the tool or test that reads it in the same pull request.
