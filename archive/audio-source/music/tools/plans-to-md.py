#!/usr/bin/env python3
"""Turns the saved plan files (the JSON that was sent to the API) into readable prompts.
Run from archive/audio-source/music: python3 tools/plans-to-md.py   (it writes the PROMPTS.md next to each experiment)."""
import json, os

def chunk_md(c, i):
    if "song_id" in c:
        return f"### Chunk {i}: kept (audio reference chunk)\n\nKeeps `{c['song_id']}` from {c['range']['start_ms']/1000:g} s to {c['range']['end_ms']/1000:g} s unchanged. No prompt.\n"
    lab = c["text"].split("\n")[0]
    o = f"### Chunk {i}: {lab}, {c['duration_ms']/1000:g} s\n\n**`text`** (section name, lyrics, directions in braces, sounds in parentheses):\n```\n{c['text']}\n```\n"
    o += "**`positive_styles`**:\n" + "".join(f"- {s}\n" for s in c.get("positive_styles", []))
    o += "\n**`negative_styles`**:\n" + "".join(f"- {s}\n" for s in c.get("negative_styles", []))
    o += f"\n`context_adherence`: {c.get('context_adherence', '(default)')}"
    ref = c.get("conditioning_ref")
    if ref:
        o += f"; sound reference (`conditioning_ref`): `{ref['song_id']}` {ref['range']['start_ms']/1000:g} to {ref['range']['end_ms']/1000:g} s, `condition_strength` `{c.get('condition_strength')}`"
    return o + "\n"

def plan_md(title, path, note=""):
    d = json.load(open(path))
    meta = {k: v for k, v in d.items() if k != "composition_plan"}
    s = f"\n---\n\n## {title}\n\nFile: `{path}`. Request parameters besides the plan: `{json.dumps(meta)}`. {note}\n\n"
    for i, c in enumerate(d["composition_plan"]["chunks"], 1):
        s += chunk_md(c, i) + "\n"
    return s

HEAD = """# Prompts: {what}

Every prompt that was sent, in full and readable, generated from the plan files (`{plans}`), so it is exactly what was sent. A **chunk** has `text` (section name in square brackets, lyrics, directions in braces), `positive_styles`, `negative_styles`, `duration_ms` and, where given, a `conditioning_ref` (a sound reference from an earlier song). The first chunk of a plan sets the overall tone. What came out, and what we learned, is under each prompt.
"""

def write(path, what, plans, items, root="."):
    s = HEAD.format(what=what, plans=plans)
    for title, plan, note in items:
        s += plan_md(title, os.path.join(root, plan), note)
    open(os.path.join(root, path), "w").write(s)
    print("wrote", path)

