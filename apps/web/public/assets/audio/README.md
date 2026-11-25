# Game audio

Final sounds of the Heroes, ready for the web app. One folder per Hero: `audio/<hero>/voice/`, `audio/<hero>/sfx/` and a `manifest.json`. The game plays them (see below).

## Files

- Mono MP3, 44.1 kHz: voice at 80 kbit/s, effects at 96 kbit/s. MP3 plays in every browser, also on iOS.
- Voice is levelled to about −16 LUFS, effects to about −14 LUFS (leather steps and the cover thump are quieter on purpose). Voice has a little EQ and compression, no reverb.
- Short lines start on the sound; the silence at the head and tail is cut. A line that was too long was cut by hand (see the notes in the manifest).

## The manifest

`manifest.json` has two parts:

- `assets`: every file with its id, the spoken text or what the sound is, and its length.
- `cues`: when to play what. `on` is the game event (`cardPlayed`, `attackHit`, `moveEndedOnCover`, `exhausted`, `matchEnd`, ...), `card` the card, `atMs` the time in ms from the start of that Hero's clip (negative: before it), `atImpact` the moment the shot arrives, on the tile of its target. `play` lists variants: one is picked at random, never the same twice in a row. `chance` (0 to 1) is the chance that the Hero says anything at all: a Pitch has 0.6, going into cover 0.5. `guess: true` marks times the code does not give exactly.

## How the game plays it (`apps/web/src/audio*.ts`)

