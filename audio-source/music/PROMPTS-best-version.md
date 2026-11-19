# The prompts of the best version, in full

Every prompt that was sent for the best version of the Notstrom music (see `REFERENCE-best-version.md` for the order and the calls). It is generated from the plan files in `plans/`, so it is exactly what was sent. A **chunk** has: `text` (section name in square brackets, lyrics, directions in braces, sounds in parentheses), `positive_styles` (what it should be), `negative_styles` (what it must not be), `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone.

Contents: the refrain test, stage 1, stage 2, stage 3, and the three layers (drone, pulse, drums).

---

## The refrain test (step 0)

File: `plans/refrain-test.json`. Request parameters besides the plan: `{"model_id": "music_v2_5"}`. The sound the owner liked best; later uploaded as the audio reference of stage 1.

### Chunk 1: [Refrain], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Refrain]
{choir enters on the first beat}
Notstrom, Notstrom, das Licht kehrt zurück!
Die Ersten fallen, wir halten die Zone.
Notstrom, Notstrom, nicht von dieser Welt!
Wer es besitzt, verliert sich selbst.
```
**`positive_styles`**:
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir chanting
- female lead voice, otherworldly and alien, soaring and breathy
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- dense wall of sound, maximum energy, powerful and pressing
- great production quality

**`negative_styles`**:
- quiet
- sparse
- intro
- fade out
- happy
- pop
- english lyrics
- rap

`context_adherence`: high


---

## Stage 1 (Intro, Strophe 1, Aufbau, Refrain 1)

File: `plans/stage-1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. 

### Chunk 1: [Intro], 20 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Intro]
{deep male chest voices drone, open throat, long held notes}
(aah... ooh...)
{heartbeat bass enters on the last bar}
Not... strom...
```
**`positive_styles`**:
- deep male chest voices, open throat, droning chant, very low
- slow low heartbeat pulse, quiet
- emergency lamp flicker pumping pads
- mysterious, ancient, alien opening, sparse, no drums
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- drums
- female lead
- native German speaker
- correct German pronunciation

`context_adherence`: high; sound reference (`conditioning_ref`): `fZDeTVYfbJujEraIqfiL_upload` 0 to 26.667 s, `condition_strength` `low`

### Chunk 2: [Strophe 1], 40 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Strophe 1]
Das Licht ist aus, das Herz noch warm,
ein Schiff, das träumt von fremder Hand.
Wir kamen her für Pflicht und Sold,
doch etwas ruft uns bei dem Namen.
```
**`positive_styles`**:
- restrained, about half the energy of the chorus
- male chest voice drone and soft male choir under the lead
- female lead voice quiet, breathy, close, as one voice of the choir
- driving heartbeat bass, steady sixteenth-note pulse, tight mechanical drums
- cold sequencer arpeggio
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- loud
- female lead alone
- native German speaker
- correct German pronunciation

`context_adherence`: high

### Chunk 3: [Aufbau], 13.333 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Aufbau]
{choir of men and women whispers, getting louder and denser}
Halt es. Halt es. Halt es fest.
```
**`positive_styles`**:
- rising tension, snare roll building
- mixed choir whispering in rhythm, men and women, getting denser
- bass drives harder
- riser into the chorus
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- quiet
- native German speaker
- correct German pronunciation

`context_adherence`: high

### Chunk 4: [Refrain 1], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Refrain 1]
NOTstrom, NOTstrom, das Licht kehrt zurück!
Die Ersten fielen, wir halten die Zone.
NOTstrom, NOTstrom, nicht von dieser Welt!
Wer es berührt, vergisst sich selbst.
```
**`positive_styles`**:
- full power chorus, maximum energy
- huge mixed choir shouting and chanting in unison, men and women, deep male voices very present
- female lead soaring on the high notes only, equal in volume to the choir
- the word Notstrom chanted by the whole choir with a hard accent on the first syllable
- heavy driving bass, hard drums, wall of synths and strings
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- quiet
- sparse
- native German speaker
- correct German pronunciation

`context_adherence`: high; sound reference (`conditioning_ref`): `fZDeTVYfbJujEraIqfiL_upload` 0 to 26.667 s, `condition_strength` `high`


---

## Stage 2 (adds Strophe 2, Refrain 2, Bridge)

File: `plans/stage-2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `l0CGzRMzAFDAFQezPg1s` from 0 s to 100 s unchanged. No prompt.