if __name__ == "__main__":
    fm = "**Result of the F minor tests (2026-11-18):** the aim was layers that follow the chords Fm | E♭ | D♭ | C. "
    write("pieces/PROMPTS.md", "the whole pieces and tests (`pieces/`)", "plans/", [
        ("Test 1 (10 s)", "plans/test-1.json", "**Result:** a bass carpet with nothing above 2 kHz and no drums; the stem separation put all of it into `bass`. Discarded. Lesson: a short vague prompt gives a vague texture. Song id `uXeyCYoFktNmMDDEUl2U`."),
        ("The refrain test (8 bars)", "plans/refrain-test.json", "**Result:** the right feeling (28 % of the energy in the bass, 38 % in the mids, 23 % in the presence range); the sound reference of everything after. Song id `zOoAegJapdofPIHkQV9D`."),
        ("Whole piece v1, nine chunks in one call", "plans/whole-piece-v1.json", "**Result:** drifted to about 80 BPM, the Bridge was not quiet (-12 dB), the female lead too dominant, the German too precise, the choir with men often missing. Part of it was our own prompt (\"dominant\"). Song id `AlcwK9dCzT7N31odU4BL`, `pieces/notstrom-v1-one-call*.mp3`."),
        ("Whole piece v2, revised styles (a plan; to my knowledge never sent)", "plans/whole-piece-v2-revised-styles.json", "**Result:** no song id and no audio exist for it. The owner chose to build the piece in stages instead (see `../PROMPTS-best-version.md`). It shows how the styles of v1 were revised (the lead less dominant, the choir with men)."),
        ("Stage 1", "plans/stage-1.json", "Also in `../PROMPTS-best-version.md`."),
        ("Stage 2", "plans/stage-2.json", ""),
        ("Stage 3", "plans/stage-3.json", "")])
    write("layers/pilot-1/PROMPTS.md", "layer pilot 1 (`layers/pilot-1/`)", "plans/pilot-1-*.json", [
        ("Drone", "plans/pilot-1-drone.json", "**Result of the pilot: failed.** The same `seed` (7200) and a `conditioning_ref` of the drone for all three layers made the waveforms 95 to 99 % the same. Lesson: do not give several layers the same seed or a shared reference. Song id `oiOxLRYS8cJp76lAsc72`."),
        ("Pulse", "plans/pilot-1-pulse.json", "Song id `SzrMaDCMGTvu1s99zKaB`."),
        ("Drums", "plans/pilot-1-drums.json", "Song id `YIcL4Ebk4bx5hKioLAFM`.")])
    write("layers/pilot-2/PROMPTS.md", "layer pilot 2 (`layers/pilot-2/`), the layers used in the game", "plans/pilot-2-*.json", [
        ("Drone (planning)", "plans/pilot-2-drone.json", "**Result: worked.** No seed and no reference gave three different layers (correlation about 0). 71.8 to 71.9 BPM, so a stretch of 0.2 % makes 72.000. Song id `EApJsWvdVFSaff1delmD`. Lesson: static harmony (pedal on D) in the style list keeps independent layers compatible; \"sparse\" and \"almost silent\" are often ignored, so the drone says what it is (deep male chest voices, one long sustained note)."),
        ("Pulse (heartbeat)", "plans/pilot-2-pulse.json", "Almost only sub bass (72 % under 120 Hz); its key cannot be read from its chroma. Song id `6xO88kT7BCVefiqy0fUy`."),
        ("Drums (resolution)", "plans/pilot-2-drums.json", "Mostly hats and snare (60 % over 2 kHz). Song id `Fm6rNKPbOojkvRDXZRaE`.")])
    write("layers/f-minor-test/PROMPTS.md", "F minor test 1: the chords as text (`layers/f-minor-test/`)", "plans/f-minor-test-*.json", [
        ("Bass", "plans/f-minor-test-bass.json", fm + "**Result: failed.** The bass stays in F minor (85 %) but does not change chords: the root is right in 1 of 4 bars, the chord fit 45 % (chance 25 %). Song id `2obrXeZbDEe5yem13cMN`. Lesson: ElevenLabs takes a chord progression in the text as a mood, not as an instruction."),
        ("Choir", "plans/f-minor-test-choir.json", "The choir stays on Ab - C - G for 8 s and does not change chords either (chord fit 45 %). Song id `Brxt5ygPqdpAARtVsbqA`.")])
    write("layers/f-minor-test-2-reference/PROMPTS.md", "F minor test 2: the chords by an audio reference, strength `high` (`layers/f-minor-test-2-reference/`)", "plans/f-minor-test-2-*.json", [
        ("Bass", "plans/f-minor-test-2-bass.json", "The prompt describes only mood and sound; the chords come from `reference-chords-synth.mp3` (a synth pad playing Fm | E♭ | D♭ | C; upload `j2p8m9tPAGfBOZsQb2XJ_upload`). **Result:** the chords follow (chord fit 93 %), but the sound of the reference wins: bass and choir are 95 % alike and 75 % like the reference, the \"bass\" has no low end (0 % under 200 Hz). Song id `t2lRfQcLZm0xRKHIi1Cc`."),
        ("Choir", "plans/f-minor-test-2-choir.json", "Song id `M76v17MS00LBn2iS7kHg`.")])
    write("layers/f-minor-test-3-reference-low/PROMPTS.md", "F minor test 3: as test 2 with strength `low` (`layers/f-minor-test-3-reference-low/`)", "plans/f-minor-test-3-*.json", [
        ("Bass", "plans/f-minor-test-3-bass.json", "**Result:** the same as test 2: chord fit 94 %, bass and choir 95 % alike, 95 % like test 2, nothing under 200 Hz. The strength changes almost nothing. Conclusion: with an audio reference the sound of the reference wins, whatever the strength. Song id `qo3ojGFbJyrSEfadDhYy`."),
        ("Choir", "plans/f-minor-test-3-choir.json", "Song id `AWxdk0M3TvzeiSZpbowN`.")])
    write("finale-loop/PROMPTS.md", "the finale loop (`finale-loop/`)", "finale-loop/v*-api-payload.json", [
        ("Test 1: 8 bars, men as a deep background choir, one female lead", "finale-loop/v1-api-payload.json", "**Result:** tempo 71.87 BPM, D strongest (44 %), 56 % of the energy under 120 Hz, level -12 dB even over the bars. **Owner's feedback:** basically good; the female voice is missing; no urgency (it sounds like the middle, not the grand finale). Song id `V9P7lVVTvUNF6cWaEb4f`."),
        ("Test 2: the full 16 bars, after the feedback", "finale-loop/v2-api-payload.json", "Changes: the female lead \"clearly audible and in front\" (no more \"not dominant\"), \"the grand finale ... maximum energy, urgent, relentless\", off-beat elements, driving eighth-note bass, the last beat a short pause. **Result:** 71.79 BPM, off-beat hats 1.9 times the on-beat (test 1: 0.8), the last bar 8 dB quieter (the intended pause), more presence (1 to 4 kHz 16 % against 10 %). Song id `UBRewBqAovpBjdX1k2ZB`.")])
