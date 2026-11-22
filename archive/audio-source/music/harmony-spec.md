# The agreed harmony for the layers (chosen by the owner with the chord tool, 2026-11-18)

Tonart: **F** · Tempo **72 BPM** · 4/4 · **16 bars** per section · the chord changes **every 2 bars**
Mood: dark and heroic ("Düster-heldenhaft"): threat/hope 55, mechanical/organic 45, calm/driving 60

- Main loop ("Der Abstieg", Aeolian with a major dominant): **Fm | E♭ | D♭ | C** (i – ♭VII – ♭VI – V). The tool printed C♯ for D♭; the spelling was fixed.
- Refrain ("Moll mit heller Wendung", Dorian): **Fm | E♭ | B♭ | Fm** (i – ♭VII – IV – i)
- Layers that play the same chords: pad, bass, heartbeat, drums.

Prompt building blocks (English):
- Every layer: "F minor, 72 BPM, 4/4. Chord progression Fm – E♭ – D♭ – C, two bars per chord. grim but resolute, machine and human mixed, steady, building."
- Refrain: "F minor, 72 BPM, 4/4. Chord progression Fm – E♭ – B♭ – Fm, two bars per chord. grim but resolute, machine and human mixed, steady, building, lifting."

The existing material (drone, pulse, drums, refrain on `main`) is in **D minor**; it cannot be mixed with layers in F. If the layer tests fail, the game stays with what is on `main`.

Check a generated layer with `tools/fit.py` (chord fit, bass root, key, tempo); see the header of that file.
