# Finale loop: the refrain at the end (decided 2026-11-18)

The finale is **only the refrain**, made as a loop: bridge in, then the refrain as long as the game needs it, then a bridge back. The layers (drone, bass, rhythm) stay independent, 16 bars, no reference. The refrain is made like the whole piece was (in stages, with the earlier part as an audio reference for the later part), because voices as separate layers did not hold together.

## Text (Variant B, chosen by the owner; 8 lines = 16 bars at 2 bars per line)
```
NOTstrom, NOTstrom!
Drei Herren zahlen für unser Blut,
jeder will, was keiner kennt.
NOTstrom, NOTstrom!
Die Zone gehört dem, der bleibt.
Nicht von uns, nicht für uns.
NOTstrom, NOTstrom!
Der Fall war erst der Anfang.
```
Part 1 = lines 1 to 4 (8 bars, this test), part 2 = lines 5 to 8 (to be made with part 1 as the reference).

## Sound decisions
- Men: deep chest voices as the **background choir** for the energy (open vowels, powerchords = parallel fifths). One single female voice sings the lyrics. Mood: dark heroic, grim but resolute, defiant.
- Optional alternative: a metal version (growl choir, power chords with electric guitars, double bass bursts after sudden silence), as its own generation without a reference, 144 BPM (half-time feel at 72). Not made yet. Inpainting is not expected to change the style (the reference wins the sound, see the F minor tests).

## Open design points
- The loop seam lies in the voices: ask for a breath in the last bar; blend inside the pause.
- Exit from the loop at every phrase (4 bars), with a generic bridge back (a short drop on D), not only at the end of 16 bars.
- Bridges: try a bar-line crossfade with a riser or impact (sound effects) before generating any.

## Test 2 (2026-11-18): the full 16 bars, after the owner's feedback on test 1
Feedback on test 1: basically good; **the female voice is missing; no urgency (it sounds like the middle of a piece, not the grand finale)**; idea: add off-beat elements to drive it.
Changes in the prompt (see `v2-api-payload.json`, two chunks of 8 bars in one call, lines 1 to 4 and 5 to 8): the female lead is "clearly audible and in front of the choir, soaring" (no more "not dominant") and is named first in the directions; "the grand finale ... maximum energy, urgent, relentless, climactic, wall of sound"; "syncopated off-beat elements: off-beat synth stabs, off-beat hi-hats"; driving eighth-note bass; negatives: sparse, calm, intro; the last beat is "a short pause" (for the loop seam). Cost about 1,650 credits.
Measured: 53.4 s, tempo 71.79 BPM, level -16 dB and even over the bars, **the last bar is 8 dB quieter (-24 dB: the intended pause)** and the first bar 3 dB quieter (a lead-in); the first beat at 0.195 s. **Off-beat hats (above 5 kHz) are 1.9 times as strong as on the beat (test 1: 0.8)**, so the off-beat elements are there. More presence (1 to 4 kHz: 16 % against 10 %) and less bass (under 120 Hz 39 % against 56 %). Bass root right in 6 of 8 windows. Whether the female voice is now in front is for the owner to judge (it cannot be measured here).
`v2-16bars-loop-aligned-72bpm.mp3`: stretched to exactly 72.000 BPM, cut to exactly 16 bars from the first beat, the end blended into the start (60 ms). Song id `UBRewBqAovpBjdX1k2ZB`.

## Files
- `v1-8bars-female-lead-male-background.mp3`: result of test 1 (26.7 s, 128 kbit/s). Song id `V9P7lVVTvUNF6cWaEb4f` (stored for inpainting).
- `v1-api-payload.json`: exactly what was sent to `POST /v1/music` (the prompt is the chunk's `text` and styles). No seed, no reference.
- `v1-response-headers.txt`: the response headers.

## Measured (test 1)
Tempo 71.87 BPM (planned 72); 56 % of the energy under 120 Hz, 20 % in 300 Hz to 1 kHz (the first refrain test: 49 % and 24 %); level -12.2 dB, even over all 8 bars (-13 to -12 dB); D is the strongest pitch class (44 %), the bass root is right in 4 of 4 windows. How the voices sound is for the owner to judge.
