# Game audio

Final sounds of the Heroes, ready for the web app. One folder per Hero: `audio/<hero>/voice/`, `audio/<hero>/sfx/` and a `manifest.json`. Nothing here is played yet; the game has no audio code (issue #422 asks whether sound is in scope).

## Files

- Mono MP3, 44.1 kHz: voice at 80 kbit/s, effects at 96 kbit/s. MP3 plays in every browser, also on iOS.
- Voice is levelled to about −16 LUFS, effects to about −14 LUFS (leather steps and the cover thump are quieter on purpose). Voice has a little EQ and compression, no reverb.
- Short lines start on the sound; the silence at the head and tail is cut. A line that was too long was cut by hand (see the notes in the manifest).

## The manifest

`manifest.json` has two parts:

- `assets`: every file with its id, the spoken text or what the sound is, and its length.
- `cues`: when to play what. `on` is the game event (`cardPlayed`, `attackHit`, `moveEndedOnCover`, `exhausted`, `matchEnd`, ...), `clip` the Hero clip, `atMs` the time in ms from the start of that clip (negative: before it). `mode: "inTurn"` means the variants play one after the other, never the same twice in a row. `guess: true` marks times the code does not give exactly.

The cues are proposals made in the review of the animations with the product owner, not a decision about the sound system.

## Playing it with PixiJS

PixiJS has no audio engine of its own. Use the Web Audio API of the browser (no new dependency): decode the files once, start every cue at `clipStart + atMs`, keep three buses (voice, effects, music) so each can be turned down or muted. A browser only plays sound after a touch of the player, so start the audio context on the first tap.

Rules to decide in #422 before building:

- A Squad may only hear what it sees. The sound of a Hidden or unseen enemy would give away its position. Play a cue only for events the Squad's view contains.
- Limit the voices that run at once (one or two), give each Hero a pause between two lines, and let a hit win against a card line.
- Duck the music a few dB while a voice runs.
- A mute switch.

## Heroes

| Hero | Folder | Voice (ElevenLabs) |
|---|---|---|
| Tilly Turnover | `audio/tilly/` | Bella, Professional Bright Warm |
| Kit Crosshair | `audio/kit/` | Oxley, Evil Character |
| Max Overload | `audio/max/` | Morgan, Deep, Powerful |

Kit and Max use Tilly's `hit-flesh` effect, Max also the Shield sounds (`shield-pop`, `shield-hit`): their manifests point to `tilly/sfx/` with `shared: true`. Max's Select line is an earlier take (4.4 s, over the 4 s limit) and his heavy hit line `hit-heavy-2` is 4.0 s (limit 3.5 s); check both in the game.

## Licence

The voices and effects come from ElevenLabs. Check that the licence of the plan allows use in a game before anything ships.
