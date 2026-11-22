# Prompts: F minor test 1: the chords as text (`layers/f-minor-test/`)

Every prompt that was sent, in full and readable, generated from the plan files (`plans/f-minor-test-*.json`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Bass

File: `./plans/f-minor-test-bass.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. **Result of the F minor tests (2026-11-18):** the aim was layers that follow the chords Fm | E♭ | D♭ | C. **Result: failed.** The bass stays in F minor (85 %) but does not change chords: the root is right in 1 of 4 bars, the chord fit 45 % (chance 25 %). Song id `2obrXeZbDEe5yem13cMN`. Lesson: ElevenLabs takes a chord progression in the text as a mood, not as an instruction.

### Chunk 1: [Bass], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Bass]
```
**`positive_styles`**:
- 72 BPM, 4/4
- F minor
- chord progression Fm, E-flat, D-flat, C, one chord per bar, four bars, the root note of each chord changes every bar
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 4 bars, steady
- great production quality
- instrumental, only a synth bass, no other instruments
- driving eighth-note ostinato on the root of each chord
- dark analog saw bass, tight and mechanical, heavy, no melody on top

**`negative_styles`**:
- drums
- percussion
- vocals
- voices
- choir
- melody
- pads
- strings
- high frequencies

`context_adherence`: high


---

## Choir

File: `./plans/f-minor-test-choir.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. The choir stays on Ab - C - G for 8 s and does not change chords either (chord fit 45 %). Song id `Brxt5ygPqdpAARtVsbqA`.

### Chunk 1: [Chor], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Chor]
{sustained vowels, oh and ah}
(ooh... aah...)
```
**`positive_styles`**:
- 72 BPM, 4/4
- F minor
- chord progression Fm, E-flat, D-flat, C, one chord per bar, four bars, the root note of each chord changes every bar
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 4 bars, steady
- great production quality
- vocals only, a male chest-voice choir, open throat
- sustained vowels oh and ah, in unison and parallel fifths, the voices move with the chords
- slow, solemn, ominous, no lyrics

**`negative_styles`**:
- drums
- percussion
- bass line
- instruments
- synth
- guitar
- female voice
- fast
- melody instrument

`context_adherence`: high

