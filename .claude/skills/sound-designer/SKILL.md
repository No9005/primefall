---
name: sound-designer
description: Sound design for Primefall. Use when generating, cutting, levelling or wiring voice lines, sound effects or ambience, and for the archive and cost steps of any audio work.
---

Sound work in Primefall is expensive and cannot be undone: ElevenLabs lets nothing be downloaded again (a song id only works as an audio reference), every call costs credits, and the owner judges by ear. Work in the order below. Each step ends on its checkable bar; do not start the next before it holds.

## 1. Ground

Read the _Sound_ part of `docs/design/world-and-style.md`, then the archive of the kind you make:

- **Music:** use the `composer` skill for the piece; this skill's steps 2 to 5 (prompt shown first, one call, archive, measure) hold for it too.
- **Voice lines:** `audio-source/voice-sfx/CHARACTERS.md` (the Hero's voice, settings, tags used, a checklist for new lines) and `PROMPTS.md`.
- **Effects and ambience:** `audio-source/voice-sfx/PROMPTS.md`, and `apps/web/public/assets/audio/README.md` for what the game plays when.

Done when you can name the Hero or map, the key and tempo (music), and the earlier piece or line yours must sit next to.

## 2. Prompt, shown first

Write the prompt or composition plan in plain text: a concrete hook, key, tempo, timed sections, instruments wanted and unwanted (`negative_styles`). "Mood" alone gives drifting atmosphere. A line of `text` has at most 200 characters (longer fails with 422); split directions into several lines.

Show the owner the exact text, the model and the credit estimate (a generation is about 31 credits per second of new audio; an upload costs the same per second) and wait for the owner's okay. Done when the owner said okay to this text.

## 3. Generate once

One call per take, no retry (a retry starts and charges a second generation). Poll the status; do not repeat the call.

## 4. Archive at once

Before any listening, cutting or wiring, save in `audio-source/` the audio, the exact prompt or plan (JSON), the song or request id, the settings, the credit cost and a verdict line (used, or discarded and why). Discarded takes stay. Use the folder shape of `audio-source/music/menu-theme/` (`README.md`, `PROMPTS.md`, `plans/`, `ids/`) or the matching voice-sfx folder. Done when `ls` shows the files and `PROMPTS.md` has the entry.

## 5. Judge and finish

- **Measure** before claiming: key at start and end, level over time, similarity of start and end (is it loopable). Tell the owner what you could not measure (a motif, an instrument).
- **Music** loops, as a baked cross-fade into the material that really follows the end; `audio-source/music/tools/loops/README.md` has the scripts and what the numbers taught (stretch before cutting, cut at zero crossings, never fade into the start itself).
- **Levels:** voice about −16 LUFS, effects about −14 LUFS, mono MP3 (voice 80 kbit/s, effects 96 kbit/s); music is AAC in `.m4a` with a gain in the manifest. Measure the downmix as 0.7071 × (L + R).
- **Wire in** through the manifests in `apps/web/public/assets/audio/` and `apps/web/src/audio*.ts`. Music is scheduled on the audio clock, not a timer. Fog of War decides what may be heard (README there).
- The owner picks by ear: play or send the candidates and let the owner choose.

Done when the final file is in `apps/web/public/assets/audio/`, its manifest entry is in, and the archive says which take it is.
