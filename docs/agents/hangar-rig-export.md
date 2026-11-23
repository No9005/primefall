# Moving a hangar Hero onto the rig export

Task: a Hero of the Hero Select hangar (Max or Kit) still plays an atlas packed from strips drawn on the design canvas. Their figure does not look like the Hero on the map. Make the atlas come from the Hero's rig instead, as was done for Tilly (commits `6a0b203` and `10bebc7` on `agent/hangar-tilly-map-look`): same figure as the map, same clip names, frame counts and times as before, effects on their own layers.

Read first: `docs/design/heroes/README.md` (section _Hangar clips_), `apps/web/scripts/ATLAS.md` (section _Atlases from the rig_), `docs/design/animation-criteria.md` (including the rule that Heroes never overlap in the Hero Select), `.claude/skills/pixel-artist/`. Tilly's `docs/design/heroes/tools/hangar-controller.js` is the worked example; copy its structure.

Working agreements for this task: show the owner a preview before anything is committed; commit and push only when asked; no pull request unless asked. Downloads (`npm install`, `npx playwright install chromium`) only after an explicit yes.

## Steps

### 1. Set up

Node lives in `~/.local/opt/node/bin` (not on the PATH of the `comfy` distrobox): `export PATH=$HOME/.local/opt/node/bin:$PATH`. Run `npm install`, and `npx playwright install chromium` if `~/.cache/ms-playwright` is empty.
Done when `node docs/design/heroes/tools/export-hangar.mjs controller --preview <folder>` writes contact sheets.

### 2. Read the old clips

The tables `CLIPS` and `BRIDGES` in `apps/web/src/hangar-select.ts` name every strip, its frame count and time. Render each strip of your Hero from `archive/hangar/strips/` as a numbered contact sheet (8 columns, 1x) in a Playwright page and look at them with the Read tool. Pass the PNG to the page as a `data:` URL: a `file://` image does not load into a page made with `setContent`.
Write down, per clip, the beats (what the arm, weapon or effect does in which frame) before you author anything. Done when every clip of the Hero has a beat list.

### 3. Fix the frame and the feet

Tilly's frame is 136 x 116 with the feet at (58, 112), the constants `export-hangar.mjs` swaps into the rig. Your Hero's old frame is different (Max 190 wide, Kit 118 high; `FRAME_ART` in `archive/hangar/tools/make_hangar_shadows.py`). Read the old atlas (`apps/web/public/assets/hangar/atlas/<hero>.json`: `sourceSize` of any frame, and where the feet and the shadow contact are, see `CLIP_SHADOWS` in `src/hangar-shadows.ts`) and make the frame size and the feet position settings of the `HEROES` entry in `export-hangar.mjs` instead of the Tilly constants. The rig's own line (`const SW = 136, SH = 104, OX = 58, OY = 86`) is what the exporter replaces; check it is the same text in the other rig.
The scene scales a Hero by `PLACE[hero].width / sourceSize.w` (`hangar-scene.ts`). A 136 px frame for Max shows him smaller than today's 190 px frame (482 design px wide). Ask the owner whether Max keeps his on-screen size (then widen the frame) or follows the map. Done when the owner has answered and the frame and feet are settings.

### 4. Author the clips

Create `docs/design/heroes/tools/hangar-<class>.js` (`bruiser`, `assassin`) like `hangar-controller.js`:

- Reuse the rig's own clips where the choreography matches (the `SEL_IDLE` and `SEL_READY` Hero Select clips, the attack clips) and write new tracks for the rest.
- Keep `HANGAR_FRAMES` and `HANGAR_MS` equal to `CLIPS` and `BRIDGES`; `HANGAR_EXPORT` lists clip, source moments and loop or one-shot for each.
- `blendClip` makes the short hops (`tolift`, `toidle`, `desel`, the bridge). Its clips have no effects, which is fine for two frames.
- Effects go in `back(S, t, info)` and `front(S, t, info)` so they land on the layers `fx_back` and `fx_front`. Max's baked-in effects (shotgun flash, shells, smoke) are why this exists: read the strips to find them and redraw them as layer effects.

Two things the rigs of Max and Kit do that Tilly's does not, and `export-hangar-page.js` does not yet handle: Max has cigar smoke (`cigarSmoke` with `smokeTime`) and Kit has a cape and sash that flutter (`flutter` in `export-tail.js`). Both fit their motion to the loop length when the clip is a loop, and `export-hangar-page.js` passes `loop: false, dur: 1` to `renderLayers`. For a looped hangar clip pass the real `loop` and `dur` (and `t0` as the clip's start), or the last frame will not lead into the first. Done when the idle of your Hero loops without a visible jump.

### 5. Render and compare

Add the Hero to `HEROES` in `export-hangar.mjs`, then run `node docs/design/heroes/tools/export-hangar.mjs <rig> --preview <folder>`. Put the old contact sheet and the new one side by side for each clip and fix each deviation in the beats, the timing, the feet and the Hero's look (colours, proportions, hands) until they agree; the look is the map's, the choreography is the old one's.
Done when each clip's new sheet matches its beat list and the Hero is recognisably the map Hero in every clip (same arms, same gear in every frame).

### 6. Switch the app over

- `RIG_HEROES` in `hangar-select.ts`: add the Hero; remove its `file:` entries.
- `git rm` its strips in `archive/hangar/strips/`; update `archive/README.md`.
- `CLIP_SHADOWS` and `BRIDGE_SHADOWS` in `hangar-shadows.ts` are per frame in design pixels and were computed from the old strips; a Hero whose feet or jumps changed needs them recomputed (the script reads strips that are gone for rig Heroes: compute them from the rig's feet instead).
- Update `ATLAS.md`, `public/assets/hangar/README.md` and the section _Hangar clips_ in `docs/design/heroes/README.md`.

### 7. Look at it in the app

`npm run screenshots -w apps/web -- --scenario hero-select`, then Read each frame (`01-idle` to `07-window-21-9`). Check the Hero's feet on the floor, the shadow, and that no Hero overlaps a neighbour (the select clips of Max are the usual offender). List the frames you looked at.
Then run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` from the repository root; all pass.

## Where the tooling stands

- Tilly (`controller`) is done; `export-hangar.mjs` knows only her.
- `npm install` does not run the install scripts of esbuild here; the tests do not need them.
- Git cannot push over HTTPS from the distrobox (no credentials); the owner's SSH key works for a one-off `git push git@github.com:No9005/primefall.git <branch>`.
