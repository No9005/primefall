# Priority Interleaved Resolution

Primefall resolves each round through priority-interleaved action queues. During planning, each Hero receives an ordered queue of actions; during Resolution, the engine processes one action from every non-exhausted Hero’s queue per Tick.

For example, if one Hero plans Move, Attack, Block and its opponent plans Attack, Move, Block, Tick 1 resolves the first Hero’s Move and the opponent’s Attack; Tick 2 resolves the first Hero’s Attack and the opponent’s Move; Tick 3 resolves both Blocks.

Actions are validated at execution time. An action that has become illegal—because its target is exhausted, no longer visible, or otherwise unavailable—fails without affecting later actions. Simultaneous attacks both resolve and can both cause damage. If two Heroes attempt to move into the same free tile in the same Tick, neither moves.

A Block takes effect immediately in its Tick and can absorb damage from an attack resolved in that same Tick. This makes action order a core tactical decision: moving into cover before attacking, attacking before an enemy repositions, or blocking before an expected shot all produce different outcomes.
