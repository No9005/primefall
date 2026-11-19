# MIDI layers for Notstrom (draft v2, 2026-11-18, not yet approved)

16 bars, 72 BPM, 4/4, **D minor**, with a **tension arc** (the owner did not like the first progression and asked for more tension in the middle and power chords in the resolution):

| Bars | Part | Chord | |
|---|---|---|---|
| 1-2, 3-4 | A: statement | Dm, B♭ | calm |
| 5-6, 7-8 | B1: darkening | Gm (iv), E♭ (♭II) | colder, threatening |
| 9, 10, 11, 12 | B2: peak of tension | Gm, E♭, E°7, A7♭9 | a chord every bar; the bass steps E♭ to E chromatically; the diminished chord and the dominant with the flat ninth; sixteenth-note bass, a snare roll in bar 12 |
| 13, 14, 15, 16 | C: resolution | D5, B♭5, C5, D5 | power chords (root and fifth, no third), heavy bass in octaves. **The melody becomes dreamy** here (owner's wish: after the tension it must reach the resolution quickly and turn dreamy): long soft legato notes (2 beats each, velocity 78, 72, 68, 62), stepwise over the power chords, the arpeggio in soft eighths, the strings soft, the celesta glimmer |

15 layers, one file each (tempo track plus one instrument track), plus `00-notstrom-all-layers.mid`:
`01-drone`, `02-pulse` (heartbeat), `03-bass`, `04-drums` (GM channel 10), `05-pad`, `06-stabs` (off-beat power chords), `07-melody` (the hook "NOT-strom", climbing in B to C♯6, then slow and dreamy in the resolution), `08-arpeggio` (sixteenths over the chord tones, crescendo inside every chord), `09-war-drums` (taiko, "bam-bam, bam-bam"), `10-choir` (men, open vowels), `11-strings-tremolo` (crescendo from bar 5 to 12), `12-tension-line` (chromatic climb D4 to C♯6), `13-ticks` (a clock, bars 1 to 12), `14-braams` (low brass hits at the start of each part), `15-glimmer` (celesta: a rising run D5 to D6 into bar 13, then slow high notes).

- `compose.py` writes the files (needs `mido`); the notes are data in the script. `render-preview.py` is the numpy synthesiser of the listening preview (an artifact page); the real sound comes from the instruments in the DAW.
- Checked: 15 files, every file is exactly 16 bars (53.33 s) when read back with `mido`; the preview's bass has the right root in 16 of 16 bars; the strings rise from -34 dB to -24 dB over the 16 bars; the bass is 2 to 3 dB louder in the peak bars.
- Suggested General MIDI programs are in the files; GarageBand may need the instruments set by hand, especially the drums (channel 10).
- Version 1 (first progression Dm | C | B♭ | A, 9 layers) is replaced; see the git history.
