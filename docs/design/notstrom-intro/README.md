# The Notstrom Intro of the tap on Classic

After a tap on Classic the player sees a Notstrom Intro of about nine seconds before the Hero Select: the title screen is pulled away, the
ship leaves the hyperspace, the Notstrom comes closer, an astronaut's visor mirrors it, the camera rides along the hull to the
airlock, and a flash fills the picture and fades out over the Hero Select. A tap skips it; a player who asked their device for
less motion, and an automated browser, go straight to the Hero Select (`?notstrom-intro=on` plays it anyway).

The first 1.17 s are not in the sheets: the real title screen is pulled towards the planet and a tunnel of light streaks shows behind
it, drawn live by the title scene. The sheets start where the light ring at the end of the hyperspace
begins; the live part hands over to them by calling `onPlay` (`WHIP_MS` in `notstrom-intro.ts`).

The Notstrom Intro is pixel art: 95 pictures of 640 x 296 pixels at 12 a second, a palette for every scene (112, 56 and 56 colours,
no dither: a dither pattern made the dark, smooth parts grainy; the colours of the first version were also too few and lost the
yellow and red). The sheets (`archive/notstrom-intro/sheets/notstrom-*.png`, 6 pictures per row) are the source; the app plays a
video made from them (below) as the scene `notstrom-intro` on the stage (`notstrom-intro-scene.ts`, `NotstromIntro.tsx`).

## The video

`notstrom-intro.webm` (VP9) and `notstrom-intro.mp4` (H.264) in `apps/web/public/assets/notstrom-intro/`: the 95 pictures at 12 a second
(7.92 s), each scaled by 2 with nearest neighbour to 1280 x 592 before encoding, without sound (the sound is timed by the audio clock). The
pictures are 640 x 296, a ratio of 2.16:1 (not 2.39:1); the scene shows them whole, as large as fits, never cropped.

```
node docs/design/notstrom-intro/tools/encode_video.mjs           # needs ffmpeg and ffprobe on the PATH
node docs/design/notstrom-intro/tools/encode_video.mjs --check   # decodes both files and compares every picture with the sheets
```

Settings (deterministic): pictures cut with `crop`, changed to RGB, then scaled with `flags=neighbor` (scaling the palette picture directly is off by half a picture point); BT.709 limited range, `yuv420p`; VP9 `-crf 10 -b:v 0
-deadline best -cpu-used 0 -row-mt 0 -g 12`; H.264 `-preset veryslow -crf 8 -profile:v high -g 12 -movflags +faststart`. The check scales
each decoded picture down by 2 (area average) and requires a mean absolute difference of at most 6 of 255 per colour channel (the codec
spreads colours of neighbouring pixels in 4:2:0), plus 95 pictures, 12 fps and the size.

### Making another video from pixel art: what went wrong the first time

Read this before you encode any other film from sheets or frames; the encode script is the model to copy.

- **Palette pictures (`pal8`) must be changed to RGB before they are scaled.** `ffmpeg -vf scale=...:flags=neighbor` on a palette PNG does not
  double exactly: the result is off by half a picture point and blurred (8 % of the points were exact, the rest were mixed with a neighbour).
  `format=rgb24,scale=iw*2:ih*2:flags=neighbor` is exact (100 %). The sheets of the Notstrom Intro are palette pictures.
- **The symptom was misleading.** The first encode was 54 Mbit/s (53 MB for 8 s) and `--check` failed with a difference of 11 to 15 of 255 *even at
  that bitrate*. A difference that does not fall when the quality rises is not codec noise: look for a systematic error before the first
  encode settings (CRF, preset, colour matrix, dithering) are tuned. Ruling things out took one test each: the colour matrix and dithering made
  no difference; the doubling was the cause.
- **Measure the steps without the codec.** Compare each step against an exact reference you build yourself (for a doubling: `numpy.repeat` of the
  sheet's picture): sheet to doubled picture, doubled picture to `yuv420p` and back, and only then the encoded file. The error of the whole chain
  after the fix is 1.7 to 2.5 of 255; the file is 1.6 MB (WebM) and 2.5 MB (MP4).
- **Do not judge a picture by looking at the whole frame.** The dark, noisy-looking decode was only visible next to the reference; use a 4 x
  crop with nearest-neighbour zoom (`crop=240:120:x:y,scale=iw*4:ih*4:flags=neighbor`) to see the pixel blocks and compare.
- **Keep the check.** `--check` compares every decoded picture, scaled down by the same whole number with an area average, with the sheets. A new
  video gets the same check with its own picture count, size and frame rate; do not loosen the tolerance to make a file pass.

## Making the sheets again

`notstrom-intro.html` is the Notstrom Intro as layers and CSS animations (from the design canvas, 960 x 444 design pixels drawn at 640 x 296). Its
pictures are in `source/`, the title screen's in `apps/web/public/assets/title/`.

```
CHROMIUM_PATH=<chrome binary> node docs/design/notstrom-intro/tools/render_frames.mjs /tmp/frames
python3 docs/design/notstrom-intro/tools/pack_sheets.py /tmp/frames archive/notstrom-intro/sheets
```

`render_frames.mjs` pauses every animation at the time of each picture, so the same pictures come out every time.
`pack_sheets.py` prints the numbers (`frames`, `columns`, the sheets) that `NOTSTROM_INTRO` in `apps/web/src/notstrom-intro.ts` repeats; the
test `notstrom-intro.test.ts` checks the sheet sizes against it. Change the Notstrom Intro in `notstrom-intro.html`, render, pack, and update `NOTSTROM_INTRO`.

Left out of the sheets: the caption "APPROACHING NOTSTROM" of the canvas (text is not pixel art) and the hangar that fades in
after the flash (the Hero Select follows instead).
