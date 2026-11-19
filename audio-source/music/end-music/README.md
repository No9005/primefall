# The music of the end screen (2026-11-19)

Victory and defeat each get a **jingle** (26.7 s, plays once) and a **quiet loop** (4 bars, 13.33 s) that takes over over the jingle's last 4.5 s and runs until the player leaves. The Hero's end line plays 4 s after the music starts and the music steps back 9 dB for it. In the game: `apps/web/public/assets/audio/music/{victory,defeat}.m4a` and `{victory,defeat}-loop.m4a`, the `ending` block of the manifest, `GameAudio.startEnding`/`stopEnding`, `EndScreen.tsx`.

## The jingles

One call each (`plans/plan-victory.json`, `plans/plan-defeat.json`): keep the last two bars of the inpainted refrain (20.0 to 26.667 s of song `iTJCfxy6V6HzoZg1k0O8`; see `../refrain-inpaint/`), then 20 s new:

1. 13.3 s: the tension is released (victory: the key should turn from D minor to D major; defeat: it sinks), a **female voice** sings two lines over the choir.
2. 6.7 s: **instrumental** (the owner asked for no singing): a long choir chord, a drum roll (victory) or a low heartbeat (defeat), then the music rings out.

Lyrics (German, rhyme on "Credits" for the roll of credits):
- Victory: "Die Zone gehalten, die Nacht ist vorbei, / Das Licht ist zurück, und wir sind frei." and, in the first draft, "Der Strom kehrt heim im hellen Blitz, / Jetzt rollen die Credits." (the last two lines were dropped from part 2 when it became instrumental).
- Defeat: "Die Zone ist gefallen, die Nacht bricht herein, / Der Strom ist erloschen, wir sind allein."

| Attempt | Song id | Result |
|---|---|---|
| Victory, first (`plan-victory`) | `AuuN6BNO6ftvCwQwF7uN` | **used.** The key stayed D minor (F 0.105 against F# 0.065): the change to major did not happen. The owner: "an sich ziemlich gut", and the first attempt is the one to take |
| Defeat, first (`plan-defeat`) | `PInQ2YB932scGAbI9oau` | **used.** D minor as wanted |
| Victory, second (`plan-victory-v2`): the voice styles of the refrain **and a sound reference** (`conditioning_ref` on the refrain, strength medium) | `x7IDZhvNKy8j7Qx5dpc4` | rejected: the reference won and the output was only the refrain again, as feared. About 620 credits wasted |
| Victory, way A (`plan-victory-v3`): the refrain's voice styles (otherworldly, accent) without a reference | `va4nKKAACcuqd91tnyEM` | new material (correlation 0.15 with the refrain); not chosen, the owner kept the first attempt |

The female voice is not the singer of the whole piece in any attempt; ElevenLabs sings a new voice each time. A sound reference does not carry a voice into a new part.

## The quiet loops (about 506 credits each)

Two calls, the same trick as the refrain: **step 1** keeps the last bar of the jingle before the drum roll (16.667 to 20.0 s) and makes 13.333 s of calm instrumental (choir on open vowels, a warm pad, a slow arpeggio; defeat: cold choir, low cello, a slow heartbeat); **step 2** keeps 10.333 s of it, regenerates the last 3 s so that they flow into the start, and keeps the first 6.667 s again.

- **The first attempt of the victory step 1 faded out** (section name "[Ruhe]", ref into the drum roll): the level falls from -16 to -61 dB over the 13 s although the text said "no fade out". With the section "[Loop]", "constant volume from start to end, sustained, no decay" in the styles and "outro, decay, dying away" in the negatives it held (-14 to -18 dB).
- Victory: step 1 `NPJGouN0bFjqxxBbYVrj` (the failed one: `NBR4XNtnlNjy3acIEMij`), step 2 `fHK7ylpoIEzp6r1zULR3`. Defeat: step 1 `WHw2wDdM1W5PSIXUW79I`, step 2 `YiT0wAVG1Bl3Etb2xm0S`. The mp3 files are in `results/`.
- The loop is the first 4 bars of step 2's output, starting at a rising zero crossing about 20 ms in; the real continuation behind the end is cross-faded into the start over 250 ms (equal power). Seam step 0.0014 (victory) and 0.0003 (defeat). The defeat loop has a deep thump every two bars (the heartbeat, 10 dB above the rest); the owner accepted it.
- **AAC container length.** `ffmpeg` writes the AAC duration only in steps of 44 samples (an input of 588,000 gives 587,985, one of 588,020 gives 588,029). The loops are therefore cut to **587,985 samples** and encoded from the loop plus its first 15 samples (which the container trims), so that the browser loops exactly the loop.

## Free versions built first and heard

Before the generated loops, `../tools/loops/pads.py`, `tonal.py` and `before_drums.py` made pads from the jingles' last chord by time-stretching (the Paulstretch method: a random-phase FFT stretch). The first pad sounded like **a fan**: it had been made from 20.6 to 22.6 s, where the drum roll runs (an onset every 0.1 s), and stretching noise gives noise. Keeping only the tonal peaks of the spectrum (7 dB over the local median, nothing above 3.5 kHz) removed the hiss; the better source was the second before the drums rise (19 to 20 s), as the owner suggested. The generated loops sounded better and were taken. The defeat loop in the game was such a pad until the generated one replaced it.

## The listening pages

The pages were Artifacts (private links; they may be gone). `../tools/loops/build_page.py` and `page_body.html` rebuild the last one (jingle, loop, Hero line with ducking) from the files here and the Hero voices of the game.

## Credits

About 31 credits per second of new audio (estimates; the ElevenLabs page has the real numbers): jingles first round 2 x 620, victory v2 620, victory v3 620, victory quiet loop 413 (failed) + 413 + 93, defeat quiet loop 413 + 93, the refrain inpainting 93: **about 4,000** in total for 2026-11-19.
