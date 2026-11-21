# The main-menu theme: how it was made

The piece of the start screen (`apps/web/public/assets/audio/music/menu.m4a`, 177 s loop). **Final: owner's decision 2026-11-21,
"it stays exactly like this".** Version 2 of B (`menu-theme-b-extended-v2-180s.mp3`). The prompts are in `PROMPTS.md` (the first prompt,
both extension plans, the results and the measurements), the plans as JSON in `plans/`, the ids in `ids/`.

## The idea of the piece

- A deep **bass male choir** (Gregorian and Tibetan monk chanting: wordless, chesty, throaty) runs through **every** piece of the
  game, as the thread of threat and mystery. The map pieces (Notstrom, later neon city, jungle, ice) put their own colour over it.
- **D minor** for all pieces (so that pieces can be blended). Not tied to the Notstrom (no 72 BPM), loopable.
- A **hook**: a four-note chant motif (D, F, E, D) that comes back and grows, a rhythm with drive, and a real arc, not 60 seconds of drift.
- The only satire stays in names and texts (see `docs/design/world/README.md`); the music is grim.

## The way (what to repeat)

1. **Write the prompt in plain text and let the owner read it before it is sent** (the owner asked for this). Give a concrete
   hook, key, tempo and timed sections; "mood" alone gives drifting atmosphere. Say "no lyrics, no lead singer".
2. **Make two takes** of a 75 s base piece through the connector (`music_v2_5`, 900 credits each); the owner picks one by ear. The
   owner's pick was B. Measure both: key at start and end, level over time, similarity of start and end (is it loopable?).
3. **Upload the pick** (`POST /v1/music/upload`, multipart `file`) to get a song id usable as an audio reference. The upload is charged
   like a generation (about 31 credits per second).
4. **Extend in stages with a composition plan** (`POST /v1/music`, `music_v2_5`, `seed` 424242): the first chunk is the reference
   `{song_id, range}` that keeps the part unchanged, then new chunks with `text` (`[Section]` and directions in braces),
   `duration_ms`, `positive_styles`, `negative_styles`. Several reference chunks in a row (also from different songs) join without a
   seam; a part of an earlier extension can be kept by its range (v2 keeps 20 s of v1). The result is as long as all chunks together.
   - **A line of `text` may have at most 200 characters** (otherwise 422, nothing is charged): split long directions into several
     brace lines.
   - To build a part again, only the new chunks are charged (about 31 credits per second of new audio).
   - Put a `guitar` in the negative styles of every chunk that should not have one.
5. **Measure the result** and tell the owner what could not be measured (the motif, the instruments). The kept part came back
   about 20 % quieter (the upload is not bit-exact); the level is brought back in the game by the gain.
6. **A climax is not made by asking for "louder"**: the model keeps one level. v2 gives the Second Climax more weight by length
   (40 s), a build at the end of the part before, and a different sound (a high choir an octave above, cymbals).
7. **Make the loop**: `tools/loops/make_menu_loop.py` blends the last 3 s with the first 3 s and encodes AAC (see the script).
8. **Game**: `menu` in `apps/web/public/assets/audio/music/manifest.json` (file and gain 0.5), `startMenu` and `stopMenu` in
   `apps/web/src/audio.ts`, called by `TitleScreen.tsx`. The theme plays while the start screen is shown and starts with the first
   tap (a browser allows sound only after one); it fades out when the start screen is left (the film of Classic starts then).

## Credits

About 1,800 for the two takes of the base, about 2,300 for the upload of B, about 3,300 for the extension v1 and about 2,650 for the new
parts of v2 (estimated from the seconds; the ElevenLabs account page has the real numbers).
