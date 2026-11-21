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

## Extension of B to 3 minutes (draft, not sent)

File: `./plans/menu-theme-extend-to-3-min.json`. The method of the Notstrom piece (inpainting in stages, see the README one level
up): the first chunk keeps the 75 s of B as an audio reference, four new chunks follow (30 + 30 + 30 + 15 s = 105 s). Stillness
(the choir alone), Pressure (the ostinato and percussion return, the motif with a fifth above), Second Climax (the full choir
in open fifths), Return (everything falls away to the sustained choir chord on D, as at the start, so that the piece loops). The
experiment of the owner: in **Pressure** very low, distorted guitar power chords (drop D, palm-muted, on D and C, doubling the ostinato; no solos, no high guitar); `guitar` is taken out of the negative styles of that chunk only. The
`song_id` is a placeholder: B has to be uploaded first (`POST /v1/music/upload`).
