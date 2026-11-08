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

**Player Hero**:
The Hero the player controls in a match. The other Heroes of the player's Squad are planned by the AI.
_Avoid_: Avatar, main

**Hero Select**:
The screen where the player chooses the Player Hero before a match.
_Avoid_: Character select

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
Using any card to create Shield 2 instead of playing its primary effect. Only in Attack and Defend; the classic mode has no Block, its Shield comes from Shield cards.
_Avoid_: Defend, guard, parry

**Crossfire**:
A hit on a Hero by a different attacker in the same Tick or the Tick directly after a hit by another attacker on that Hero; it deals 1 extra damage.
_Avoid_: Flanking bonus, focus bonus

**Piercing Damage**:
Damage that does not use up Shield; it goes straight into Deck Damage. Cover still applies to it.
_Avoid_: True damage, armor piercing

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

**Pull**:
A forced movement effect that moves the target directly toward the caster. The target stops at a wall, Full Cover, or another Hero. The counterpart of Knockback.
_Avoid_: Hook, drag, grab

**Minimum Range**:
The shortest distance at which an Attack can hit; closer targets cannot be hit by it. Some Assassin Attacks have a Minimum Range of 2 or 3.
_Avoid_: Dead zone, blind range

**Placed Cover**:
Cover that a Hero put on a tile with a card. It stays until it is destroyed; a Squad has at most three Placed Cover tiles at once and the oldest disappears when a fourth is placed.
_Avoid_: Temporary Cover, wall, barricade (a card name)

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
The central 3 by 3 zone, worth 2 Victory Points per Resolution in the classic mode. It is inactive (scores nothing) until Round 4. In Attack and Defend the Attacker wins by controlling it during three consecutive Resolutions.
_Avoid_: Point, base, capture zone

**Outpost**:
One of two side zones of the classic mode, worth 1 Victory Point per Resolution to the Squad that controls it (ADR 0024). Active from Round 1.
_Avoid_: Capture point, flag, side zone

**Control**:
A Squad controls a zone when it has more non-exhausted Heroes in it than the other Squad (classic mode, ADR 0024).
_Avoid_: Capture, own, claim

**Contested**:
A zone with the same number of non-exhausted Heroes of both Squads in it, and at least one each. Nobody controls it and it scores for nobody (classic mode, ADR 0024).
_Avoid_: Neutral, locked, disputed

**Victory Points**:
The score of the classic mode (ADR 0024): each Resolution a Squad earns the value of every zone it controls. The first Squad to reach the threshold wins; after the Round Limit the higher score wins.
_Avoid_: Score points, kills, health

**Round Limit**:
The maximum of Rounds per match in the classic mode (15). When it is played, the Squad with more Victory Points wins; equal points go to the Squad with more cards not in the Exile (Deck, Discard and Hand of all its Heroes); if still equal the match is a draw. Attack and Defend has its own Round limit.
_Avoid_: Timeout, turn cap

**Attacker**:
In Attack and Defend mode, the Squad that starts on its Spawn tiles and wins by controlling the Prime Zone during three consecutive Resolutions or by Exhausting all Heroes of the Defender. It takes control of the Prime Zone when at least one of its Heroes stands in it and it has at least as many Heroes in it as the Defender (a tie goes to the Attacker). In the classic mode the Squads have no roles.
_Avoid_: Aggressor, invader

**Defender**:
In Attack and Defend mode, the Squad whose Heroes start on the Prime Zone tiles of the inner column next to its side. It never wins by holding the Zone; it wins with Defence Held.
_Avoid_: Guard, holder

**Defence Held**:
The end reason of an Attack and Defend match in which the Round limit of the mode (default 12) was played without an Attacker win. The Defender wins.
_Avoid_: Timeout, draw

**AI Style**:
A set of weights chosen per match from the match seed (for example Aggressive, Defensive, Flanker) that shifts how the AI scores its options.

**Overwatch Nest**:
The single Full Cover position with a sightline into the Prime Zone. **Removed for now** (ADR 0024): no map places it at present.
_Avoid_: Sniper nest, camp spot

**Reactor Deck**:
The first Primefall map: a damaged cargo ship whose central reactor is the Prime Zone.
_Avoid_: Level, stage

**Resolution**:
The deterministic simulation of all committed commands after both squads have planned.
_Avoid_: Turn, combat phase, action phase
