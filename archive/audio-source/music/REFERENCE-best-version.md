# Reference: the best version of the Notstrom music, and how it was made

**What the owner considers the best version** (2026-11-18): first the **whole piece** made through the API, **every chunk for itself with inpainting** (stages 1 to 3), and **afterwards the layers** for planning and the normal Resolution. This file keeps that process so it can be repeated or taken as the model. The exact files are in this archive; nothing here is made up from memory: the plans are the JSON that was sent, the numbers were measured.

**The prompts themselves** (every `text`, every list of positive and negative styles, in full and readable) are in **`PROMPTS-best-version.md`**. The plan files in `plans/` hold the same as JSON.

## The order, with the exact API calls

| Step | What | Call | Plan / file | Result (song id) |
|---|---|---|---|---|
| 0 | the refrain test: one chunk of 8 bars, the sound the owner liked best | `POST /v1/music` | `plans/refrain-test.json` | `zOoAegJapdofPIHkQV9D`, `pieces/refrain-test-the-good-feeling.mp3` |
| 1 | the refrain test is **uploaded** so that it can be an audio reference | `POST /v1/music/upload` (multipart `file`) | `pieces/refrain-test-the-good-feeling.mp3` | `fZDeTVYfbJujEraIqfiL_upload` (`ids/upload-response.json`) |
| 2 | **Stage 1** (100 s): Intro, Strophe 1, Aufbau, Refrain 1 | `POST /v1/music` | `plans/stage-1.json` | `l0CGzRMzAFDAFQezPg1s`, `pieces/notstrom-stage-1.mp3` |
| 3 | **Stage 2** (180 s): stage 1 kept, plus Strophe 2, Refrain 2, Bridge | `POST /v1/music` | `plans/stage-2.json` | `hF6hdmMPuJ6jScDiPnYJ`, `pieces/notstrom-stage-2.mp3` |
| 4 | **Stage 3** (233 s): stage 2 kept, plus Finale and Ende | `POST /v1/music` | `plans/stage-3.json` | `hjh5gOEmDzH7mGlK8jjz`, `pieces/notstrom-stage-3-whole-piece.mp3` |
| 5 | the pieces joined by hand (150 ms crossfades) | local, `ffmpeg` | | `pieces/notstrom-stages-joined-locally.mp3` |
| 6 | **afterwards the layers**, each a single chunk of 8 bars, **no seed, no reference**: drone, pulse, drums | `POST /v1/music` | `plans/pilot-2-drone.json`, `pilot-2-pulse.json`, `pilot-2-drums.json` | `EApJsWvdVFSaff1delmD`, `6xO88kT7BCVefiqy0fUy`, `Fm6rNKPbOojkvRDXZRaE`, `layers/pilot-2/` |
| 7 | the layers stretched to exactly 72.000 BPM and cut to exactly 8 bars | local, `tools/align.py` | `tools/align-result.json` | `layers/aligned/` |