### Chunk 2: [Strophe 2], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Strophe 2]
Drei Herren zahlen unser Blut,
jeder will, was keiner kennt.
Die Wände singen Ersten-Sprache,
und tief im Kiel schlägt etwas mit.
```
**`positive_styles`**:
- variation of the first verse, counter-melody in the strings
- male choir and female voices trading lines
- female lead firm but inside the choir, not above it
- driving heartbeat bass, hard drums
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- quiet
- native German speaker
- correct German pronunciation

`context_adherence`: high

### Chunk 3: [Refrain 2], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Refrain 2]
NOTstrom! NOTstrom! Brenne, brenne!
Fremdes Feuer, erste Stimme,
NOTstrom! NOTstrom! Halt das Licht!
Was wir tragen, trägt uns fort.
```
**`positive_styles`**:
- E minor, one whole tone higher than the previous chorus
- hymn-like chant, big and soaring
- huge mixed choir, deep male voices carry the chant, women on top
- female lead equal in volume to the choir
- heavy driving bass, hard drums, more energy than the first chorus
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- quiet
- sparse
- native German speaker
- correct German pronunciation

`context_adherence`: high; sound reference (`conditioning_ref`): `l0CGzRMzAFDAFQezPg1s` 73.333 to 100 s, `condition_strength` `medium`

### Chunk 4: [Bridge], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Bridge]
{very quiet, long pauses between the lines}
Hörst du's schlagen? Tief im Kiel...
(ooh) ... nicht von uns, nicht für uns.
```
**`positive_styles`**:
- E minor
- very quiet and sparse, at least 10 dB softer than the chorus
- one slow deep heartbeat kick and a low drone only
- one soft whispering voice and a faint male choir hum
- no drums, no synth wall, no high frequencies
- ends on the downbeat, no held notes across the last bar line
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- drums
- loud
- full choir
- wall of sound
- bright
- native German speaker
- correct German pronunciation

`context_adherence`: high


---

## Stage 3 (adds Finale and Ende)

File: `plans/stage-3.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `hF6hdmMPuJ6jScDiPnYJ` from 0 s to 90 s unchanged. No prompt.

### Chunk 2: kept (audio reference chunk)

Keeps `hF6hdmMPuJ6jScDiPnYJ` from 90 s to 180 s unchanged. No prompt.

### Chunk 3: [Finale], 40 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Finale]
NOTstrom! Wir halten! NOTstrom! Wir fallen nicht!
Die Zone gehört dem, der bleibt.
NOTstrom! Halt das Licht!
Nicht von uns, nicht für uns.
Wer es berührt, vergisst sich selbst.
```
**`positive_styles`**:
- F-sharp minor, one whole tone higher than the previous chorus
- maximum energy, the biggest moment of the piece
- huge mixed choir shouting like an order, deep male voices in front, women above
- female lead soaring but equal to the choir
- heavy driving bass, hardest drums, layered orchestra and synths
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- D minor
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered mixed choir with deep male chest voices and women together
- female lead voice, otherworldly and alien, breathy, sits inside the choir
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction
- dense wall of sound, maximum energy, powerful and pressing
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- quiet
- sparse
- fade out
- native German speaker
- correct German pronunciation

`context_adherence`: high; sound reference (`conditioning_ref`): `hF6hdmMPuJ6jScDiPnYJ` 126.667 to 153.333 s, `condition_strength` `medium`

### Chunk 4: [Ende], 13.333 s

**`text`** (section name, lyrics and directions in braces and brackets):
```
[Ende]
{final choir hit, then a sustained chord that dies away}
(Der Fall war erst der Anfang.)
```
**`positive_styles`**:
- F-sharp minor
- ending, final chord, drums stop
- the last line whispered by the male choir and one female voice, quiet
- choir holds a last chord, then silence
- slow heavy 72 BPM, 4/4
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- the female lead is a Japanese singer singing German: strong Japanese accent in the German words, soft consonants, r and l blended, flat pure vowels, syllable-timed rhythm, expressive rather than precise diction

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- clear precise pronunciation
- native German diction
- solo vocalist dominating the mix
- female voice alone
- drums continue
- loud
- native German speaker
- correct German pronunciation

`context_adherence`: high


---

## Layer: drone (planning)

File: `plans/pilot-2-drone.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. No seed, no reference.

### Chunk 1: [Chor-Drone], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
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

## Layer: pulse (heartbeat)

File: `plans/pilot-2-pulse.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. No seed, no reference.

### Chunk 1: [Herzschlag-Puls], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
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

## Layer: drums (resolution)

File: `plans/pilot-2-drums.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true}`. No seed, no reference.

### Chunk 1: [Kampf-Drums], 26.667 s

**`text`** (section name, lyrics and directions in braces and brackets):
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

