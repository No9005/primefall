# Loop tools (2026-11-19)

The Python scripts that cut, measured and fixed the loops of the music and the end music. They were run from a session folder with the sources beside them (`../before/refrain.m4a` and so on), so their relative paths and `D` in `grid.py` have to be adapted before they run again; they are kept to show the method and the numbers. Needs `numpy`, `scipy`, `librosa` and `ffmpeg` (with `rubberband`).

| Script | What it does |
|---|---|
| `grid.py` | decodes a layer, the beat-grid flux and phase fit |
| `ph.py` | beat-grid phase per 2-bar window (the 1.5 to 6 kHz band is the clean one): shows the tempo drift of a file against 72 BPM |
| `fixall.py` | seam metrics (step, spectral similarity), the rubberband stretch, the AAC encode with the container length; the first repair of drone, pulse and drums (despike, continuation patch, slowing the drums to 72 BPM) |
| `seamless.py` | cuts at zero crossings, overlap-adds the overhang with an equal-power crossfade, checks the onset strength with librosa |
| `seamless2.py` | tail fold (500 ms added) and phase correlation with `scipy.signal.correlate` |
| `shelf.py` | a time-varying high-shelf at the start or end of a loop |
| `cutpoints.py`, `cut4.py` | 4-bar loops from the middle of the refrain, scored by what follows the end |
| `ola.py` | overlap-add on the mid and high band only |
| `inpaint_loop.py` | the loop of the inpainted refrain (the one in the game) |
| `pads.py`, `tonal.py`, `before_drums.py` | the free pads from the jingles (Paulstretch, tonal peaks only) |
| `build_page.py`, `page_body.html` | the listening page of the end music |

## What the numbers taught

- A layer file runs at about 72.16 BPM, not 72.000: the beats slip about 45 to 60 ms over 8 bars. Slow it (rubberband, tempo 72/72.16) before the cut, or the wrap comes in early. The files of the generated pieces from `music_v2_5` inpainting run at exactly 72.000.
- A butt joint at a zero crossing removes the click, not the musical edge.
- Equal-power cross-fade **into the material that really follows the end** (an overhang or a regenerated continuation), never into the start itself (that doubles the downbeat).
- A time-stretcher alters the first and last samples of a file: stretch first, then cut.
- Container length of an AAC file: see `../end-music/README.md`.
