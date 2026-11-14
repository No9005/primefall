# World, tone and Heroes: working notes

**Status: ideas from a chat session with the product owner. Nothing here is decided, built or part of a spec.** The game does not use these notes yet. They collect the direction so that the next decisions (names, maps, missions, the Prime Zone) start from the same picture. Decisions belong in an ADR or `docs/design/decisions.md` once they are made.

## Tone

A 1980s and 1990s science-fiction universe that does not take itself fully seriously, in the way of *Starship Troopers*, *RoboCop* or the game *Broforce*. Cities are lit by neon and feel like *RoboCop*. Ships are worn industrial haulers like the Nostromo of *Alien*. These films are moods to draw from; no names, logos or characters are taken over.

The world is **mysterious and grim**: alien artefacts and fantastic places, all with a science-fiction touch.

**Two layers, kept apart:**

| Layer | Tone | Where it lives |
|---|---|---|
| The world and the pictures | grim, mysterious, quiet | maps, tiles, lighting, artefacts, what nobody explains |
| The voice | satirical | Hero names, the clients (megacorps, military), advertising, contract texts |

The satire explains who pays. The mystery stays with the artefacts and the places: the Squads take the job, nobody tells them what the thing is. If the pictures turn funny as well, the mystery is lost.

The game is mobile and its matches are short, so little text is read. The world lives in names, map names, one line per mission and the pictures, not in paragraphs.

## Frame

In a match, two Squads are hired by **different megacorps and military branches**. Each side is a contractor on a **search and rescue or salvage mission**. There are no good and bad sides: both Squads do the same job for different clients. That is why the rules are symmetric.

The maps are the places such contracts lead to. They already exist as looks, and the frame explains why they differ:

| Place | Look | Status |
|---|---|---|
| Stricken hauler (Reactor Deck) | worn industrial, red lamps, hazard bands | built (tileset "Notstrom", `docs/design/reactor-deck/`) |
| Snow field under polar night | expedition barricades, orange beacons, glowing artefacts, half-buried ring gate, crashed rescue capsule | assets only (tileset "Polarnacht", `docs/design/ice-field/`), no map |
| Neon city | rain, signs, corporate towers in the manner of *RoboCop* | idea, no assets |

Salvage and rescue match the mission ideas the snow field already carries (fetch and bring a flight recorder, escort a rescue capsule), and the classic and Attack and Defend modes become contracts with a client and a one-line advertising text.

## Heroes

A Hero gets a proper name besides its class. The glossary has no term for a character's proper name yet (see *Open questions*). The class stays as it is; the Assassin is not renamed.

Three sources of people: the military, craft, the underworld.

| Class | Name | Background |
|---|---|---|
| Bruiser | **Max Power** (nickname "Strong") | Loadmaster in the military. He moved cargo, equipment and comrades, takes orders and himself too seriously. That is where the satire sits. |
| Controller | **Tilly Turnover** | Tinkerer and mech mechanic. Her third arm is her own build, which also explains the Scout Drone, Barricade and Placed Cover as scrap-built gear. She had no earlier client: she is hired together with the other two. "Turnover" can mean turning old things into new. |
| Assassin | **Kit Crosshair** | Former syndicate assassin. "Crosshair" is the cover name from the syndicate days. Why Kit works for a client now (debt, an amnesty, an open bill) stays open on purpose. The name is not tied to a gender. |

Notes:

- "Max Power" is also the alias Homer Simpson takes in *Homer to the Max*. Many will recognise it. If that is not wanted, "Max Strong" is the plain version without the reference and "Max Payload" ties to the loadmaster. Open.
- Whether the same three Heroes stand on both sides in a match is open. The names belong to the three classes, so the two Squads' Heroes are told apart by the Squad ring and colour. Another option is that the opposing Squad gets its own names later.
- Can a Squad have two Heroes of the same class? ADR 0025 mentions a Squad of three Assassins. If yes, two "Max Power" would stand in one Squad. A change of that rule is not part of this.
- Where the name is shown is undecided. Suggestions so far: the Hero Select screen with the class as a smaller second line; the planning HUD keeps the class; the deck view shows the name as the owner of the cards; the Resolution log and match end use the name in text but not over the Hero on the board. A new glossary term (for example "Hero Name") would be needed.
- One sentence of background per Hero is probably enough on a phone screen.

## Open questions

1. **The Prime Zone.** Today it is the central 5 by 5 zone with a core in the middle. In this world it could be the artefact or the find the clients want. This needs its own discussion: what is it, why do both clients want it, and does it change per place (a ring gate in the snow, a reactor core on the hauler, something else in the city)?
2. **The clients.** Which megacorps and military branches exist, and do they have names, logos and advertising voices? Do the two Squads of a match always have different clients?
3. **Missions as contracts.** How the classic mode, Attack and Defend, fetch and bring and escort read as contracts, and how much text each gets.
4. **The names and where they show.** The decisions listed under *Heroes*, then a ticket for the display.
5. **The neon city** as a third place: is it needed, and which mission type fits it?
6. **Opposing Squad names** and whether the Heroes may differ in colour from the Squad colours (`docs/design/decisions.md`).
7. **Glossary.** Terms the world would add: Hero Name, client, contract. Not added to `GLOSSARY.md` yet.
