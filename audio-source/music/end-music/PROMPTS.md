# Prompts: the end music (victory and defeat)

Every request for the jingles and the quiet loops, readable. The JSON in `plans/` is what was sent. Reference for all jingles: the last two bars (20.0 to 26.667 s) of the inpainted refrain, song `iTJCfxy6V6HzoZg1k0O8` (see `../refrain-inpaint/`).


---

## Victory jingle, first attempt (sent, used in the game)

File: `end-music/plans/plan-victory.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 2024}`. **Result:** HTTP 200, song `AuuN6BNO6ftvCwQwF7uN`, 26.7 s. Stays in D minor (the change to major did not happen). Chosen by the owner.

### Chunk 1: kept (audio reference chunk)

Keeps `iTJCfxy6V6HzoZg1k0O8` from 20 s to 26.667 s unchanged. No prompt.

### Chunk 2: [Sieg], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{the refrain's tension is released; the key turns from D minor to D major, a bright open choir chord}
{one solo female voice sings, soaring and warm}
Die Zone gehalten, die Nacht ist vorbei,
Das Licht ist zurück, und wir sind frei.
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- soaring female lead voice, otherworldly and breathy, sung over the choir
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop

`context_adherence`: high

### Chunk 3: [Sieg], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{instrumental, no singing: the choir swells to one long glowing chord on open vowels, strings and synth rise}
{a short drum roll, then the music rings out and ends}
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop
- vocals
- singing
- solo voice
- lyrics
- spoken words

`context_adherence`: high


---

## Defeat jingle, first attempt (sent, used in the game)

File: `end-music/plans/plan-defeat.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 2025}`. **Result:** HTTP 200, song `PInQ2YB932scGAbI9oau`, 26.7 s. D minor as wanted.

### Chunk 1: kept (audio reference chunk)

Keeps `iTJCfxy6V6HzoZg1k0O8` from 20 s to 26.667 s unchanged. No prompt.

### Chunk 2: [Niederlage], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Niederlage]
{the tension collapses; the key sinks, the choir thins out to one low chord}
{one solo female voice sings low and weary}
Die Zone ist gefallen, die Nacht bricht herein,
Der Strom ist erloschen, wir sind allein.
```
**`positive_styles`**:
- somber defeated lament
- D minor, falling, the key sinks even darker
- low solo female voice, hollow and weary, sung over a thin choir
- distant layered choir on open vowels, cold
- low cello and synth pad, a slow heartbeat
- no drums, no kick
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- major key
- happy
- heroic
- bright
- uplifting
- loud drums
- intro
- rap
- pop

`context_adherence`: high

### Chunk 3: [Niederlage], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Niederlage]
{instrumental, no singing: the choir fades to one soft chord, a single low heartbeat}
{then the music rings out and ends}
```
**`positive_styles`**:
- somber defeated lament
- D minor, falling, the key sinks even darker
- distant layered choir on open vowels, cold
- low cello and synth pad, a slow heartbeat
- no drums, no kick
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- major key
- happy
- heroic
- bright
- uplifting
- loud drums
- intro
- rap
- pop
- vocals
- singing
- solo voice
- lyrics
- spoken words

`context_adherence`: high


---

## Victory jingle, second attempt: with a sound reference (sent, rejected)

File: `end-music/plans/plan-victory-v2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 2024}`. **Result:** HTTP 200, song `x7IDZhvNKy8j7Qx5dpc4`. The reference won: the output was just the refrain again. Do not use `conditioning_ref` for a new part.

### Chunk 1: kept (audio reference chunk)

Keeps `iTJCfxy6V6HzoZg1k0O8` from 20 s to 26.667 s unchanged. No prompt.

### Chunk 2: [Sieg], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{the refrain's tension is released; the key turns from D minor to D major, a bright open choir chord}
{one solo female voice sings, soaring and warm}
Die Zone gehalten, die Nacht ist vorbei,
Das Licht ist zurück, und wir sind frei.
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop

`context_adherence`: high; sound reference (`conditioning_ref`): `iTJCfxy6V6HzoZg1k0O8` 0 to 26.667 s, `condition_strength` `medium`

### Chunk 3: [Sieg], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{instrumental, no singing: the choir swells to one long glowing chord on open vowels, strings and synth rise}
{a short drum roll, then the music rings out and ends}
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop
- vocals
- singing
- solo voice
- lyrics
- spoken words

`context_adherence`: high


---

## Victory jingle, way A: the refrain's voice styles, no reference (sent, not chosen)

File: `end-music/plans/plan-victory-v3.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 2026}`. **Result:** HTTP 200, song `va4nKKAACcuqd91tnyEM`. New material, not a copy of the refrain. The owner kept the first attempt.

### Chunk 1: kept (audio reference chunk)

Keeps `iTJCfxy6V6HzoZg1k0O8` from 20 s to 26.667 s unchanged. No prompt.

