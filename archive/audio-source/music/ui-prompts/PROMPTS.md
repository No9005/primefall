# Prompts for the ElevenLabs UI (written 2026-11-18, not yet tried)

For making the whole piece of 3 minutes in the ElevenLabs web UI and then changing single sections for the elements of the game. 3 minutes at 72 BPM are exactly 54 bars; every section has a length in bars so that it can be assigned to a game state. **Status: these were handed to the owner, who tries them in the UI; no result is known yet.** What we know from the API work that applies here: the tempo in the text is a hint (71.8 to 71.9 BPM); "quiet" and "sparse" are often ignored, so quiet parts are described relative to the finale; a chord progression in the text is not followed; a key change is often ignored when the sound is conditioned (asking for "D major" in a fresh generation without a reference works better); the stem separation has a lot of bleed on dense sections but works better on thin ones.

| Bars | Time | Section | For |
|---|---|---|---|
| 6 | 0:00-0:20 | Intro | hero select |
| 8 | 0:20-0:47 | Planung | level 0 |
| 8 | 0:47-1:13 | Countdown | level 1 |
| 8 | 1:13-1:40 | Resolution | level 2 |
| 2 | 1:40-1:47 | Brücke | bridge up |
| 16 | 1:47-2:40 | Finale (lyrics Variant B) | level 3, the loop |
| 2 | 2:40-2:47 | Brücke zurück | bridge back |
| 4 | 2:47-3:00 | Ende | victory or defeat |

## The prompt for the whole piece
```
A dark heroic sci-fi game score, exactly 3 minutes at 72 BPM, 4/4, D minor. 1970s and 1980s analog synthesizers meet a deep male chest-voice choir (open vowels, powerchords in parallel fifths) and one powerful female lead voice singing German with a slight foreign accent, rolled r, stretched vowels. Grim but resolute, defiant, machine and human mixed. The piece builds in clear stages and every stage is a section of its own with its own character, each exactly the stated number of bars:

[Intro] 6 bars (0:00 to 0:20): only deep male chest voices, open throat, long held vowels (aah, ooh) over a low drone on D, no rhythm; the last bar whispers 'Not... strom...'.
[Planung] 8 bars (0:20 to 0:47): the quietest part of the piece, much softer than the finale: a low dark drone on D, very sparse, no melody, no drums, the male voices far in the background.
[Countdown] 8 bars (0:47 to 1:13): a heartbeat pulse on a deep sub bass enters, a faint ticking hi-hat, tension rises, still no melody and no vocals.
[Resolution] 8 bars (1:13 to 1:40): a driving eighth-note bass and hard drums enter (kick, snare on 2 and 4), the choir holds a low open chord, steady and relentless.
[Bruecke] 2 bars (1:40 to 1:47): a riser and a snare roll build up, the last beat is complete silence.
[Finale] 16 bars (1:47 to 2:40): the grand finale, maximum energy, urgent and climactic: off-beat synth stabs and off-beat hi-hats, driving eighth-note bass, the female lead voice clearly in front, the male choir as a wall of sustained open vowels in powerchords underneath.
[Bruecke zurueck] 2 bars (2:40 to 2:47): everything drops out on the first beat, a deep choir chord rings out over a low D and a heartbeat.
[Ende] 4 bars (2:47 to 3:00): a final choir hit, then one sustained chord that dies away.
```

## The lyrics and section marks
```
[Intro]
{deep male chest voices, open throat, long held notes}
(aah... ooh...)
Not... strom...

[Planung]
(instrumental, very quiet)

[Countdown]
(instrumental)

[Resolution]
{deep choir holds an open chord}
(ooh)

[Bruecke]
(instrumental, riser, the last beat silent)

[Finale]
{one powerful female lead voice sings every line, clearly in front}
{deep male chest voices in powerchords with open vowels underneath}
NOTstrom, NOTstrom!
Drei Herren zahlen für unser Blut,
jeder will, was keiner kennt.
NOTstrom, NOTstrom!
Die Zone gehört dem, der bleibt.
Nicht von uns, nicht für uns.
NOTstrom, NOTstrom!
Der Fall war erst der Anfang.
{the last beat is a short pause}

[Bruecke zurueck]
(instrumental, the band drops out)

[Ende]
{final choir hit, then a sustained chord that dies away}
(ooh)
```

