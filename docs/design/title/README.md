# Title screen: how the pictures are made

The start screen (`apps/web/src/TitleScreen.tsx`) shows pictures that are drawn from numbers by a script, so that a text or a
row can be changed without a graphic program.

```
python3 docs/design/title/tools/make_title.py            # writes apps/web/public/assets/title/
python3 docs/design/title/tools/make_title.py /some/dir  # or into another folder, to compare
```

It needs Pillow, NumPy and SciPy. The random parts have fixed seeds: a run without a change in the script gives the same files
(checked against the files in the repository when the script was added).

| Where in `make_title.py` | What |
|---|---|
| `# 1 background` | the stars and the planet (`sky`, `planet` in `tools/scene.py`: horizon height `hy`, radius `R`, seed, atmosphere, light) |
| `# 2 bright stars` | the stars that blink |
| `# 4 logo` | the letters ("PRIMEF" and "LL", the crystal stands between them), their colours and the crystal |
| `# 5 haze` | the glow behind the crystal |
| `# 6 ribbon, claim` | the red banner, the line "Every Prime is a contract" and the two small lines at the foot (**the version "0.4 (Prime)" is drawn here**) |
| `# 7 the menu rows` | the list `MENU`: file name, label and text scale of each row; the red pill is drawn in the second state |
| `# 8 the fireball` | the burning crystal and its burst |

`tools/pf.py` is the 5 x 7 pixel font (capital letters, digits and a few signs); a letter that is missing there must be added to
`G` first. A new menu row also needs a place in `apps/web/src/title-menu.ts` (`MENU_SLOTS`, `menuIds`) and an entry in
`TitleScreen.tsx`.

The layout of the picture on the screen (positions, the times of the loops) is in `apps/web/src/title-menu.ts` and
`apps/web/src/title-screen.css`, not in the pictures.
