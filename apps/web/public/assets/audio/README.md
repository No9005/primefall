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
- At most two Heroes speak at once within 6 tiles of each other. A third waits (is dropped) unless it is more important than the quietest speaker, which then fades out.
- A Pitch speaks only some of the time (`chance`), and a random variant when it does.

**Effect rules** (`DEFAULT_SFX_RULES`): at most 10 at once (the least important makes room for a more important one), the same effect never twice within 70 ms (six Heroes taking the same step), and a sound is quieter the further it is from the player's Hero (full within 4 tiles, down to 35 % at 14).

With reduced motion the clips do not play, so all sounds of a frame start with the frame.

The values are first proposals; tune them by playing.

## Heroes

| Hero | Folder | Voice (ElevenLabs) |
|---|---|---|
| Tilly Turnover | `audio/tilly/` | Bella, Professional Bright Warm |
| Kit Crosshair | `audio/kit/` | Oxley, Evil Character |
| Max Overload | `audio/max/` | Morgan, Deep, Powerful |

Kit and Max use Tilly's `hit-flesh` effect, Max also the Shield sounds (`shield-pop`, `shield-hit`): their manifests point to `tilly/sfx/` with `shared: true`. Max's Select line is an earlier take (4.4 s, over the 4 s limit) and his heavy hit line `hit-heavy-2` is 4.0 s (limit 3.5 s); check both in the game.

## Licence

The voices and effects come from ElevenLabs. Check that the licence of the plan allows use in a game before anything ships.
