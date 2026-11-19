# Prompts: F minor test 3: as test 2 with strength `low` (`layers/f-minor-test-3-reference-low/`)

Every prompt that was sent, in full and readable, generated from the plan files (`plans/f-minor-test-3-*.json`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Bass

File: `./plans/f-minor-test-3-bass.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. **Result:** the same as test 2: chord fit 94 %, bass and choir 95 % alike, 95 % like test 2, nothing under 200 Hz. The strength changes almost nothing. Conclusion: with an audio reference the sound of the reference wins, whatever the strength. Song id `qo3ojGFbJyrSEfadDhYy`.

### Chunk 1: [Bass], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Bass]
```
**`positive_styles`**:
- 72 BPM, 4/4
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 4 bars, steady
- great production quality
- instrumental, only a synth bass, no other instruments
- follows the harmony of the reference, playing the root of each chord
- driving eighth-note ostinato, dark analog saw bass, tight and mechanical, heavy, no melody on top

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

`context_adherence`: high; sound reference (`conditioning_ref`): `j2p8m9tPAGfBOZsQb2XJ_upload` 0 to 13.333 s, `condition_strength` `low`


---

## Choir

File: `./plans/f-minor-test-3-choir.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. Song id `AWxdk0M3TvzeiSZpbowN`.

### Chunk 1: [Chor], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Chor]
{sustained vowels, oh and ah}
(ooh... aah...)
```
**`positive_styles`**:
- 72 BPM, 4/4
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 4 bars, steady
- great production quality
- vocals only, a male chest-voice choir, open throat
- sustained vowels oh and ah, in unison and parallel fifths, singing the harmony of the reference
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

`context_adherence`: high; sound reference (`conditioning_ref`): `j2p8m9tPAGfBOZsQb2XJ_upload` 0 to 13.333 s, `condition_strength` `low`

