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
The state of a Hero that has no card left in its Deck and its Discard at the end of a Resolution (cards in the Hand do not count). An exhausted Hero is out of the match: it acts no more, is no obstacle to Moves, and its tile becomes Half Cover until that Cover is destroyed.
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
The pile of used, pitched, blocked, or otherwise spent cards. When the Deck is empty and a card must be taken from it, or at the end of a Resolution, the Discard is shuffled into the Deck (never the Exile).
_Avoid_: Trash, graveyard

**Exile**:
Permanent removal of a card from the current match.
_Avoid_: Banish, remove from game

**Overdrive**:
An alternative, stronger card mode that exiles the card and replaces its standard effect with a powerful one, sometimes including a permanent buff that ends when the Hero is exhausted.
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
Unblocked damage that removes cards from the top of the target’s Deck. One damage removes one card into the Exile; if the Deck runs out on the way, the Discard is shuffled into it and the damage goes on.
_Avoid_: HP damage, wound

**Cover**:
Terrain a Hero can stand on that changes incoming attacks and visibility. Against attackers at Range 2 or more, Full Cover blocks the attack and Half Cover reduces damage by 1. Attackers at Range 1 ignore it.
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
An Assassin Attack with Range 7. Its Overdrive deals bonus damage when the target is at Range 6 or 7.
_Avoid_: Sniper shot, ranged finisher

### Battlefield and objectives

**Grid**:
The tile-based battlefield (31 by 17 on the Reactor Deck) used for movement, range, line of sight, and cover.
_Avoid_: Map, board, arena

**Line of Sight**:
The rule determining whether a Hero can see and target another Hero. Attacks require current Line of Sight in the Tick they fire.
_Avoid_: Vision, LOS

**Declared Target**:
A currently Visible enemy Hero that an Attack names in planning. It is checked in the Tick the Attack fires, and the Attack misses if the target is not allowed then (not visible, Exhausted, out of Range, without Line of Sight, or behind Full Cover).
_Avoid_: Locked target, auto-aim, lock-on

**Miss**:
An Attack that fails its check at fire time and does nothing. The Resolution log names the reason.
_Avoid_: Dodge, whiff

**Visible**:
An enemy Hero currently within Line of Sight and within the squad's sight range (7 tiles; 9 for a Hidden Assassin). The squad can see its current position, Shield, and the number of cards in its Deck, Discard, and Exile.
_Avoid_: Spotted, revealed

**Ghost**:
The last known position of an enemy Hero that is no longer Visible, together with the Deck, Discard, and Exile counts last seen.
_Avoid_: Memory, echo

**Unknown**:
An enemy Hero with neither current Line of Sight nor a known last position. Nothing about its status is known.
_Avoid_: Hidden enemy, unseen

**Range**:
Distance in tiles, counted with diagonal neighbours at distance 1. Used for weapon range, sight range, and adjacency.
_Avoid_: Distance, reach

**Queue**:
The ordered actions a Hero has planned for one Round, at most four. One action is resolved per Tick.
_Avoid_: Command list, turn order

**Wait**:
A queue action in which a Hero does nothing for one Tick; it needs no card and takes a slot of the Queue.
_Avoid_: Skip, pass

**Tick**:
One simultaneous Resolution step in which each non-exhausted Hero processes the next action in its queue.
_Avoid_: Turn, phase

**Prime Zone**:
The central 3 by 3 objective area. A squad wins by controlling it during three consecutive Resolutions.
_Avoid_: Point, base, capture zone

**Round Limit**:
The maximum of 30 Rounds per match. If no Squad has won by then, the Squad with more cards in its Heroes' Decks wins; equal totals are a draw.
_Avoid_: Timeout, turn cap

**Overwatch Nest**:
The single Full Cover position with a sightline into the Prime Zone. It is the Assassin’s secondary objective.
_Avoid_: Sniper nest, camp spot

**Reactor Deck**:
The first Primefall map: a damaged cargo ship whose central reactor is the Prime Zone.
_Avoid_: Level, stage

**Resolution**:
The deterministic simulation of all committed commands after both squads have planned.
_Avoid_: Turn, combat phase, action phase
