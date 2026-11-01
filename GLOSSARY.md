# Primefall

Primefall is a mobile-first, 2.5D tactical 3v3 game where teams plan simultaneously, commit commands, and resolve combat deterministically.

## Language

### Heroes and squads

**Hero**:
A controllable unit with a fixed deck, weapon range, and unique card set.
_Avoid_: Character, unit, champion

**Squad**:
A group of three Heroes fighting together.
_Avoid_: Team, faction

**Exhaustion**:
The state of a Hero whose Deck is empty. An exhausted Hero is removed from the match.
_Avoid_: Death, KO, defeat

### Cards and resources

**Deck**:
The Hero’s finite collection of cards and its long-term life resource.
_Avoid_: Health, HP, life total

**Hand**:
The cards currently available to a Hero during planning.
_Avoid_: Hand cards, card pool

**Draw**:
Taking cards from the Deck into the Hand at the start of a round, up to a maximum hand size of 4.
_Avoid_: Refill, reload

**Discard**:
The pile of used, pitched, blocked, or otherwise spent cards that can later be shuffled into a new Deck cycle.
_Avoid_: Trash, graveyard

**Exile**:
Permanent removal of a card from the current match.
_Avoid_: Banish, remove from game

**Overdrive**:
An alternative, stronger card mode that exiles the card in exchange for a powerful effect, sometimes including a permanent buff that ends when the Hero is exhausted.
_Avoid_: Ultimate, special, finisher

**Pitch**:
Discarding a card to gain 1 Energy.
_Avoid_: Spend, burn, discard for energy

**Energy**:
A round-scoped resource produced by pitching cards; it is spent to play Attack and Utility effects and expires at the end of the round.
_Avoid_: Mana, action points

### Combat and defense

**Shield**:
A temporary defensive value that absorbs damage during the current round and disappears before the next round.
_Avoid_: Armor, barrier, HP

**Block**:
Using any card to create Shield 2 instead of playing its primary effect.
_Avoid_: Defend, guard, parry

**Deck Damage**:
Unblocked damage that removes cards from the top of the target’s Deck. One damage removes one card.
_Avoid_: HP damage, wound

**Cover**:
Terrain that changes incoming attacks and visibility. Full Cover blocks attacks and sight from a firing direction; Half Cover reduces damage by 1 but does not block sight.
_Avoid_: Obstacle, wall, terrain

**Hidden**:
A Hero state granted by certain Assassin Utility cards. A hidden Hero remains concealed for up to two rounds unless it attacks or is revealed.
_Avoid_: Stealth, invisible, camouflage

**Marked**:
A target state that makes an enemy visible to the marking Hero’s squad until the end of the next round.
_Avoid_: Tagged, revealed, spotted

**Slow**:
A status effect that makes the affected Hero’s next Move 2 use a Move 1 use. It lasts until the end of the next Resolution.
_Avoid_: Hinder, debuff

**Knockback**:
A forced movement effect that moves the target directly away from the attacker. The target stops at a wall, Full Cover, or another Hero.
_Avoid_: Push, displacement

**Long Shot**:
An Assassin Attack with Range 7. Its Overdrive grants bonus damage when the target is at Range 6 or 7.
_Avoid_: Sniper shot, ranged finisher

### Battlefield and objectives

**Grid**:
The 20 by 12 tile-based battlefield used for movement, range, line of sight, and cover.
_Avoid_: Map, board, arena

**Line of Sight**:
The rule determining whether a Hero can see and target another Hero. Attacks require current Line of Sight.
_Avoid_: Vision, LOS

**Visible**:
An enemy Hero currently within Line of Sight.
_Avoid_: Spotted, revealed

**Ghost**:
The last known position of an enemy Hero that is no longer Visible.
_Avoid_: Memory, echo

**Unknown**:
An enemy Hero with neither current Line of Sight nor a known last position.
_Avoid_: Hidden enemy, unseen

**Tick**:
One simultaneous Resolution step in which each non-exhausted Hero processes the next action in its queue.
_Avoid_: Turn, phase

**Prime Zone**:
The central 3 by 3 objective area. A squad wins by controlling it during three consecutive Resolutions.
_Avoid_: Point, base, capture zone

**Overwatch Nest**:
The single Full Cover position with a sightline into the Prime Zone. It is the Assassin’s secondary objective.
_Avoid_: Sniper nest, camp spot

**Reactor Deck**:
The first Primefall map: a damaged cargo ship whose central reactor is the Prime Zone.
_Avoid_: Level, stage

**Resolution**:
The deterministic simulation of all committed commands after both squads have planned.
_Avoid_: Turn, combat phase, action phase
