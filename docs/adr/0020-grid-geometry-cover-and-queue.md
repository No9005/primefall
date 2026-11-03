# Grid Geometry, Cover and Action Queue

All distances use Chebyshev distance: a neighbouring tile, including diagonally, is Range 1. Range, sight range, "adjacent" (the 8 surrounding tiles) and area effects such as the 3 by 3 Scout Drone all follow it. Movement is 8-directional: Move 2 is two single steps. A step into a tile with a Wall or another Hero fails and the Hero stops; a diagonal step fails if either orthogonal neighbour is a Wall, so Heroes cannot cut wall corners.

Cover tiles can be occupied. A Hero on a Cover tile is protected against attackers at Range 2 or more: Half Cover reduces the damage by 1, Full Cover blocks the attack. An attacker at Range 1 ignores Cover. Cover has no facing. Walls and Full Cover tiles block Lines of Sight that pass through them to another tile; Half Cover does not. A Hero on a Full Cover tile can therefore be neither attacked nor seen from Range 2 or more, except by effects that explicitly ignore this (Ghost Shot). Piercing Round ignores Half Cover only. Knockback stops at a Wall, another Hero or a Full Cover tile.

Pitch is a planning step, not a queued action. The Cards pitched in a Round form an Energy pool, and `validatePlan` rejects a Hero's queue whose Energy costs exceed the pool, so an action never fails at execution because of Energy.

A Hero's action queue has at most 4 actions (the maximum Hand size; a Card fulfils one role per Round). Forward Deploy gives an allied Hero one extra Move 2 action at the end of its queue (so up to 5 actions are possible). Reposition turns one Move action into Move 3. A Resolution therefore has at most 5 Ticks. A Wait is a queue action that needs no card and no Energy but takes one of these slots, so a Hero can time its actions without wasting a card.

## Considered Options

Manhattan distance makes diagonal movement costly and ranges feel small. Per-tile Cover facing is more precise but has to be drawn into every map and is hard to read on a phone. Queueing Pitch would let Energy shortages fail at execution and complicate planning.
