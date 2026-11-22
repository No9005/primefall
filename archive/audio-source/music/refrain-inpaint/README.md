# The refrain made loopable by inpainting (2026-11-19)

**Problem.** The refrain on `main` (the first refrain test, cut to 8 bars) did not loop cleanly: a click at the seam, then, once the click was gone, an audible edge ("schwuap") between the end and the start. Everything done in the signal did not remove it (see below).

**What worked.** Let ElevenLabs write the transition. `plans/plan-b-seed424242.json` keeps the first 23.667 s of the refrain (an audio reference chunk), asks for 3 s of new music that sings the rest of the line ("verliert sich selbst") and flows back to the first beat, and then keeps the first 6.667 s of the refrain again behind it. The model connects the end to the start. About 93 credits (3 s new; kept parts are free).

- Result: `results/refrain-inpaint-b-seed424242.mp3` (33.4 s), song `iTJCfxy6V6HzoZg1k0O8`, stored for inpainting. The owner heard it: the refrain, only longer.
- The first call answered 422 (a line of `text` over 200 characters, nothing charged); the text was split into lines and sent again.
- The beat grid of the output is exactly 72.000 BPM from the first to the last second (the old file ran at about 72.16 BPM).
- Measured: the "kept" parts do **not** match the old file sample by sample (correlation 0.08 to 0.33 at any lag), so the output is a re-render, not a copy. The owner confirmed by ear that it is the refrain.

**The loop** (`../tools/loops/inpaint_loop.py`): start at a rising zero crossing 25 ms in (15 ms before the first beat), the end exactly 8 bars (1,175,971 samples) later, and the real continuation behind the end (the refrain's bar 1 again) cross-faded into the start over 100 ms with an equal-power curve; level matched to the old file (-21.5 dB). Seam step 0.013 (a typical step is 0.064), spectral similarity across the seam 0.83. The owner: "loop ist seamless". It is `apps/web/public/assets/audio/music/refrain.m4a` (commit `dd081ed`). The end of the loop is darker than the start (centroid 1,621 against 2,800 Hz): that is the held choir chord of the new part.

## What was tried before, and did not remove the edge

All measured on the old file; scripts in `../tools/loops/`.

| Try | Result |
|---|---|
| Zero crossings at start and end (+-20 ms) and overlap-add with the overhang behind the end (`seamless.py`) | seam step 0.358 to 0.007; the edge stayed |
| Slowing the file from about 72.16 to 72.000 BPM (the beats slipped 45 ms over the loop) | beat phase flat now; the edge stayed |
| Tail fold: 500 ms of tail faded and added to the first 500 ms (`seamless2.py`) | no real tail in the file, so a matched stand-in; no gain |
| Phase correlation (`scipy.signal.correlate`, 50 ms) to move the end point, then a crossfade | spectral similarity 0.87; the edge stayed |
| High-shelf +4 dB at the end (as asked) | made the brightness gap worse (-22 % to -35 %); the end is brighter than the start, so the start must be raised (+4 dB: -5 %) or the end cut |
| Other cut points: 4-bar loops from the middle of the file, played twice (`cutpoints.py`, `cut4.py`) | measured no better than the 8-bar seam, and it repeats the lyrics |
| Level, centroid, fundamental and chroma of the first and last 100 ms | no jump in level (+0.4 dB), centroid -24 % (inside the file's own variation), chroma 0.97; no pitch could be read from the dense mix |

The conclusion: the edge was in the music (the end of the phrase does not lead into the start), not in the cut. Only new material that connects the end to the start removed it.

## Plans and sources

- `plans/`: the plan that was sent (`plan-b-seed424242.json`) and the ones that were not (seeds 7 and 99 of plan B; plan A replaces the last two bars and drops the line).
- `PROMPTS.md`: the prompts in readable form. `run-plan-a.sh`, `run-plan-b.sh`: the curl calls (`DRY_RUN=1` by default; the key is a placeholder that the proxy replaces).
- The reference song: `fZDeTVYfbJujEraIqfiL_upload` (the README table calls it the uploaded refrain test).