### Chunk 2: [Sieg], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{the refrain's tension is released; the key turns from D minor to D major, a bright open choir chord}
{one solo female voice sings, soaring and warm}
Die Zone gehalten, die Nacht ist vorbei,
Das Licht ist zurück, und wir sind frei.
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop

`context_adherence`: high

### Chunk 3: [Sieg], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Sieg]
{instrumental, no singing: the choir swells to one long glowing chord on open vowels, strings and synth rise}
{a short drum roll, then the music rings out and ends}
```
**`positive_styles`**:
- heroic uplifting triumphant anthem
- D major, the key turns bright after the dark D minor refrain
- huge layered choir on open vowels, bright and warm
- warm synth bass
- soft driving drums, light kick, no heavy snare
- tension released, the light returns
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- minor key
- dark
- sad
- quiet
- sparse
- intro
- fade out
- rap
- pop
- vocals
- singing
- solo voice
- lyrics
- spoken words

`context_adherence`: high


---

## Defeat jingle, with a sound reference (prepared, never sent)

File: `end-music/plans/plan-defeat-v2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 2025}`. Never run, because the same setting failed for the victory.

### Chunk 1: kept (audio reference chunk)

Keeps `iTJCfxy6V6HzoZg1k0O8` from 20 s to 26.667 s unchanged. No prompt.

### Chunk 2: [Niederlage], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Niederlage]
{the tension collapses; the key sinks, the choir thins out to one low chord}
{one solo female voice sings low and weary}
Die Zone ist gefallen, die Nacht bricht herein,
Der Strom ist erloschen, wir sind allein.
```
**`positive_styles`**:
- somber defeated lament
- D minor, falling, the key sinks even darker
- distant layered choir on open vowels, cold
- low cello and synth pad, a slow heartbeat
- no drums, no kick
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality
- female lead voice, otherworldly and alien, low and weary, breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels

**`negative_styles`**:
- major key
- happy
- heroic
- bright
- uplifting
- loud drums
- intro
- rap
- pop

`context_adherence`: high; sound reference (`conditioning_ref`): `iTJCfxy6V6HzoZg1k0O8` 0 to 26.667 s, `condition_strength` `medium`

### Chunk 3: [Niederlage], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Niederlage]
{instrumental, no singing: the choir fades to one soft chord, a single low heartbeat}
{then the music rings out and ends}
```
**`positive_styles`**:
- somber defeated lament
- D minor, falling, the key sinks even darker
- distant layered choir on open vowels, cold
- low cello and synth pad, a slow heartbeat
- no drums, no kick
- hybrid orchestral and analog synthesizer
- 72 BPM
- great production quality

**`negative_styles`**:
- major key
- happy
- heroic
- bright
- uplifting
- loud drums
- intro
- rap
- pop
- vocals
- singing
- solo voice
- lyrics
- spoken words

`context_adherence`: high


---

## Quiet loop, victory, step 1, first attempt: section [Ruhe] (sent, failed)

File: `end-music/plans/plan-calm-victory-step1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 31}`. **Result:** HTTP 200, song `NBR4XNtnlNjy3acIEMij`. The level fades from -16 dB to -61 dB over the 13 s: a fade-out, no loop.

### Chunk 1: kept (audio reference chunk)

Keeps `AuuN6BNO6ftvCwQwF7uN` from 16.667 s to 20 s unchanged. No prompt.

### Chunk 2: [Ruhe], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Ruhe]
{instrumental, no singing: the choir holds soft open vowels, a warm synth pad and a slow gentle arpeggio, no drums}
{same tempo, same key, steady, no ending, no fade out}
```
**`positive_styles`**:
- calm gentle hopeful ambient
- hybrid orchestral and analog synthesizer
- soft layered choir on open vowels, sustained
- warm synth pad
- slow gentle arpeggio
- steady and spacious
- 72 BPM
- D minor
- great production quality

**`negative_styles`**:
- drums
- percussion
- kick
- snare
- vocals
- singing
- solo voice
- lyrics
- spoken words
- loud
- dense
- ending
- fade out
- intro
- rap
- pop

`context_adherence`: high


---

## Quiet loop, victory, step 1, second attempt: section [Loop], constant volume (sent, used)

File: `end-music/plans/plan-calm-victory-step1-v2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 32}`. **Result:** HTTP 200, song `NPJGouN0bFjqxxBbYVrj`. The level holds (-14 to -18 dB), D minor, no singing, about 5 onsets per second (the arpeggio).

### Chunk 1: kept (audio reference chunk)

Keeps `AuuN6BNO6ftvCwQwF7uN` from 16.667 s to 20 s unchanged. No prompt.

