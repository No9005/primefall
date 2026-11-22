# Prompts: the finale loop (`finale-loop/`)

Every prompt that was sent, in full and readable, generated from the plan files (`finale-loop/v*-api-payload.json`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Test 1: 8 bars, men as a deep background choir, one female lead

File: `./finale-loop/v1-api-payload.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. **Result:** tempo 71.87 BPM, D strongest (44 %), 56 % of the energy under 120 Hz, level -12 dB even over the bars. **Owner's feedback:** basically good; the female voice is missing; no urgency (it sounds like the middle, not the grand finale). Song id `V9P7lVVTvUNF6cWaEb4f`.

### Chunk 1: [Refrain], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{deep male chest voices hold open vowels (oh, ah) as a powerful background, entering on the first beat}
{a single female voice sings the lyrics}
NOTstrom, NOTstrom!
Drei Herren zahlen für unser Blut,
jeder will, was keiner kennt.
NOTstrom, NOTstrom!
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- exactly 8 bars
- dark heroic sci-fi, grim but resolute, defiant, machine and human mixed, steady and building
- 1970s and 1980s analog synthesizers
- deep male chest-voice choir as a wall of sustained open vowels in powerchords (parallel fifths), felt more than heard, giving the energy
- one single female lead voice singing the German lyrics, otherworldly, clear but not dominant, slight foreign accent, rolled r, stretched vowels
- driving bass like a heartbeat, hard punchy drums
- great production quality

**`negative_styles`**:
- pop
- rap
- English lyrics
- quiet
- fade out
- female choir
- several female voices
- clean tenor

`context_adherence`: high


---

## Test 2: the full 16 bars, after the feedback

File: `./finale-loop/v2-api-payload.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. Changes: the female lead "clearly audible and in front" (no more "not dominant"), "the grand finale ... maximum energy, urgent, relentless", off-beat elements, driving eighth-note bass, the last beat a short pause. **Result:** 71.79 BPM, off-beat hats 1.9 times the on-beat (test 1: 0.8), the last bar 8 dB quieter (the intended pause), more presence (1 to 4 kHz 16 % against 10 %). Song id `UBRewBqAovpBjdX1k2ZB`.

### Chunk 1: [Refrain], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{one powerful female lead voice, clearly in front, sings every line}
{deep male chest voices in powerchords with open vowels underneath, entering on the first beat}
NOTstrom, NOTstrom!
Drei Herren zahlen für unser Blut,
jeder will, was keiner kennt.
NOTstrom, NOTstrom!
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- exactly 16 bars
- the grand finale of a dark heroic sci-fi score, maximum energy, urgent, relentless, climactic, wall of sound
- grim but resolute, defiant, machine and human mixed
- 1970s and 1980s analog synthesizers
- driving eighth-note bass, hard punchy drums with snare on 2 and 4
- syncopated off-beat elements: off-beat synth stabs, off-beat hi-hats, rhythmic pushes between the beats, driving and urgent
- deep male chest-voice choir as a wall of sustained open vowels in powerchords (parallel fifths), giving the energy
- one powerful female lead voice, clearly audible and in front of the choir, soaring, otherworldly, singing the German lyrics with a slight foreign accent, rolled r, stretched vowels
- great production quality

**`negative_styles`**:
- pop
- rap
- English lyrics
- quiet
- sparse
- fade out
- intro
- calm
- several female voices
- female choir
- clean tenor

`context_adherence`: high

### Chunk 2: [Refrain], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain]
{the same energy, the female lead and the male choir together}
Die Zone gehört dem, der bleibt.
Nicht von uns, nicht für uns.
NOTstrom, NOTstrom!
Der Fall war erst der Anfang.
{the last beat is a short pause}
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- exactly 16 bars
- the grand finale of a dark heroic sci-fi score, maximum energy, urgent, relentless, climactic, wall of sound
- grim but resolute, defiant, machine and human mixed
- 1970s and 1980s analog synthesizers
- driving eighth-note bass, hard punchy drums with snare on 2 and 4
- syncopated off-beat elements: off-beat synth stabs, off-beat hi-hats, rhythmic pushes between the beats, driving and urgent
- deep male chest-voice choir as a wall of sustained open vowels in powerchords (parallel fifths), giving the energy
- one powerful female lead voice, clearly audible and in front of the choir, soaring, otherworldly, singing the German lyrics with a slight foreign accent, rolled r, stretched vowels
- great production quality

**`negative_styles`**:
- pop
- rap
- English lyrics
- quiet
- sparse
- fade out
- intro
- calm
- several female voices
- female choir
- clean tenor

`context_adherence`: high

