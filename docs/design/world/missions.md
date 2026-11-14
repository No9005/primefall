# Mission types: working notes

**Status: ideas from a chat session with the product owner. Only Hold zones exists in the game; nothing else here is decided, specified or built.** See `README.md` in this folder for the world and tone. Rules, names and numbers below are proposals to be tested; the terms are not in `GLOSSARY.md` yet.

## Where they come from

The design canvas page "Map layouts and missions" derived eight mission types from Warhammer 40k and Infinity (Hold zones, Quadrant control, Frontline, Sabotage, Carry and extract, Consoles, Marked Hero, Annihilation). Only the layouts were chosen (Crossroads, now on `main`), not the types. This page keeps the three that fit Primefall.

A Squad has three Heroes (Warhammer skirmish and Infinity have roughly six to ten figures per side), so missions with many objectives fit badly: a Hero cannot hold two places. Missions with few, clear objectives fit better.

## The principle: two goals that split the Squad

Every mission has at least two goals that the three Heroes cannot all pursue at the same time, so the plan decides how to split them (1 + 2 or 1 + 1 + 1), as in the split objectives of MOBAs such as Vainglory.

- The Fog of War makes a split a bluff: the opponent sees where the Heroes go, not why.
- The Deck as life slows splitting down: a Hero sent alone is a risk.
- The number of goals and their points must be measured with the balance harness, not guessed. With too little pressure all three Heroes run to one goal; with too much, each acts alone and the match falls apart.

## 1. Hold zones (exists)

Zones are held for Victory Points per Resolution (ADR 0024). It is the classic mode: the Prime Zone (2 points per Resolution, active from Round 4) and an Outpost north and south of it (1 point each, active from Round 1). The Prime Zone together with the Outposts is already a split of the Squad. Attack and Defend (ADR 0022) is the same map with roles: the Attacker wins by controlling the Prime Zone three Resolutions in a row or by Exhausting all Defending Heroes.

### As a contract in the world (proposal)

- **The Heroes are mercenaries.** They are hired before the match to secure the zone, for the extraction team or for the research team.
- **The two Squads have different clients** (megacorps or military). Both clients want the site, so both send a team.
- **Credits instead of Victory Points.** A Squad earns Credits for every Resolution in which it holds a zone; the Squad with the most Credits at the end wins. This is a change of the name only, the rules stay: the game currency is the score, there is no economy (nothing is bought or spent). The glossary term "Victory Points" and ADR 0024 would be renamed in a ticket; code and tests keep their names until then. "Credits" is the product owner's choice; it is not tied to a real currency.
- **Why the Prime Zone is active only from Round 4:** on the stricken hauler the reactor sits behind blast shutters that power down after four Rounds. Until then only the Outposts pay. Each place needs its own reason for the delay, or none (see the open questions).

### Names of the zones (proposal)

| In the game | In the world |
|---|---|
| Prime Zone | **the Asset**, the contract word for the find (the reactor core on the hauler, a ring gate in the snow); the zone of the highest pay |
| Outpost (north, south) | **Staging Post**: where the client's team sets up equipment and where the extraction is staged; a low but early pay |
| Spawn | **Drop point**: where a Squad is landed |

Why there are three zones: the Asset cannot be secured alone, the client's team needs the two Staging Posts (the two ways into the site, north and south) first. They pay from the start, the Asset pays more once it is reachable, and together they force the Squad to split (see the principle above). Open: whether this reason is enough or each place gets its own.

## 2. Carry and extract (idea)

One Hero carries an object to an escape point (the product owner's word: "escape ledge"; the name is open) and evacuates with it. **The escape point opens only while a Squad holds a zone.**

Two goals follow: the carrier moves the object, and someone holds the zone that opens the way out. The opponent chooses between hunting the carrier and taking the zone. It fits a salvage job (the flight recorder and the rescue capsule of the snow field, `docs/design/ice-field/`).

Open: who holds the object at the start or where it lies; what happens to it when the carrier is Exhausted (dropped on the tile); whether the zone is neutral or owned; whether the escape point stays open after the holder leaves; the term for the object ("objective marker" is only a working name).

## 3. Sabotage (idea)

**One target per opponent.** Each Squad has a target of its own to protect and a target of the other Squad to destroy. A Squad cannot send everyone to the enemy target and leave its own open.

Idea for tension: a **neutral zone** gives a power-up that lets a Squad destroy the enemy target better (faster or with more damage) once it holds the zone. The neutral zone is the second goal that pulls Heroes away from the targets.

Open: what a target is and how it is destroyed (hit points, a number of Resolutions of control, a card effect); what the power-up does exactly and how long it lasts; whether Sabotage needs a Round limit (a Squad can avoid the fight).

## Left out for now

- **Quadrant control and Consoles:** too many goals for three Heroes.
- **Frontline:** too close to Hold zones.
- **Marked Hero:** with three Heroes the target is clear early and the match tips too easily.
- **Annihilation:** already part of Attack and Defend as a second way to win; as a type of its own it has the problem of a Squad avoiding the fight (it needs a Round limit).

## Next

The Prime Zone is explained through the missions (see the open question in `README.md`). Next step: Hold zones in detail, then Carry and extract.
