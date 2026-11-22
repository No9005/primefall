# World, style and sound: the entry page

Start here before making anything the player sees or hears (a picture, an animation, a sound, a name, a line of text). This page is the short version and the map; the detail is in the linked files. **Stay consistent with it.** If something you want to make contradicts it, say so and ask the owner; do not decide it silently. A new lasting decision goes into `docs/design/decisions.md` (or an ADR), not only into a chat.

## The world in six lines

- A science-fiction universe of the 1980s and 1990s that does not take itself fully seriously (in the way of *Starship Troopers*, *RoboCop*, *Broforce*). Moods to draw from; no names, logos or characters are taken over.
- Alien artefacts ("Prime") fell on the planets ("Primefall"). Mega corporations and military branches hire mercenary Squads to secure them. Both Squads of a match do the same job for different clients, so there are no good and bad sides, and the rules are symmetric.
- **Two layers, kept apart.** The world and the pictures are grim, mysterious and quiet (maps, lighting, artefacts, what nobody explains). The voice is satirical (Hero names, clients, advertising, contract texts). If the pictures turn funny too, the mystery is lost.
- Little text is read on a phone: the world lives in names, map names, one line per mission and the pictures.
- Maps: the **Notstrom Map** (a stricken industrial hauler, red lamps, hazard bands; built). More are planned and have their own names (snow field "Polarnacht", a neon city, a jungle, an ice map). Do not tie anything global to the look or music of one map.
- Heroes: **Max Overload** (Bruiser), **Tilly Turnover** (Controller), **Kit Crosshair** (Assassin). Names, backgrounds and quotes: `docs/design/world/README.md`.

## Where things are

| Topic | File |
|---|---|
| Tone, frame, Heroes, open questions | `docs/design/world/README.md`, `missions.md` |
| Product pitch and positioning | `docs/PITCH.md` |
| Terms (use them exactly) | `GLOSSARY.md` |
| Owner's design decisions (do not contradict) | `docs/design/decisions.md` |
| The three Heroes: designs, clips, sheet format | `docs/design/heroes/README.md` |
| Animation reference (rig, timing, effects) | `docs/design/animation/README.md` |
| The Notstrom Map look | `docs/design/notstrom-map/` |
| Title screen, Notstrom Intro, Hero Select (hangar) | `docs/design/title/`, `docs/design/notstrom-intro/`, `docs/design/hero-select/` |
| Where scenes and UI are drawn | `docs/adr/0026-scenes-in-pixijs-ui-in-html.md` |
| Music, how it was made, what was tried | `archive/audio-source/music/README.md` |
| Voice and sound effects | `archive/audio-source/voice-sfx/` |

## Look

- **Pixel art**, stylized 2.5D, orthographic. A Hero's frame is 136 x 104 px, the centre of the feet at (58, 86), 20 frames per second; Heroes face right and are mirrored for the other direction. Scale by whole numbers with nearest-neighbour scaling, or the pixels blur.
- The tile and the Squad ring are not part of Hero sprites. Squad colours are fixed in `docs/design/decisions.md`.
- Film-like scenes (Notstrom Intro) use a palette per scene and no dithering; a global palette lost the yellow and the red.
- UI: at least 12 px text, 4.5:1 contrast, touch targets 40 x 40 px (decisions file).
- Check a visual against the reference board or the files above, element by element, before calling it done.

## Sound

- Dark sci-fi, 1970s and 1980s analog synthesizers, a driving bass like a heartbeat, and **deep, throaty male bass choir (monk chant) in every piece**: it carries the threat and the mystery. The key so far is D minor.
- Music must **loop** and must not lean on the Notstrom Map's own piece, because more maps will come.
- A piece needs a **hook** that stays in the head, not only slow drones.
- How a piece is made and archived, and the rules for generation: `archive/audio-source/music/README.md` and `docs/agents/working-agreements.md`.