## Prompts for changing single sections
Each is a prompt that makes one section on its own (or regenerates it in the UI).

### Select-Intro: Hero-Auswahl: eine ruhige Eröffnung, die man loopen kann
```
Only deep male chest voices, open throat, long held vowels (aah, ooh) over a low drone on D. No drums, no bass, no melody, no rhythm. 72 BPM, 4/4, D minor, exactly 6 bars. Slow, solemn, ominous. The last bar whispers 'Not... strom...'. Negative: drums, percussion, guitar, female voice, fast.
```

### Planung (Stufe 0): Nur der Dauerton, ruhig und weit weg
```
The quietest music of the piece, much softer than a finale: only a low dark drone on D with very slow movement, male chest voices humming far in the background. No rhythm, no drums, no melody, no bass line. 72 BPM, D minor, static harmony, pedal point on D, no chord changes, exactly 8 bars, loopable. Negative: drums, percussion, melody, fast, bright, loud.
```

### Countdown (Stufe 1): Herzschlag kommt dazu, Spannung steigt
```
A low pulsing sub bass like a heartbeat, two soft thumps per beat, a faint ticking hi-hat, a dark drone on D underneath. Tension rises slowly, minimal and quiet. No melody, no vocals, no drums kit. 72 BPM, D minor, static harmony, pedal point on D, exactly 8 bars, loopable.
```

### Resolution (Stufe 2): Treibender Bass und harte Drums
```
Driving eighth-note analog synth bass on D, hard punchy drums with a heavy kick and a snare on 2 and 4, the deep male choir holds a low open chord. Steady and relentless, dark sci-fi, 1970s and 1980s analog synthesizers. No melody, no lead vocals. 72 BPM, D minor, static harmony, pedal point on D, exactly 8 bars, loopable.
```

### Brücke hoch: Zwei Takte auf das Finale zu
```
Two bars of build-up: a rising riser, a snare roll getting denser and louder, the choir swells, and the last beat is complete silence. 72 BPM, D minor, exactly 2 bars. No melody, no lyrics.
```

### Finale (Loop, Stufe 3): Der Refrain, der so lange läuft wie nötig
```
The grand finale of a dark heroic sci-fi score: maximum energy, urgent, relentless, climactic, a wall of sound. One powerful female lead voice, clearly audible and in front, sings the German lyrics (slight foreign accent, rolled r, stretched vowels); a deep male chest-voice choir in powerchords with open vowels underneath; off-beat synth stabs and off-beat hi-hats, driving eighth-note bass, hard drums with the snare on 2 and 4. 72 BPM, 4/4, D minor, exactly 16 bars. The last beat is a short pause. Lyrics: see the text block.
```

### Brücke zurück: Ausstieg aus dem Finale
```
Two bars: the whole band drops out on the first beat, a deep male choir chord rings out over a low D drone and a slow heartbeat, then it fades to almost nothing. 72 BPM, D minor, exactly 2 bars. No drums, no lead vocals.
```

### Sieg: Kurzes Siegesstück (Wechsel in Dur ist nicht sicher)
```
A short triumphant ending: the male choir sings an open 'aah' rising, the female lead sings one held high note, a bright major chord (D major), synth brass stabs, a final big hit and a long sustained chord that rings out. 72 BPM, exactly 4 bars. Heroic, relieved. Negative: minor, dark, quiet. (Our tests: a key change is often ignored when the sound is conditioned; asking for 'D major' in a fresh generation without a reference works better.)
```

### Niederlage: Kurzes Niederlagenstück
```
A short bleak ending: the choir falls away in a slow descending line in D minor, the drums stop, one low final note and then silence. 72 BPM, exactly 4 bars. Hopeless, quiet, ominous. Negative: major, bright, loud, drums.
```

### Finale als Metal-Variante: Eigene Erzeugung, keine Referenz
```
The same text and structure as the finale, as dark melodic metal: a choir of death growlers shouting in unison, distorted electric guitars playing palm-muted power chords, short sudden stops (a full band stop on the beat, one beat of silence) followed by double bass drum bursts, heavy low bass. 144 BPM (half-time feel at 72 BPM), D minor, exactly 16 bars. Negative: clean singing, female voice, synth pad, orchestra, pop, quiet.
```
