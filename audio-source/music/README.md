# Music sources for Primefall (map "Notstrom")

The generated music, the plans that made it and what we learned. **This folder is not built or shipped**: it lies outside `apps/` and `packages/`, so Vite and the npm workspaces never see it. Final game audio goes to `apps/web/public/assets/audio/` (see the README there).

Why it exists: ElevenLabs gives **no way to download a generated song again** (there is no call to fetch a song by its id; `/v1/history` lists speech only), and the sessions that made these files are short-lived. A song id is only good as an audio reference for further generation (inpainting), and only for songs stored for it; how long ElevenLabs keeps them is not documented. So the files and plans live here.

Made with ElevenLabs Music v2.5 (`music_v2_5`). Check that the licence of the plan allows use in a game before anything ships.

## The idea

- **The world:** alien artefacts ("Prime") fell on the planets ("Primefall"); mega corporations hire mercenaries to get them. Notstrom is a ship that holds artefacts; the mercenaries secure it. The motto of the piece: "Hold the Prime." (sung: "Halt das Licht").
- **The sound:** dark sci-fi, 1970s and 1980s analog synthesizers, a driving bass like a heartbeat, a mixed choir with deep male voices, a female lead who is a Japanese singer singing German (a strong accent, so it sounds almost but not entirely like German), dense and pressing in the Resolution. Artist and film names are not allowed in the styles (the API answers `bad_composition_plan`), so the sound is described with instruments and an era.
- **The text** (German, short lines, long vowels, the accent on the first syllable of NOTstrom): see `plans/whole-piece-v1.json` (Intro, Strophe 1, Aufbau, Refrain A, Strophe 2, Refrain B, Bridge, Finale C, Ende).
- **Use in the game (not built yet):** vertical layering (layers faded in and out with the situation) with horizontal sequencing (the intro once, a loop, the finale only at the end of the match). 72 BPM, D minor, 8 bars = 26.667 s per loop unit.

## What is here

| Path | What |
|---|---|
| `pieces/notstrom-stage-3-whole-piece.mp3` | the whole piece (3:53): stage 1 + 2 + 3, as the API returned it (kept parts + new parts) |
| `pieces/notstrom-stages-joined-locally.mp3` | the same, joined by hand with 150 ms crossfades (stage 1 pure to 1:40, stage 2 to 3:00, stage 3 to the end) |
| `pieces/refrain-test-the-good-feeling.mp3` | the first refrain test (26.7 s): the one the owner liked best for the feeling. Used as the sound reference |
| `pieces/notstrom-v1-one-call.mp3` | the whole piece made in one call (96 kbit/s copy): worse (see below) |
| `pieces/test-1-10s-heartbeat-bass.mp3` | the first 10 s test: only a bass carpet, discarded |
| `layers/pilot-1/` | first layer pilot (drone, pulse, drums): **failed**, the three are nearly the same audio |
| `layers/pilot-2/` | second pilot (no seed, no reference): three different layers |
| `layers/aligned/` | pilot 2 + the refrain, each cut to exactly 8 bars at 72.000 BPM (loop ready) |
| `stems/` | the six stems of the refrain (`six_stems_v1`) and the one useful stem of test 1 |
| `plans/` | every composition plan that was sent (JSON, ready to resend; see "Song ids") |
| `tools/align.py` | stretches layers to exactly 72 BPM, finds the beat grid and cuts a loop of exactly 8 bars |

## What worked

- **A single chunk of 8 bars (26.667 s) in D minor at "72 BPM"** came out at 71.8 to 71.9 BPM in every layer that was measured (a stretch of 0.2 % makes it 72.000).
- **The refrain test** (one chunk, full style block, German lyrics, choir, female lead) had the right feeling: 28 % of the energy in the bass, 38 % in the mids (voices), 23 % in the presence range.
- **Inpainting works as a way to build in stages.** An audio reference chunk keeps a section unchanged: the first 100 s of stage 2 match stage 1 with a correlation of 0.9986, and stage 3 keeps stage 2 (0.97 to 0.9999). The seams do not click, the level is steady (-15.3 to -14.9 dB at 1:40), the tempo holds (71.9 BPM). Near a seam the last seconds before it are blended a little into the new part.
- **The Bridge became quiet** (-24.8 dB against -13.6 dB in the refrain) once "at least 10 dB softer than the chorus", "no drums, no high frequencies" and a long list of negatives were given in a chunk of its own.
- **Layers made one by one, with no seed and no reference, are different audio** (correlation about 0 between drone, pulse and drums). The pulse is almost only sub bass (72 % under 120 Hz), the drums are mostly hats and snare (60 % over 2 kHz) with a steady pulse (0.85 autocorrelation at the beat).
- **The stem separation of a dense refrain** returned four useful stems (bass, drums, "other" = synths and choir, vocals); they add up to the original again (correlation 0.9994 after a 25 ms shift of the MP3 decoder, residual 29 dB down).

## What did not work