The Web Audio API of the browser, no library: two buses (voice and effects); the sound is armed on the first tap, because a browser plays sound only after one. There is no mute switch yet: it comes with the menu with the burger button (issue #446). The sounds of the Heroes in the match load while the player plans. A Hero Select tap plays the Hero's line and its effects; a Pitch, a frame of the Resolution and the end of the match follow the cues.

**What may be heard (Fog of War).** Own Heroes always. An enemy only while the Squad sees it and it is drawn; the sound of a Hidden or unseen enemy would give away its position.

**How important a sound is** (`CUE_PRIORITY` in `audio-mix.ts`; the own Squad's Heroes get one tier more):

| Tier | Voice | Effects |
|---|---|---|
| 5 Critical | Hero Select, Exhausted, the end of the match | the same |
| 4 Important | a Hero is hit (the cry) | the shots, the impacts, a hit |
| 3 Normal | the line of a card, a Shield, the end of Hidden | a Shield, the end of Hidden |
| 2 Minor | taking cover | taking cover, Cover that crumbles |
| 1 Ambient | a Wait, a Pitch | steps |

**Voice rules** (`DEFAULT_VOICE_RULES`):

- One line at a time per Hero. A more important line cuts the one that runs; a weaker one is dropped.
- Cooldown: after a line ended, the Hero is silent for 4 s. Only a Critical line, or one two tiers above the last line, breaks it.
- At most two Heroes speak at once, wherever they stand (the player hears all voices from the same speaker). A third is dropped unless it is more important than the quietest speaker, which then fades out.
- The last words of an Exhausted Hero start only after its first line has ended.
- A Pitch speaks only some of the time (`chance`), and a random variant when it does.

**Effect rules** (`DEFAULT_SFX_RULES`): at most 10 at once (the least important makes room for a more important one), the same effect never twice within 70 ms (six Heroes taking the same step), and a sound is quieter the further it is from the player's Hero (full within 4 tiles, down to 35 % at 14).

With reduced motion the clips do not play, so all sounds of a frame start with the frame.

The values are first proposals; tune them by playing.

**The clips of the Heroes in the Hero Select** (cues `hangarClip` with a `clip`, in the Hero manifests): the hangar player (`hangar-select.ts`) announces every clip as it begins (`onClipStart`), and the screen plays the cue of that clip (`cue.atMs` counts from the start of the clip, at the speed it is drawn). Each pass of a clip that repeats is announced again. A tap that chooses a Hero silences what runs first (`stopAll`) and then starts the clip.
- **Tilly's act** (`docs/design/heroes/pixellab-act/`): `sfx.act-fiddle` (fiddling at the arm, welding and ratchet noises) from 0.3 s, `sfx.act-tear` at 1.1 s (the file is the take from its crack on: the crack falls at 1.2 s, the clatter after it, as the claw lands) and her panicked gasp `voice.act-gasp` ("Oh!") at 1.2 s. The act plays **once** per cycle and the idle before it takes 3 to 8 loops (6 to 16 s, `LOOPS` in `hangar-select.ts`), so the arm never tears off twice in a row. The cue has the top tier (Critical for the voice) against the 4 s cooldown of a voice. The clack of putting the arm back was made and dropped. The takes: `archive/audio-source/voice-sfx/sfx/tilly/act/`, call 44 in `PROMPTS.md`.
- **Max's lift and throw** (his own voice, registered as effects, so that his select line, which is a voice and runs 4 s, does not cut them): `sfx.act-lift`, his training grunts (3 s, three phrases: at the lift, at the end of the hold and the release after the set-down) at the start of the act clip, which plays once because the grunts last longer than a pass; `sfx.act-throw`, his cry as the barbell leaves his hands, at the start of the select clip. The sounds of the barbell (the set-down, the whoosh, the crash against the metal door) are not in yet.
- **Kit's "Nice."** (`voice.act-nice`, `[quietly, content]`): when the rifle gleams in his act clip (1.9 s), on 70 % of the passes. A hum was not made: Kit never celebrates, and a quiet "Nice." is his understatement.
- **The sparks of the hangar** (`ambience.hangar.spark`, `ui.hangar-spark`): the scene tells (`HangarScene.sounds`) when a spark at one of the two fuse boxes begins (`cycleStarts` over the scene's clock, 3.7 s from 0.6 s and 5.3 s from 2.1 s), `playHangarSound` plays it at half level. The flicker of the light has no sound yet (the take sounded like no fluorescent tube).
- **Max's one shot:** the select-in clip (`selecti`) has one shot at 1.08 s and the select clip (`select`, after a tap in the middle of the lift) one at 1.63 s; both are cues of their clip. His `heroSelected` cue has only the line: the three `slam` shots belonged to an older, longer clip.
- **The ambience of the map** plays in the hangar too, at `HANGAR_AMBIENCE_LEVEL` (0.5) of its level in the match (the hangar is part of the hauler), until the screen is left.

## The map and the cards (`audio/map/`)

Not tied to a Hero; `map/manifest.json` has its own shape (`ambience` and `ui`).

- **Ambience of Notstrom:** two loops that run for the whole match, a huge slow ventilation fan (`loops/bed.wav`) and the hum of the plasma core (`loops/core.wav`, louder the nearer the player's Hero is to the Prime Zone), and every 10 to 25 s a quiet sound at random (ventilation burst, hull creak, sparks, steam, debris) with a random left or right placement. The loops are **WAV**: an MP3 puts a short silence at its end, which is a gap at the seam of a loop. They fade in and out over 2 s. The ambience is the least important sound (`Priority.Background`): it never takes the place of a voice or an effect.
- **The cards:** a card is drawn (`cardDraw`, one per card as it leaves the Deck pile, none with reduced motion), a card goes into the Queue (`cardPlayed`), a card comes back (`cardBack`, also when a Pitch is undone), Energy is gained (`energyUp`, a Pitch) and the shuffle (the same riffle twice, on the two riffles of the animation in `deck-shuffle.ts`; none with reduced motion). The sounds follow the counts of the plan, so a tap, a drop and an undo sound the same, and a switch to another Hero or a new Round makes none.
- A card burns into the Exile (`cardBurn`, Deck Damage): once for the whole hit however many cards burn, as the glowing edge of the glimmer appears (`burnSoundMs()` in `deck-burn.ts`); none with reduced motion, and none when the player is looking at another Hero's pile.
- Spending Energy has no sound of its own.
- **The laser barrier of the Prime Zone** (`loops/laser-hum.wav`): a low hum like a laser sword while the red laser walls stand (the Prime Zone is inactive), louder the nearer the player's Hero is to the Prime Zone, with fades. When the walls flicker out, `laserOff` (flicker and power-down) plays once.
- **The Scout Drone of the player's Squad** (`loops/scout-drone.wav`, `ambience.scoutDrone` in the map manifest): a dark, soft hovering hum that runs for as long as the Squad has a Site Survey area out (two Resolutions; `view.revealedAreas`, which are the own Squad's areas only, so it gives nothing away about the enemy), with fades, quieter the further the player's Hero is from the nearest area (`setScoutDrones` in `audio.ts`). The same loop hums in the **Hero Select** while Tilly is the chosen Hero: it starts 0.9 s after her tap, where her select clip lets the drone go, and fades out when another Hero is chosen, the choice is taken back or the screen is left (`setSelectDrone`; it is not in Tilly's manifest, so a change of her cues does not touch it). It replaces the old whining one-shot `sfx.scout-drone`, which is gone from Tilly's manifest (the Site Survey card no longer plays it); the line of the card stays. The loop is a processed take of an ElevenLabs sound, see `archive/audio-source/voice-sfx/` (call 43 in `PROMPTS.md`). Not built: a drone hum for the enemy's areas (a scan the enemy has out is only shown as `scannedAreas`).
- **A zone taken and Credits** (`zoneTaken`, `score`, a cash register "ka-ching"): with the callout of the player's own Squad. A zone that changes hands to the player's Squad sounds `zoneTaken` and, 450 ms later, `score`; a zone it holds only `score` (it earns Credits every Resolution). The enemy's callouts make no sound; the classic mode's Prime Zone count does the same with its Resolution count.
- **The countdown of the planning timer** (`countdownTick`, `countdownFinal`): a low "wumpf" with every big number (10, 5, 4, 3, 2) and a longer, lower tone with the last (1).

## The music (`audio/music/`, a rough first version, #451)

One loop of 8 bars (72 BPM, 26.667 s) in four layers (`drone`, `pulse`, `drums`, `refrain`) that start together and loop in sync, AAC (`.m4a`) because an MP3 leaves a gap at the seam of a loop. It plays only during a match; the end screen and the Hero Select have their own music; the **main-menu theme** (`menu.m4a`, a loop of 177 s made from a piece of 3 minutes, `archive/audio-source/music/menu-theme/`) plays on the start screen and starts with the first tap; a tap on Start fades it out and plays the **sound of the Notstrom Intro** (`notstrom-intro.m4a`, 8.9 s), under whose end the Hero Select loop starts.

The game only says which level it wants (`musicLevelFor` in `music.ts`); the music changes on the **next bar line** (`nextBarTime`), the layers fading to the gains of that level (`manifest.json`):

| Level | When | Layers |
|---|---|---|
| 0 | planning | the drone |
| 1 | the last 10 seconds of planning | + the heartbeat pulse |
| 2 | Resolution | + drums |
| 3 | the Prime Zone is contested (any phase) | the finished refrain over the drone, about 5 dB louder than level 2 |

The input is only what the player's own view shows (the timer, the Resolution, the zone as the board draws it), so the music gives away nothing about hidden enemies. **The music plays by default**; `?music=off` in the address turns it off (`?music=on` is still accepted). `?prime=contested` `?prime=contested` forces the contested zone (the same test hook the pill uses). It has its own bus with a limiter, and **steps back (ducking)** under voices (6 dB for as long as they speak) and under hits and shots (3 dB, at most 0.8 s); `MUSIC_DUCK` in `audio-mix.ts`. The loudness of the levels is calibrated with `npm run render-mix -w apps/web`: it plays a scripted match through the real engine into an `OfflineAudioContext` and prints how loud the music is against the voices and effects per phase and frequency band (target: the music 7 to 10 dB under them, steps of 2 to 3 dB between levels). Everything runs through 6 dB of headroom and then a safety limiter (-3 dB): many files are mastered up to 0 dBFS, and the sum of several of them clipped (crackle). Every one-shot also fades in over 3 ms and out over 12 ms, because many files start or end in the middle of a wave (a click). Not built: a volume or mute setting (#446), a finale and an ending, variants and more layers, a longer loop. The layers and where they come from are in `archive/audio-source/music/` (#450).

## Heroes

| Hero | Folder | Voice (ElevenLabs) |
|---|---|---|
| Tilly Turnover | `audio/tilly/` | Bella, Professional Bright Warm |
| Kit Crosshair | `audio/kit/` | Oxley, Evil Character |
| Max Overload | `audio/max/` | Morgan, Deep, Powerful |

Kit and Max use Tilly's `hit-flesh` effect, Max also the Shield sounds (`shield-pop`, `shield-hit`): their manifests point to `tilly/sfx/` with `shared: true`. Max's Select line is an earlier take (4.4 s, over the 4 s limit) and his heavy hit line `hit-heavy-2` is 4.0 s (limit 3.5 s); check both in the game.

## Licence

The voices and effects come from ElevenLabs. Check that the licence of the plan allows use in a game before anything ships.
