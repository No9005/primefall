# Prompts: the main-menu theme (`menu-theme/`)

The piece for the start screen, and for all maps: a deep bass male choir (Gregorian and Tibetan monk chanting, wordless, chesty
and throaty) that runs through every piece of the game, over D minor. Made 2026-11-21 with ElevenLabs Music v2.5 through the
ElevenLabs connector (not the API, so there is no plan file and no song id for inpainting; B was uploaded again for the extension).

## First version (75 s), the prompt as sent

Two takes (A and B) of the same prompt; 900 credits each. Settings of the connector: `music_v2_5`, 2 variations, lyrics type "auto",
"instrumental" off.

```
Instrumental main-menu theme for a grim, mysterious science-fiction tactics game, in D minor, about 84 BPM, slow heavy half-time feel. A memorable hook carries the piece: a deep bass male choir, in the manner of Gregorian and Tibetan monk chanting, very low, chesty and throaty, sings a short four-note wordless chant motif on D, F, E, D (long, short, short, long). The motif comes back at least three times, each time bigger. 0:00 to 0:12: a low sustained choir chord on D, a dark drone, sparse glassy bells. 0:12 to 0:30: the bass choir alone sings the motif in unison, with a cold sub-bass pulse underneath. 0:30 to 0:50: a driving low analog-synthesizer eighth-note ostinato on D and heavy percussion enter, the choir sings the motif with a fifth above, bells answer. 0:50 to 1:05: the climax, the full choir in open fifths sings the motif loud and wide, with a rising synth swell. 1:05 to 1:15: everything falls away except the sustained choir chord on D, exactly as at the start, so that the piece loops seamlessly. Mood: threatening, mysterious, a ritual in a dark place, an unexplained contract. Nothing cheerful, no guitar, no lead singer, no lyrics.
```

How the prompt was reached: the owner asked for a main piece for the menu that is loopable, not tied to the Notstrom map music (more
maps follow: neon city, jungle, ice), with deep, throaty male choir tones as the thread through all pieces; then for more bass
monk chant and D minor, and for a real hook instead of 60 seconds of drifting; the prompt gained a four-note motif, a tempo and
timed sections.

**Result (measured, not heard by the author of the file):**

| | A (`menu-theme-a-75s.mp3`) | B (`menu-theme-b-75s.mp3`) |
|---|---|---|
| Length | 75 s | 75 s |
| Key at start / end | D, A, E / D, A, C# (the chroma of start and end is 94 % alike) | D, A, C# / B, E, C (41 % alike) |
| Level | rises to a plateau from 20 s, ends in silence (a fade-out, so the loop has a dip) | rises slowly to the peak at 60 to 70 s, ends loud |

The owner judged **B better**. A is kept as the second take. B is to be extended to 3 minutes (below).

## Extension of B to 3 minutes, version 1 (sent 2026-11-21; plan `plans/menu-theme-extend-v1.json`, result `menu-theme-b-extended-v1-180s.mp3`)

File: `./plans/menu-theme-extend-to-3-min.json`. The method of the Notstrom piece (inpainting in stages, see the README one level
up): the first chunk keeps the 75 s of B as an audio reference, four new chunks follow (30 + 30 + 30 + 15 s = 105 s). Stillness
(the choir alone), Pressure (the ostinato and percussion return, the motif with a fifth above), Second Climax (the full choir
in open fifths), Return (everything falls away to the sustained choir chord on D, as at the start, so that the piece loops). The
experiment of the owner: in **Pressure** very low, distorted guitar power chords (drop D, palm-muted, on D and C, doubling the ostinato; no solos, no high guitar); `guitar` is taken out of the negative styles of that chunk only. B was uploaded first (`POST /v1/music/upload`, song id `Q3vqUJ4FaeG5UyUbPWWC_upload`), then the plan was sent with seed 424242; the result has the song id `46C9jMiQ1oxB947SvFsK` (`ids/menu-theme-extend.hdr`).

**Result (`menu-theme-b-extended-180s.mp3`, 180 s; measured, not heard by the author of the file):**

- The first 75 s have the same sound as B (spectral similarity 0.995 to 1.0 in every 5 s) but are about 20 % quieter; the waveform is not identical (the upload is not bit-exact).
- The new parts are a little quieter in the Stillness (75 to 105 s; level about 0.18 against 0.24 to 0.27 in the climaxes), so the drop is only partly there. Pressure and the Second Climax are at about 0.27.
- **The loop:** the start and the end have the same key (D, A) and a chroma similarity of 0.99. The end fades to near silence over the last 3 s (level 0.03, 0.01, 0.004), the start fades in (0.023 in the first second): a short crossfade closes the loop.
- Whether the guitar power chords in Pressure are there and sound right cannot be seen in a measurement (the band above 500 Hz is only 10 % there, which speaks for a low, dark sound); the owner has to listen.

**Owner's verdict on v1:** the E-guitars sound good and may play more than one note; Stillness should be shorter; Pressure may be more intense; the piece lacks a real climax, the Second Climax is much too weak against the part before Stillness. Pressure and Second Climax are generated again (v2). The old chunks are kept as audio: `v1-chunk-pressure-1m45-2m15.mp3` and `v1-chunk-second-climax-2m15-2m45.mp3` (cut from the v1 file), their prompts are in `plans/menu-theme-extend-v1.json`.
