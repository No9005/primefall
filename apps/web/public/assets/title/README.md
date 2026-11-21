# Title screen pictures

The pictures of the start screen (`apps/web/src/TitleScreen.tsx`, layout in `title-menu.ts`, styles in `title-screen.css`).
All are pixel art drawn at **640 x 296** (shown at 1.5 times in a stage of 960 x 444 design pixels, fitted to the screen)
and drawn together; positions of the parts are in `title-menu.ts`.

| File | Size | Use |
|---|---|---|
| `background.png` | 640 x 296 | the stars and the dark planet |
| `stars.png` | 640 x 296 | the stars that blink (two steps) |
| `haze.png` | 640 x 296 | the blue haze behind the crystal of the logo, added with `screen` |
| `logo.png` | 640 x 296 | the logo with the red banner and the line "Every Prime is a contract"; it bobs by 3 px |
| `tagline.png` | 640 x 296 | the two small lines at the foot: "By playing you agree to Form 27B" and the version "0.4 (Prime)" (the text is part of the picture) |
| `fireball.png`, `impact.png` | 150 x 90, 80 x 44 | a burning crystal and its burst on the atmosphere |
| `menu-<entry>-off.png` / `-on.png` | 300 x 40 (Classic), 300 x 28 | a row of the menu: plain text, and the red pill of the highlighted row |

They are made by `docs/design/title/tools/make_title.py` (see `docs/design/title/README.md`): change the script and run it, or replace
a file by hand and keep its size.
