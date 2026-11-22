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

## The map and the cards (`audio/map/`)

Not tied to a Hero; `map/manifest.json` has its own shape (`ambience` and `ui`).

- **Ambience of Notstrom:** two loops that run for the whole match, a huge slow ventilation fan (`loops/bed.wav`) and the hum of the plasma core (`loops/core.wav`, louder the nearer the player's Hero is to the Prime Zone), and every 10 to 25 s a quiet sound at random (ventilation burst, hull creak, sparks, steam, debris) with a random left or right placement. The loops are **WAV**: an MP3 puts a short silence at its end, which is a gap at the seam of a loop. They fade in and out over 2 s. The ambience is the least important sound (`Priority.Background`): it never takes the place of a voice or an effect.
- **The cards:** a card is drawn (`cardDraw`, one per card as it leaves the Deck pile, none with reduced motion), a card goes into the Queue (`cardPlayed`), a card comes back (`cardBack`, also when a Pitch is undone), Energy is gained (`energyUp`, a Pitch) and the shuffle (the same riffle twice, on the two riffles of the animation in `deck-shuffle.ts`; none with reduced motion). The sounds follow the counts of the plan, so a tap, a drop and an undo sound the same, and a switch to another Hero or a new Round makes none.
- A card burns into the Exile (`cardBurn`, Deck Damage): once for the whole hit however many cards burn, as the glowing edge of the glimmer appears (`burnSoundMs()` in `deck-burn.ts`); none with reduced motion, and none when the player is looking at another Hero's pile.
- Spending Energy has no sound of its own.
- **The laser barrier of the Prime Zone** (`loops/laser-hum.wav`): a low hum like a laser sword while the red laser walls stand (the Prime Zone is inactive), louder the nearer the player's Hero is to the Prime Zone, with fades. When the walls flicker out, `laserOff` (flicker and power-down) plays once.
- **A zone taken and Credits** (`zoneTaken`, `score`, a cash register "ka-ching"): with the callout of the player's own Squad. A zone that changes hands to the player's Squad sounds `zoneTaken` and, 450 ms later, `score`; a zone it holds only `score` (it earns Credits every Resolution). The enemy's callouts make no sound; the classic mode's Prime Zone count does the same with its Resolution count.
- **The countdown of the planning timer** (`countdownTick`, `countdownFinal`): a low "wumpf" with every big number (10, 5, 4, 3, 2) and a longer, lower tone with the last (1).

## The music (`audio/music/`, a rough first version, #451)

One loop of 8 bars (72 BPM, 26.667 s) in four layers (`drone`, `pulse`, `drums`, `refrain`) that start together and loop in sync, AAC (`.m4a`) because an MP3 leaves a gap at the seam of a loop. It plays only during a match; the end screen and the Hero Select have their own music; the **main-menu theme** (`menu.m4a`, a loop of 177 s made from a piece of 3 minutes, `audio-source/music/menu-theme/`) plays on the start screen and starts with the first tap; a tap on Start fades it out and plays the **sound of the Notstrom Intro** (`notstrom-intro.m4a`, 8.9 s), under whose end the Hero Select loop starts.

The game only says which level it wants (`musicLevelFor` in `music.ts`); the music changes on the **next bar line** (`nextBarTime`), the layers fading to the gains of that level (`manifest.json`):

| Level | When | Layers |
|---|---|---|
| 0 | planning | the drone |
| 1 | the last 10 seconds of planning | + the heartbeat pulse |
| 2 | Resolution | + drums |
| 3 | the Prime Zone is contested (any phase) | the finished refrain over the drone, about 5 dB louder than level 2 |

The input is only what the player's own view shows (the timer, the Resolution, the zone as the board draws it), so the music gives away nothing about hidden enemies. **The music plays by default**; `?music=off` in the address turns it off (`?music=on` is still accepted). `?prime=contested` `?prime=contested` forces the contested zone (the same test hook the pill uses). It has its own bus with a limiter, and **steps back (ducking)** under voices (6 dB for as long as they speak) and under hits and shots (3 dB, at most 0.8 s); `MUSIC_DUCK` in `audio-mix.ts`. The loudness of the levels is calibrated with `npm run render-mix -w apps/web`: it plays a scripted match through the real engine into an `OfflineAudioContext` and prints how loud the music is against the voices and effects per phase and frequency band (target: the music 7 to 10 dB under them, steps of 2 to 3 dB between levels). Everything runs through 6 dB of headroom and then a safety limiter (-3 dB): many files are mastered up to 0 dBFS, and the sum of several of them clipped (crackle). Every one-shot also fades in over 3 ms and out over 12 ms, because many files start or end in the middle of a wave (a click). Not built: a volume or mute setting (#446), a finale and an ending, variants and more layers, a longer loop. The layers and where they come from are in `audio-source/music/` (#450).

## Heroes

| Hero | Folder | Voice (ElevenLabs) |
|---|---|---|
| Tilly Turnover | `audio/tilly/` | Bella, Professional Bright Warm |
| Kit Crosshair | `audio/kit/` | Oxley, Evil Character |
| Max Overload | `audio/max/` | Morgan, Deep, Powerful |

Kit and Max use Tilly's `hit-flesh` effect, Max also the Shield sounds (`shield-pop`, `shield-hit`): their manifests point to `tilly/sfx/` with `shared: true`. Max's Select line is an earlier take (4.4 s, over the 4 s limit) and his heavy hit line `hit-heavy-2` is 4.0 s (limit 3.5 s); check both in the game.

## Licence

The voices and effects come from ElevenLabs. Check that the licence of the plan allows use in a game before anything ships.
