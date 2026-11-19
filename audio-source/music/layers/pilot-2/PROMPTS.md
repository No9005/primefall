# Prompts: layer pilot 2 (`layers/pilot-2/`), the layers used in the game

Every prompt that was sent, in full and readable, generated from the plan files (`plans/pilot-2-*.json`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Drone (planning)

File: `./plans/pilot-2-drone.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. **Result: worked.** No seed and no reference gave three different layers (correlation about 0). 71.8 to 71.9 BPM, so a stretch of 0.2 % makes 72.000. Song id `EApJsWvdVFSaff1delmD`. Lesson: static harmony (pedal on D) in the style list keeps independent layers compatible; "sparse" and "almost silent" are often ignored, so the drone says what it is (deep male chest voices, one long sustained note).

### Chunk 1: [Chor-Drone], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Chor-Drone]
{deep male chest voices, one long sustained chord}
(aah... ooh...)
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- static harmony, pedal point on D, no chord changes
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 8 bars, steady, loopable
- great production quality
- deep male chest voices only, open throat, one sustained drone chord
- extremely sparse, very low energy, calm, almost motionless
- slow evolving, no rhythm, no pulse, long notes only
- dark and ancient

**`negative_styles`**:
- drums
- percussion
- bass line
- melody
- female voice
- rhythm
- pulse
- fast
- bright
- high frequencies
- synth arpeggio
- ticking

`context_adherence`: high


---

## Pulse (heartbeat)

File: `./plans/pilot-2-pulse.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. Almost only sub bass (72 % under 120 Hz); its key cannot be read from its chroma. Song id `6xO88kT7BCVefiqy0fUy`.

### Chunk 1: [Herzschlag-Puls], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Herzschlag-Puls]
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- static harmony, pedal point on D, no chord changes
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 8 bars, steady, loopable
- great production quality
- a single low synth bass note D, pulsing like a heartbeat, two soft thumps per bar, lub-dub
- sub bass only, minimal, quiet, subtle rhythmic tension
- nothing else, almost no other sound

**`negative_styles`**:
- drums
- percussion
- melody
- pads
- voices
- choir
- high frequencies
- hi-hat
- synth arpeggio
- strings

`context_adherence`: high


---

## Drums (resolution)

File: `./plans/pilot-2-drums.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. Mostly hats and snare (60 % over 2 kHz). Song id `Fm6rNKPbOojkvRDXZRaE`.

### Chunk 1: [Kampf-Drums], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Kampf-Drums]
```
**`positive_styles`**:
- 72 BPM, 4/4
- D minor
- static harmony, pedal point on D, no chord changes
- dark sci-fi
- analog synthesizer, 1970s and 1980s sci-fi horror atmosphere
- exactly 8 bars, steady, loopable
- great production quality
- drums only, a drum kit played alone
- powerful driving drums, heavy kick and snare, tight and hard
- kick on every beat, snare on 2 and 4, steady groove, no fills

**`negative_styles`**:
- melody
- bass
- bass line
- voices
- choir
- pads
- synth
- strings
- drone
- tonal instruments
- harmony

`context_adherence`: high

