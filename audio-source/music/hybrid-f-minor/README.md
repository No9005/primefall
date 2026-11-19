# Path 1: chords in code, sound from ElevenLabs (test, 2026-11-18)

After three failed attempts to make ElevenLabs follow a chord progression (see `../layers/f-minor-test*`), the harmony is made by code and ElevenLabs only provides what needs no chords.

- `build.py`: builds the stems and the mixes. Bass and pad are synthesised with numpy and follow **Fm | E♭ | D♭ | C**, 2 bars each, 8 bars, 72 BPM, loop seamless (the pad's tail is folded onto the start). The drone and the pulse (D minor, from `../layers/aligned/`) are pitched up 3 semitones with `rubberband` (D to F). The drums are unchanged.
- `stem-*.mp3`: the four stems (drone F, pad, bass, drums+pulse), `mix-all.mp3` all together.
- Measured with `../tools/fit.py` (key F, 2 bars per chord): the bass has the right root in 4 of 4 windows (chord fit 80 %), the pad has a chord fit of 83 %, the transposed drone sits 64 % on F (a pedal point over all chords).
- Not measured: how it sounds. The levels are set by feeling.
