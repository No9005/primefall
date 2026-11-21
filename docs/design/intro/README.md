# The film of the tap on Classic

After a tap on Classic the player sees a film of about nine seconds before the Hero Select: the title screen is pulled away, the
ship leaves the hyperspace, the Notstrom comes closer, an astronaut's visor mirrors it, the camera rides along the hull to the
airlock, and a flash fills the picture and fades out over the Hero Select. A tap skips it; a player who asked their device for
less motion, and an automated browser, go straight to the Hero Select (`?intro=on` plays it anyway).

The first 1.17 s are not in the sheets: the real title screen is pulled towards the planet and a tunnel of light streaks shows behind
it, drawn live by CSS (`title-screen.css`, class `flying`). The sheets start where the light ring at the end of the hyperspace
begins; the live part hands over to them by calling `onPlay` (`WHIP_MS` in `intro-film.ts`).

The film is pixel art: 95 pictures of 640 x 296 pixels at 12 a second, one palette of 64 colours, cross-fades and glows
turned into a 4 x 4 ordered dither. The app plays them from two sprite sheets (`apps/web/public/assets/intro/notstrom-*.png`,
6 pictures per row) with `NotstromIntro.tsx` and `intro-film.ts`.

## Making the sheets again

`film.html` is the film as layers and CSS animations (from the design canvas, 960 x 444 design pixels drawn at 640 x 296). Its
pictures are in `source/`, the title screen's in `apps/web/public/assets/title/`.

```
CHROMIUM_PATH=<chrome binary> node docs/design/intro/tools/render_frames.mjs /tmp/frames
python3 docs/design/intro/tools/pack_sheets.py /tmp/frames apps/web/public/assets/intro
```

`render_frames.mjs` pauses every animation at the time of each picture, so the same pictures come out every time.
`pack_sheets.py` prints the numbers (`frames`, `columns`, the sheets) that `FILM` in `apps/web/src/intro-film.ts` repeats; the
test `intro-film.test.ts` checks the sheet sizes against it. Change the film in `film.html`, render, pack, and update `FILM`.

Left out of the sheets: the caption "APPROACHING NOTSTROM" of the canvas (text is not pixel art) and the hangar that fades in
after the flash (the Hero Select follows instead).
