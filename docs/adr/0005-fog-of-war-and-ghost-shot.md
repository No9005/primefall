# Fog of War and Ghost Shot

Primefall uses a squad-shared, enemy-only Fog of War with three visibility states: Visible, Ghost, and Hidden/Unknown. Terrain remains always visible; enemies are Visible only with current Line of Sight, appear as Ghosts at their last known position after losing sight, and are otherwise Hidden/Unknown.

All squad members share vision. The Assassin receives +2 sight range while Hidden, can mark targets for the squad until the end of the next round, and has one Attack Overdrive, Ghost Shot, which may target a Ghost’s last known position. Ghost Shot does not guarantee a hit: it resolves only if an enemy occupies the targeted tile during resolution. Full Cover still blocks the shot and Half Cover reduces its damage by 1.

Normal attacks still require current Line of Sight. This preserves information as a valuable resource while giving the Assassin a high-risk tool to punish predictable movement.
