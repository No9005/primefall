---
name: composer
description: Composing Primefall music with ElevenLabs. Use when making, extending, replacing or looping a piece of game music (menu, map, intro, end music).
---

A piece is composed **chunk by chunk and extended by inpainting**, never in one call: one call drifts (tempo, key, instruments) and the owner judges every part by ear. Cost and archive rules are in `sound-designer`; read it for the shared steps (prompt shown first, one call per take, archive at once).

## Vocabulary

Prompt and judge in the terms of a composer; these words steer the model and the owner's notes alike:

- **Motif** (a short figure that returns and grows; the menu theme's is D, F, E, D), **hook**, **countermelody**, **ostinato**, **pedal tone**, **drone**.
- **Mode and cadence:** key and mode (D minor), chord progression, cadence, modulation.
- **Form:** intro, verse, build, refrain, bridge, breakdown, climax, outro; a section has a **dynamic arc** (crescendo, release).
- **Texture and orchestration:** which voices play (bass choir, analog synths, drums, guitar) and which are held back; a climax is made by **orchestration and length**, not by asking for "louder" (the model keeps one level).
- **Rhythm:** tempo in BPM, pulse, groove, syncopation, fill.

The sound of the game (analog synths, a deep throaty bass male choir in every piece, D minor, a hook) is in `docs/design/world-and-style.md`.

## Make a piece

1. **Plan it as sections** with a motif, a key, a tempo and what each section adds. Done when each section has a name, a length and one sentence of intent.
2. **Make a base** of the idea (75 s, two takes) and let the owner pick by ear. Measure the pick: key at start and end, level, start against end (loopable).
3. **Upload the pick** (`POST /v1/music/upload`) to get a song id that can be an audio reference.
4. **Extend by chunks with a composition plan** (`POST /v1/music`, `music_v2_5`, `store_for_inpainting` true, fixed `seed`, `context_adherence` high). The first chunk is the reference `{song_id, range}` that keeps the earlier part unchanged; each new chunk has its own `text`, `duration_ms`, `positive_styles` and `negative_styles`. Several reference chunks in a row join without a seam; a part of an earlier extension is kept by its range. Only the new chunks are charged.
5. **Redo a weak part by inpainting:** keep the good chunks as references and write only the weak section again. The kept parts stay the same (measured correlation 0.9986 to 0.9999), so a fix costs the length of the new part, not the piece. A section that is too weak (the second climax lost against the part before) is rebuilt with more length, a build at the end of the part before it and a different sound.
6. **Request the highest-quality (lossless) output format every time** (owner's rule, `docs/agents/working-agreements.md`): `output_format` a lossless `pcm_44100` or WAV where the account offers it, not `mp3_44100_128`. Archive that file and make the game's AAC from it once, at the end; never from an earlier lossy copy.
7. **Per chunk, sharpen the prompt:** one concrete section, instruments wanted in `positive_styles`, instruments unwanted in `negative_styles` (for example `guitar`), timed directions in braces, each `text` line at most 200 characters.
8. **Loop it** (a baked cross-fade into the material that really follows the end) with `archive/audio-source/music/tools/loops/`, then wire it in as the manifest says. Done when start and end match in key and level and the seam is silent.

Worked examples: `archive/audio-source/music/menu-theme/README.md` (the whole way), `archive/audio-source/music/REFERENCE-best-version.md` (the whole piece in three stages by inpainting, with every call).
