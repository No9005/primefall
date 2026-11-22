# Prompts: the whole pieces and tests (`pieces/`)

Every prompt that was sent, in full and readable, generated from the plan files (`plans/`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.

---

## Test 1 (10 s)

File: `./plans/test-1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5"}`. **Result:** a bass carpet with nothing above 2 kHz and no drums; the stem separation put all of it into `bass`. Discarded. Lesson: a short vague prompt gives a vague texture. Song id `uXeyCYoFktNmMDDEUl2U`.

### Chunk 1: [Pulse A], 10 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Pulse A]
```
**`positive_styles`**:
- instrumental
- grim dark sci-fi score
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- 72 BPM
- D minor
- constant tempo, steady full density
- deep warm audible sub-bass pulsing like a heartbeat, two soft thumps per bar
- slow breathing analog pad that swells and falls every two bars
- cold mechanical metallic ticking and clanks, steady sequencer arpeggio
- low dark drone like a hull under strain
- sparse anxious lead motif on a vintage analog synth
- tape saturation, loopable, great production quality

**`negative_styles`**:
- vocals
- lyrics
- breakdown
- build-up
- riser
- ending
- fade out
- tempo change
- heroic
- happy
- epic orchestral
- modern trap or EDM drums

`context_adherence`: high


---

## The refrain test (8 bars)

File: `./plans/refrain-test.json`. Request parameters besides the plan: `{"model_id": "music_v2_5"}`. **Result:** the right feeling (28 % of the energy in the bass, 38 % in the mids, 23 % in the presence range); the sound reference of everything after. Song id `zOoAegJapdofPIHkQV9D`.

### Chunk 1: [Refrain], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

## Whole piece v1, nine chunks in one call

File: `./plans/whole-piece-v1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5"}`. **Result:** drifted to about 80 BPM, the Bridge was not quiet (-12 dB), the female lead too dominant, the German too precise, the choir with men often missing. Part of it was our own prompt ("dominant"). Song id `AlcwK9dCzT7N31odU4BL`, `pieces/notstrom-v1-one-call*.mp3`.

### Chunk 1: [Intro], 20 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Intro]
{deep male chest voices drone, open throat, long held notes}
(aah... ooh...)
{heartbeat bass enters on the last bar}
Not... strom...
```
**`positive_styles`**:
- D minor
- deep male chest voices, open throat, droning chant, very low
- slow low heartbeat pulse, quiet
- emergency lamp flicker pumping pads
- mysterious, ancient, alien opening
- sparse, no drums
- ends on the downbeat
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
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
- drums
- loud
- female lead

`context_adherence`: high

### Chunk 2: [Strophe 1], 40 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Strophe 1]
Das Licht ist aus, das Herz noch warm,
ein Schiff, das träumt von fremder Hand.
Wir kamen her für Pflicht und Sold,
doch etwas ruft uns bei dem Namen.
```
**`positive_styles`**:
- D minor
- driving heartbeat bass enters, steady sixteenth-note pulse
- tight mechanical drums, controlled
- cold sequencer arpeggio
- female lead voice, quiet, breathy, alien, close
- choir only as a soft pad under the lead
- tense and building slowly
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- loud
- full choir

`context_adherence`: high

### Chunk 3: [Aufbau], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Aufbau]
{choir whispers, getting louder and denser}
Halt es. Halt es. Halt es fest.
```
**`positive_styles`**:
- D minor
- rising tension, snare roll building
- choir whispering in rhythm, getting denser
- bass drives harder
- riser into the chorus
- ends on a drum hit before the downbeat
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- quiet

`context_adherence`: high

### Chunk 4: [Refrain 1], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Refrain 1]
NOTstrom, NOTstrom, das Licht kehrt zurück!
Die Ersten fielen, wir halten die Zone.
NOTstrom, NOTstrom, nicht von dieser Welt!
Wer es berührt, vergisst sich selbst.
```
**`positive_styles`**:
- D minor
- full power chorus, maximum energy
- female lead soaring and powerful, dominant over the choir
- huge choir chanting the word Notstrom with a strong accent on the first syllable
- heavy driving bass, hard drums
- wall of synths and strings
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- quiet
- sparse

`context_adherence`: high

### Chunk 5: [Strophe 2], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Strophe 2]
Drei Herren zahlen unser Blut,
jeder will, was keiner kennt.
Die Wände singen Ersten-Sprache,
und tief im Kiel schlägt etwas mit.
```
**`positive_styles`**:
- D minor
- variation of the first verse, new counter-melody in the strings
- driving heartbeat bass, hard drums
- female lead voice firmer and stronger than in the first verse
- choir swells softly between lines
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- quiet

`context_adherence`: high

### Chunk 6: [Refrain 2], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- female lead dominant, full power
- huge choir, mixed and male voices
- heavy driving bass, hard drums, more energy than the first chorus
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- quiet
- sparse

`context_adherence`: high

### Chunk 7: [Bridge], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Bridge]
{almost silent, only a slow heartbeat and the voice}
Hörst du's schlagen? Tief im Kiel...
(ooh) ... nicht von uns, nicht für uns.
```
**`positive_styles`**:
- E minor
- almost silent, sparse
- slow deep heartbeat bass pulse only
- female lead whispering, alien, with a faint choir hum
- no drums, no synth wall
- voice and bass fall away at the end, ends on the downbeat, no held notes across the last bar line
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- drums
- loud
- full choir
- wall of sound

`context_adherence`: high

### Chunk 8: [Finale], 40 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- female lead dominant, soaring, full power
- huge choir shouting, hard and commanding like an order
- heavy driving bass, hardest drums, layered orchestra and synths
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- constant tempo, exact bars
- powerful driving synth bass, loud and clearly audible, pulsing like a heartbeat
- hard punchy drums with heavy kick and snare
- huge layered choir
- female lead voice, otherworldly and alien, dominant, the strongest voice in the mix
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels
- 1970s and 1980s analog synthesizer sci-fi horror atmosphere
- dense wall of sound, powerful and pressing
- great production quality

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- quiet
- sparse
- fade out

`context_adherence`: high

### Chunk 9: [Ende], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
```
[Ende]
{final choir hit, then a sustained chord that dies away}
(Der Fall war erst der Anfang.)
```
**`positive_styles`**:
- F-sharp minor
- ending, final chord, drums stop
- lead whispers the last line, quiet
- choir holds a last chord, then silence
- slow ringing out
- dramatic dark sci-fi anime action score
- hybrid orchestral and analog synthesizer
- 72 BPM, 4/4
- German lyrics sung with a slight foreign accent, rolled r, stretched vowels

**`negative_styles`**:
- happy
- pop
- english lyrics
- rap
- children's voice
- fade out
- tempo change
- drums continue
- loud

`context_adherence`: high


---

## Whole piece v2, revised styles (a plan; to my knowledge never sent)

File: `./plans/whole-piece-v2-revised-styles.json`. Request parameters besides the plan: `{"model_id": "music_v2_5"}`. **Result:** no song id and no audio exist for it. The owner chose to build the piece in stages instead (see `../PROMPTS-best-version.md`). It shows how the styles of v1 were revised (the lead less dominant, the choir with men).

### Chunk 1: [Intro], 20 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 2: [Strophe 1], 40 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 3: [Aufbau], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 4: [Refrain 1], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 5: [Strophe 2], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 6: [Refrain 2], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 7: [Bridge], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction

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

`context_adherence`: high

### Chunk 8: [Finale], 40 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction
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

`context_adherence`: high

### Chunk 9: [Ende], 13.333 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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
- German lyrics sung by a non-native speaker, heavily accented, bent vowels, rolled r, blurred consonants, expressive rather than precise diction

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

`context_adherence`: high


---

## Stage 1

File: `./plans/stage-1.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. Also in `../PROMPTS-best-version.md`.

### Chunk 1: [Intro], 20 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

## Stage 2

File: `./plans/stage-2.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `l0CGzRMzAFDAFQezPg1s` from 0 s to 100 s unchanged. No prompt.

### Chunk 2: [Strophe 2], 26.667 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

## Stage 3

File: `./plans/stage-3.json`. Request parameters besides the plan: `{"model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. 

### Chunk 1: kept (audio reference chunk)

Keeps `hF6hdmMPuJ6jScDiPnYJ` from 0 s to 90 s unchanged. No prompt.

### Chunk 2: kept (audio reference chunk)

Keeps `hF6hdmMPuJ6jScDiPnYJ` from 90 s to 180 s unchanged. No prompt.

### Chunk 3: [Finale], 40 s

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

**`text`** (section name, lyrics, directions in braces, sounds in parentheses):
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

