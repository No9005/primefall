# Prompts: layer pilot 1 (`layers/pilot-1/`)

Every prompt that was sent, in full and readable, generated from the plan files (`plans/pilot-1-*.json`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Drone

File: `./plans/pilot-1-drone.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 7200}`. **Result of the pilot: failed.** The same `seed` (7200) and a `conditioning_ref` of the drone for all three layers made the waveforms 95 to 99 % the same. Lesson: do not give several layers the same seed or a shared reference. Song id `oiOxLRYS8cJp76lAsc72`.

### Chunk 1: [Chor-Drone], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Chor-Drone]
{deep male chest voices drone, long held notes}
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
- deep male chest voices, open throat, sustained drone
- very sparse, low energy, calm
- slow, no rhythm, long notes

**`negative_styles`**:
- drums
- percussion
- bass line
- melody
- female voice
- fast

`context_adherence`: high


---

## Pulse

File: `./plans/pilot-1-pulse.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 7200}`. Song id `SzrMaDCMGTvu1s99zKaB`.

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
- low pulsing synth bass like a heartbeat, two soft thumps per bar
- subtle rhythmic tension, minimal, quiet
- single low note D

**`negative_styles`**:
- drums
- melody
- pads
- voices
- choir
- high frequencies

`context_adherence`: high; sound reference (`conditioning_ref`): `oiOxLRYS8cJp76lAsc72` 0 to 26.667 s, `condition_strength` `low`


---

## Drums

File: `./plans/pilot-1-drums.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 7200}`. Song id `YIcL4Ebk4bx5hKioLAFM`.

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
- powerful driving drums, heavy kick and snare, tight and hard
- kick on every beat, snare on 2 and 4
- steady groove, no fills

**`negative_styles`**:
- melody
- bass
- voices
- choir
- pads
- synth

`context_adherence`: high; sound reference (`conditioning_ref`): `oiOxLRYS8cJp76lAsc72` 0 to 26.667 s, `condition_strength` `low`