### Chunk 2: [Loop], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Loop]
{instrumental, no singing: the choir holds soft open vowels, a warm synth pad and a slow gentle arpeggio, no drums}
{same tempo, same key, the level stays the same from start to end, no ending, no outro, no fade out}
```
**`positive_styles`**:
- calm gentle hopeful ambient
- constant volume from start to end, sustained, no decay
- hybrid orchestral and analog synthesizer
- soft layered choir on open vowels, sustained
- warm synth pad
- slow gentle arpeggio
- steady and spacious, loopable
- 72 BPM
- D minor
- great production quality

**`negative_styles`**:
- drums
- percussion
- kick
- snare
- vocals
- singing
- solo voice
- lyrics
- spoken words
- loud
- dense
- ending
- outro
- fade out
- decay
- dying away
- intro
- rap
- pop

`context_adherence`: high


---

## Quiet loop, victory, step 2: the last 3 s regenerated so that the loop runs into its start (sent, used)

File: `end-music/plans/plan-calm-victory-step2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 33}`. **Result:** HTTP 200, song `fHK7ylpoIEzp6r1zULR3`, 20.0 s. The loop is its first 4 bars; the 6.7 s behind them are the real continuation for the cross-fade.

### Chunk 1: kept (audio reference chunk)

Keeps `NPJGouN0bFjqxxBbYVrj` from 3.333 s to 13.667 s unchanged. No prompt.

### Chunk 2: [Loop], 3 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Loop]
{instrumental, no singing: the same soft choir vowels, warm pad and gentle arpeggio continue and flow straight back into the start, no drums}
{same tempo, same key, the level stays the same, no ending, no outro, no fade out}
```
**`positive_styles`**:
- calm gentle hopeful ambient
- constant volume from start to end, sustained, no decay
- hybrid orchestral and analog synthesizer
- soft layered choir on open vowels, sustained
- warm synth pad
- slow gentle arpeggio
- steady and spacious, loopable
- 72 BPM
- D minor
- great production quality

**`negative_styles`**:
- drums
- percussion
- kick
- snare
- vocals
- singing
- solo voice
- lyrics
- spoken words
- loud
- dense
- ending
- outro
- fade out
- decay
- dying away
- intro
- rap
- pop

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `NPJGouN0bFjqxxBbYVrj` from 3.333 s to 10 s unchanged. No prompt.


---

## Quiet loop, defeat, step 1 (sent, used)

File: `end-music/plans/plan-calm-defeat-step1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 41}`. **Result:** HTTP 200, song `WHw2wDdM1W5PSIXUW79I`. Level holds (-21 to -25 dB), D minor, no singing, dark (centroid 314 Hz), a deep heartbeat thump every two bars at -13 dB.

### Chunk 1: kept (audio reference chunk)

Keeps `PInQ2YB932scGAbI9oau` from 16.667 s to 20 s unchanged. No prompt.

### Chunk 2: [Loop], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Loop]
{instrumental, no singing: a cold distant choir holds open vowels, a low cello and synth pad and a slow soft arpeggio, no drums}
{same tempo, same key, the level stays the same from start to end, no ending, no outro, no fade out}
```
**`positive_styles`**:
- calm somber ambient, hollow and weary
- constant volume from start to end, sustained, no decay
- hybrid orchestral and analog synthesizer
- distant layered choir on open vowels, cold, sustained
- low cello and synth pad
- slow soft arpeggio, a slow low heartbeat
- steady and spacious, loopable
- 72 BPM
- D minor
- great production quality

**`negative_styles`**:
- drums
- percussion
- kick
- snare
- vocals
- singing
- solo voice
- lyrics
- spoken words
- loud
- dense
- ending
- outro
- fade out
- decay
- dying away
- intro
- rap
- pop
- major key
- happy
- heroic

`context_adherence`: high


---

## Quiet loop, defeat, step 2 (sent, used)

File: `end-music/plans/plan-calm-defeat-step2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 42}`. **Result:** HTTP 200, song `YiT0wAVG1Bl3Etb2xm0S`, 20.0 s.

### Chunk 1: kept (audio reference chunk)

Keeps `WHw2wDdM1W5PSIXUW79I` from 3.333 s to 13.667 s unchanged. No prompt.

### Chunk 2: [Loop], 3 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Loop]
{instrumental, no singing: the same cold distant choir, low cello and soft arpeggio continue and flow straight back into the start, no drums}
{same tempo, same key, the level stays the same, no ending, no outro, no fade out}
```
**`positive_styles`**:
- calm somber ambient, hollow and weary
- constant volume from start to end, sustained, no decay
- hybrid orchestral and analog synthesizer
- distant layered choir on open vowels, cold, sustained
- low cello and synth pad
- slow soft arpeggio, a slow low heartbeat
- steady and spacious, loopable
- 72 BPM
- D minor
- great production quality

**`negative_styles`**:
- drums
- percussion
- kick
- snare
- vocals
- singing
- solo voice
- lyrics
- spoken words
- loud
- dense
- ending
- outro
- fade out
- decay
- dying away
- intro
- rap
- pop
- major key
- happy
- heroic

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `WHw2wDdM1W5PSIXUW79I` from 3.333 s to 10 s unchanged. No prompt.