- **The first test (10 s, "grim dark sci-fi with a heartbeat bass")** came out as a bass carpet: nothing above 2 kHz, no drums. The stem separation then put all of it into `bass`.
- **Modulation does not happen.** "E minor, one whole tone higher" for Refrain 2 and "F-sharp minor" for the Finale were ignored (the strongest pitch classes stay D, A, E). Probably the sound reference pulls to D minor; not tested without it.
- **One call with nine chunks (v1)** drifted to about 80 BPM, the Bridge was not quiet (-12 dB), the female lead was too dominant, the German too precise and the choir with men often missing. Part of it was our own prompt ("dominant, the strongest voice in the mix" and "choir only as a soft pad").
- **The tempo in the text is a hint, not a rule.** v1 gave 80 BPM, the others 71.9.
- **Pilot 1 of the layers used the same `seed` (7200) and a `conditioning_ref` of the drone for all three layers.** The result: waveforms 95 to 99 % the same. A fixed seed for several layers and a reference both pull the layers together. Do not do either for layers.
- **"Sparse" and "almost silent" are often ignored.** The first drone had 4 onsets per second and 14 % of the energy over 5 kHz.
- **Stem separation of the whole piece is not clean enough for layers:** a lot of bleed (the owner's judgement after listening). Lead and choir are one stem. The `guitar` stem is nearly silent (-57 dB) and `piano` is empty.
- **The pulse layer's key cannot be read from its chroma** (its notes lie under 50 Hz).

## What we learned about the API (read from the OpenAPI file and the docs)

- `POST /v1/music` with `composition_plan` (`chunks`) and `model_id: music_v2_5`. A chunk: `text` (`[Section]`, lyrics, `{inline directions}`, `(sounds)`), `duration_ms` (3,000 to 120,000, always enforced for v2 and v2.5), `positive_styles` and `negative_styles` (up to 50 each, English), `context_adherence`, optional `conditioning_ref` (`song_id` + `range`, at most 30 s) and `condition_strength` (`low`, `medium`, `high`, `xhigh`). The first chunk sets the tone of the whole piece.
- **Audio reference chunk:** `{ "song_id", "range": { "start_ms", "end_ms" } }`, at most **120 s** each (a longer one is refused with a 422, nothing is charged); two of them in a row join without a seam.
- `store_for_inpainting: true` stores the song and returns its id in the `Song-Id` response header. `POST /v1/music/upload` (multipart) stores an existing file. Kept parts are not charged again.
- `seed` exists ("more consistent results, exact reproducibility is not guaranteed"). `with_timestamps` returns word timestamps. Not used here.
- `POST /v1/music/stem-separation` (multipart `file`, `stem_variation_id` = `two_stems_v1` or `six_stems_v1`, `output_format`) returns a zip: `bass`, `drums`, `guitar`, `other`, `piano`, `vocals`.
- **Price:** about **31 credits per second of new audio** (stage 2: 80 s cost exactly the 2,475 credits the API quoted). Early guesses of 15 credits per second were wrong. A whole piece of 233 s is therefore about 7,200 credits. The account counter lags behind and did not match each call; the ElevenLabs account page has the real numbers.
- **The API key has its own credit quota** (set on the key; one call was refused with 401 `quota_exceeded` while the account still had credits).
- The ElevenLabs docs (`elevenlabs.io`) have to be allowed in the session's network settings; the API host alone is not enough.

## Song ids

| What | Song id | Stored for inpainting |
|---|---|---|
| Test 1 (10 s) | `uXeyCYoFktNmMDDEUl2U` | no |
| Refrain test | `zOoAegJapdofPIHkQV9D` | no |
| Refrain test, uploaded | `fZDeTVYfbJujEraIqfiL_upload` | yes |
| Whole piece v1 | `AlcwK9dCzT7N31odU4BL` | no |
| Stage 1 (Intro, Strophe 1, Aufbau, Refrain 1; 100 s) | `l0CGzRMzAFDAFQezPg1s` | yes |
| Stage 2 (+ Strophe 2, Refrain 2, Bridge; 180 s) | `hF6hdmMPuJ6jScDiPnYJ` | yes |
| Stage 3 (+ Finale, Ende; 233 s) | `hjh5gOEmDzH7mGlK8jjz` | yes |
| Pilot 1: drone / pulse / drums | `oiOxLRYS8cJp76lAsc72` / `SzrMaDCMGTvu1s99zKaB` / `YIcL4Ebk4bx5hKioLAFM` | yes |
| Pilot 2: drone / pulse / drums | `EApJsWvdVFSaff1delmD` / `6xO88kT7BCVefiqy0fUy` / `Fm6rNKPbOojkvRDXZRaE` | yes |

Seeds used: stages 1 to 3 `424242`; pilot 1 `7200`; everything else none.

To resend a plan (the key goes in `xi-api-key`; `plans/stage-3.json` points at `hF6hdmMPuJ6jScDiPnYJ`, which may no longer exist):

```
curl -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d @plans/pilot-2-drums.json -o drums.mp3
```

## Where this stands and what comes next

- **The aligned layers** (`layers/aligned/`): the drums were stretched by 0.2 %, all are cut to exactly 26.667 s with a 60 ms blend at the loop seam. The beat phase between the layers was found with a comb on each layer's own beat grid; which beat of the bar the pulse sits on could not be told from the data (the similarity to the kick was flat), so it is a guess.
- **Levels for the preview** (rendered, not stored here): level 0 drone, 1 drone + pulse, 2 + drums, 3 the finished refrain over the drone; loudness -24, -22, -19 and -17 dB RMS.
- **Open:** the remaining layers of the plan (metal ticking, the driving bass, the melody, the climax voices); a check by ear that independently made layers do not clash in harmony (the drone and the drums share only the tempo and D as the tonic); the music system in the game (layers started together, changes on a bar line, ducking under the voice lines, a separate bus); the format (AAC for loops, because MP3 leaves a gap at the seam); the size (a loop of 160 s in four layers is about 8 MB at 96 kbit/s).