The same request shape for every composition call (the key is a placeholder that the session's proxy fills in; use `ELEVENLABS_API_KEY` otherwise):
```
curl -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d @plans/stage-2.json -D stage2.hdr -o stage2.mp3        # the Song-Id is in the response header
```
The body is `{"composition_plan": {"chunks": [...]}, "model_id": "music_v2_5", "store_for_inpainting": true, "seed": 424242}`. The scripts that were run are in `tools/api-calls/` (`run_stage1.sh` to `run_stage3.sh`). **`tools/api-calls/reproduce-best-version.sh` runs the whole process in order** (it patches the song ids of the earlier steps into the plans; `DRY_RUN=1` shows it without spending anything).

## The chunks of each stage

All stages: `model_id` `music_v2_5`, `store_for_inpainting` true, **seed 424242**, every chunk with `context_adherence: "high"`, a block of positive and negative styles of its own (see the JSON), the section name in square brackets and the lyrics or directions in `text`.

**Stage 1** (`plans/stage-1.json`, 100 s, charged about 3,100 credits)

| # | Section | Length | Sound reference (`conditioning_ref`) |
|---|---|---|---|
| 1 | [Intro] | 20 s | sound reference: `fZDeTVYfbJujEraIqfiL_upload` 0 to 26.667 s, strength `low` |
| 2 | [Strophe 1] | 40 s | sound reference: none |
| 3 | [Aufbau] | 13.333 s | sound reference: none |
| 4 | [Refrain 1] | 26.667 s | sound reference: `fZDeTVYfbJujEraIqfiL_upload` 0 to 26.667 s, strength `high` |

**Stage 2** (`plans/stage-2.json`, 80 s of new audio, **2,475 credits**, the API quoted it exactly)

| # | Section | Length | Sound reference (`conditioning_ref`) |
|---|---|---|---|
| 1 | **kept**: `l0CGzRMzAFDAFQezPg1s` 0 to 100 s | | audio reference chunk (unchanged, not charged) |
| 2 | [Strophe 2] | 26.667 s | sound reference: none |
| 3 | [Refrain 2] | 26.667 s | sound reference: `l0CGzRMzAFDAFQezPg1s` 73.333 to 100 s, strength `medium` |
| 4 | [Bridge] | 26.667 s | sound reference: none |

**Stage 3** (`plans/stage-3.json`, 53 s of new audio, about 1,650 credits). The audio reference chunks are at most 120 s each, so the kept part is split into two of 90 s that join without a seam.

| # | Section | Length | Sound reference (`conditioning_ref`) |
|---|---|---|---|
| 1 | **kept**: `hF6hdmMPuJ6jScDiPnYJ` 0 to 90 s | | audio reference chunk (unchanged, not charged) |
| 2 | **kept**: `hF6hdmMPuJ6jScDiPnYJ` 90 to 180 s | | audio reference chunk (unchanged, not charged) |
| 3 | [Finale] | 40 s | sound reference: `hF6hdmMPuJ6jScDiPnYJ` 126.667 to 153.333 s, strength `medium` |
| 4 | [Ende] | 13.333 s | sound reference: none |

What made it work, as measured:
- **Kept parts stay unchanged**: the first 100 s of stage 2 match stage 1 with a correlation of 0.9986, and stage 3 keeps stage 2 (0.97 to 0.9999). The seams do not click.
- **The refrain chunks carry a sound reference** of the earlier refrain (stage 1: the uploaded refrain test, `low` strength for the intro and `high` for Refrain 1; stage 2 and 3: the refrain of the stage before, `medium`). That is how the sound of the liked refrain returned in Refrain 2 and the Finale.
- **The Bridge became quiet** (-24.8 dB against -13.6 dB in the refrain) because it was a chunk of its own with "at least 10 dB softer than the chorus", "no drums, no high frequencies" and a long list of negatives.
- **Tempo**: 71.8 to 71.9 BPM in every chunk (the "72 BPM" in the text is a hint, not a rule; the one-call version v1 drifted to about 80 BPM).
- **Modulation did not happen** (the Refrain 2 and the Finale asked for other keys and stayed in D minor).

## The layers afterwards (pilot 2)

Three single chunks of 8 bars (26.667 s), D minor, 72 BPM, **static harmony (pedal on D, no chord changes)**, in this order: the drone (deep male chest voices, a long sustained note), the pulse (a low synth bass like a heartbeat), the drums (kick on every beat, snare on 2 and 4, no fills). **No seed and no reference**: layers made with a fixed seed and a reference came out 95 to 99 % identical (pilot 1). They measured 71.8 to 71.9 BPM (`tools/align-result.json`), were stretched by 0.2 %, found the beat grid and were cut to exactly 8 bars with a 60 ms blend at the loop seam.

## One correction to what was said before

The refrain layer in the game (`layers/aligned/refrain.mp3`, `apps/web/public/assets/audio/music/refrain.m4a`) is **not cut from the whole piece**. Compared by spectrum it matches the **first refrain test** (`pieces/refrain-test-the-good-feeling.mp3`, correlation 0.997 at 0.1 s offset), stretched and cut to 8 bars. The whole piece (stages 1 to 3) is **not used in the game**; only its refrains share the sound. The script that aligned the refrain was not saved (`tools/align.py` handles the three layers); the aligned file is. A first attempt with the same functions (`stretch`, `first_beat`, `rotate_loop`) did not reproduce it exactly (correlation 0.58 at the first beat found), so the refrain's cut point was chosen differently.

## What is saved and what may not exist any more

- Saved here: every plan that was sent, every response header with the song id, the upload answer, the scripts, every result as mp3, the measurements.
- **Not guaranteed**: the song ids at ElevenLabs. There is no call that downloads a song again; the ids only work as audio references while ElevenLabs keeps the songs, which I could not test without spending credits. Uploading the saved mp3 (`/v1/music/upload`) gives a fresh id; **the upload costs as much as a generation** and is checked for copyright.
- Credits for the whole path: the refrain test about 830, the three stages about 7,200 (3,100 + 2,475 + 1,650), the three layers about 2,500.
