# Prompts: the music of the film of Start (`intro-cue/`)

**Sent 2026-11-21, two takes (seed 424242 and 7200).** The cue under the film (tap on Start to the flash, about 9 s) between the main-menu theme (`../menu-theme/`) and the
Hero Select loop (`apps/web/public/assets/audio/music/intro.m4a`, the first 20 s of `pieces/notstrom-stage-3-whole-piece.mp3`).

## What it must fit

- **Menu theme:** D minor, about 84 BPM, ends and begins on a choir chord on D. The player can tap Start at any moment of the loop, so the
  menu theme fades out (1.5 s) under the first seconds of the cue; the cue therefore has to be built on D and must not start with a tempo.
- **Hero Select loop:** measured: D, A, F, E (D is the strongest), a steady level (about 0.11 RMS, no dynamics), few onsets (a held drone of
  male chest voices), 72 BPM written but no beat to speak of. Its first 4 s are D, A, C#.
- **Level:** both at about -25 dB mean power in the game; the cue the same, with the flash allowed a little over.

## The way: the end is given, the middle is made

The plan (`plans/intro-cue-v1.json`) has the new cue as its first chunk and, after it, the first 10 s of the Hero Select loop as an audio
reference that stays unchanged (as for the extension of the menu theme: kept parts stay identical, the seam does not click), so the cue is made
to lead into the loop. The reference is the first 10 s of the original piece (cut as `hero-select-intro-0-12s.mp3`, the API takes no upload under 10 s, so 12 s were uploaded; song id `f7vVTlrWZaZjhLrbpqa4_upload`). Only the cue is used in the game (cut at 9.0 s).

## Times of the film (from the tap)

| Time | The picture | What the cue does |
|---|---|---|
| 0 to 1.2 s | the start screen is pulled away, the tunnel of light | a low rising swell, the choir holds a deep D |
| 1.2 s | the light ring of the hyperspace's end | one bright impact |
| 1.2 to 3.7 s | the planet, the far Notstrom | wide and calm, bells over a drone |
| 3.7 to 6.9 s | the astronaut's visor mirrors the Notstrom | the choir grows, a low pulse without tempo |
| 6.9 to 9 s | the camera rides along the hull to the airlock, the flash | a riser and a swell, then a sustained choir chord on D |

## The prompt (sent after the owner's okay)

The text of the chunk, the styles and the negative styles are in `plans/intro-cue-v1.json`.

## Result (measured, not heard by the author of the file)

Take A (seed 424242, song id `kjHHvgdKFjOw4BejF6tx`, `intro-cue-take-a-seed424242.mp3`), take B (seed 7200, `YZTecwntUZC6GDSjvK1F`, `intro-cue-take-b-seed7200.mp3`); each is 19 s: the cue (0 to 9 s) and the kept reference (9 to 19 s; its level is about 1 dB under the original).

| | Take A | Take B |
|---|---|---|
| Level of the cue (RMS) | 0.011 to 0.037 in the first 3 s, then falling to 0.003 | 0.001 rising to 0.014 and staying there |
| Arc | the loudest point is at 2.2 s (the impact), then the music dies away: no build to the flash | rises slowly to 7.5 s, no strong riser |
| End of the cue | nearly silent (0.004), then a jump to the loop (0.11) | 0.015, then a jump to the loop |
| Key | D, A, F# | D, A, C# (the same as the first seconds of the loop; chroma match with the loop start 0.90, take A 0.99) |

Both cues are far under the level of the Hero Select loop (0.11): the model made quiet, calm music. B follows the planned arc better, A matches the key better. Probe files (menu theme fading out, the cue, the loop): in the game, the cue would get a gain (+8 dB for B), which brings its end to the level of the loop start; the impact and the riser are not strong enough yet for a flash.

## In the game (owner's decision 2026-11-21: take A, with a soft seam)

Take A is the sound of the film. **The first probe had a loud click at the seam**: the cue had been cut at 9.08 s, which is inside the kept part of the model (its first hit comes at 9.06 s), and without a fade. The version in the game:

- `tools/loops/make_film_cue.py` cuts the cue at **8.9 s**, fades it out over its last 0.4 s and brings it to the level of the Hero Select loop (+4.5 dB; the same downmix as the measurement of the loop); the file is `apps/web/public/assets/audio/music/film.m4a` with the game gain 1 (`film` in `manifest.json`).
- **Sequence from the tap on Start:** the menu theme fades out at once (1.5 s) and the sound of the film starts (`TitleScreen.tsx`, `startFilmCue` in `audio.ts`); 8.7 s after the tap the Hero Select loop starts under its end with a 1 s fade-in, **timed on the audio clock** when the sound of the film starts (`scheduleLoopUnderFilm` in `audio.ts`, `FILM_SOUND` in `intro-film.ts`; the pictures start later and by a different time on every device, so they must not time it); when the film is skipped the sound of the film fades out in 0.4 s and the Hero Select starts its loop as usual.
- Measured at the seam (a probe file with the game levels): the largest jump between two samples 0.017 (the file's 99th percentile 0.019): no click.

**Fix after the owner heard a jerky transition from the door to the Hero Select music (2026-11-21):** two causes, both in the code and not in the sound. (1) The loop was started by the clock of the pictures, which begins after the live part and the decoding; it could come late. Now the audio clock times it. (2) React in development mounts the Hero Select twice, and the first leaving stopped the loop (a fade-out over 0.4 s) before it was started again from the beginning (a fade-in over 0.5 s): a dip and a restart at the arrival. Now a stop of the intro waits 80 ms and a new start takes it back (`stopIntro`, `startIntro` in `audio.ts`), so the loop goes on without a break.
