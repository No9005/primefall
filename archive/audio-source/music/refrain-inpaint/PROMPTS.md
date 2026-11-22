# Prompts: the refrain extended by inpainting

Every request that was sent for the looping refrain, readable. The JSON files in `plans/` are what was sent. `plan-a-*` (replace the last two bars) was prepared but never sent; `plan-b-*` was sent once (seed 424242). A line of `text` may not be longer than 200 characters (a 422 answer, nothing charged).


---

## Plan B, seed 424242 (sent): keep 0 to 23.667 s, 3 s new, keep 0 to 6.667 s

File: `refrain-inpaint/plans/plan-b-seed424242.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. **Result:** HTTP 200, song `iTJCfxy6V6HzoZg1k0O8`, 33.4 s. The owner confirmed it is the refrain, longer. Beat grid exactly 72.000 BPM from start to end. Made the refrain loop on `main`.

### Chunk 1: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 23.667 s unchanged. No prompt.

### Chunk 2: [Refrain], 3 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{the last words of the line are sung, then the male choir holds a wide open 'ahh' on a power chord}
{the drums play a short fill and the music falls straight back into the first beat of the refrain}
{same tempo, same key, no ending, no fade out}
verliert sich selbst.
```
**`positive_styles`**:
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare, a short drum fill
- huge layered male choir on open vowels, power chords
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- dense wall of sound, maximum energy, powerful and pressing
- great production quality

**`negative_styles`**:
- quiet
- sparse
- intro
- fade out
- ending
- silence
- happy
- pop
- rap
- english lyrics

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 6.667 s unchanged. No prompt.


---

## Plan B, seed 7 (never sent)

File: `refrain-inpaint/plans/plan-b-seed7.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 7}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 23.667 s unchanged. No prompt.

### Chunk 2: [Refrain], 3 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{the last words of the line are sung, then the male choir holds a wide open 'ahh' on a power chord}
{the drums play a short fill and the music falls straight back into the first beat of the refrain}
{same tempo, same key, no ending, no fade out}
verliert sich selbst.
```
**`positive_styles`**:
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare, a short drum fill
- huge layered male choir on open vowels, power chords
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- dense wall of sound, maximum energy, powerful and pressing
- great production quality

**`negative_styles`**:
- quiet
- sparse
- intro
- fade out
- ending
- silence
- happy
- pop
- rap
- english lyrics

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 6.667 s unchanged. No prompt.


---

## Plan B, seed 99 (never sent)

File: `refrain-inpaint/plans/plan-b-seed99.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 99}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 23.667 s unchanged. No prompt.

### Chunk 2: [Refrain], 3 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{the last words of the line are sung, then the male choir holds a wide open 'ahh' on a power chord}
{the drums play a short fill and the music falls straight back into the first beat of the refrain}
{same tempo, same key, no ending, no fade out}
verliert sich selbst.
```
**`positive_styles`**:
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare, a short drum fill
- huge layered male choir on open vowels, power chords
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- dense wall of sound, maximum energy, powerful and pressing
- great production quality

**`negative_styles`**:
- quiet
- sparse
- intro
- fade out
- ending
- silence
- happy
- pop
- rap
- english lyrics

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 6.667 s unchanged. No prompt.


---

## Plan A, seed 424242 (never sent): replace the last two bars, instrumental

File: `refrain-inpaint/plans/plan-a-seed424242.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. The owner wanted the line "Wer es besitzt, verliert sich selbst" kept, so plan B was made.

### Chunk 1: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 20 s unchanged. No prompt.

### Chunk 2: [Refrain], 6.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{two bars, instrumental turnaround: the male choir holds a wide open 'ahh' on a power chord, the drums play a short fill, and the music falls straight back into the first beat of the refrain; same tempo, same key, no ending, no fade out}
```
**`positive_styles`**:
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare, a short drum fill
- huge layered male choir on open vowels, power chords
- dense wall of sound, maximum energy, powerful and pressing
- great production quality

**`negative_styles`**:
- quiet
- sparse
- intro
- fade out
- ending
- silence
- happy
- pop
- english lyrics
- rap

`context_adherence`: high

### Chunk 3: kept (audio reference chunk)

Keeps `fZDeTVYfbJujEraIqfiL_upload` from 0 s to 6.667 s unchanged. No prompt.

