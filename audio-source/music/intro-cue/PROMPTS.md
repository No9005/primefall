# Prompts: the music of the film of Start (`intro-cue/`)

**Draft, not sent yet.** The cue under the film (tap on Start to the flash, about 9 s) between the main-menu theme (`../menu-theme/`) and the
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
to lead into the loop. The reference is the first 10 s of the original piece (a file of the `pieces/` folder), uploaded first
(`POST /v1/music/upload`). Only the cue is used in the game (cut at 9.0 s).

## Times of the film (from the tap)

| Time | The picture | What the cue does |
|---|---|---|
| 0 to 1.2 s | the start screen is pulled away, the tunnel of light | a low rising swell, the choir holds a deep D |
| 1.2 s | the light ring of the hyperspace's end | one bright impact |
| 1.2 to 3.7 s | the planet, the far Notstrom | wide and calm, bells over a drone |
| 3.7 to 6.9 s | the astronaut's visor mirrors the Notstrom | the choir grows, a low pulse without tempo |
| 6.9 to 9 s | the camera rides along the hull to the airlock, the flash | a riser and a swell, then a sustained choir chord on D |

## The prompt (to be sent after the owner's okay)

The text of the chunk, the styles and the negative styles are in `plans/intro-cue-v1.json`.
