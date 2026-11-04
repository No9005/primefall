# Fog of War and Ghost Shot

Primefall uses a squad-shared, enemy-only Fog of War with three visibility states: Visible, Ghost, and Hidden/Unknown. Terrain remains always visible; enemies are Visible only with current Line of Sight, appear as Ghosts at their last known position after losing sight, and are otherwise Hidden/Unknown.

All squad members share vision. Every Hero has a base sight range of 7 tiles; an enemy is Visible only if it is within sight range and has Line of Sight. The Assassin receives +2 sight range (9 tiles) while Hidden, can mark targets for the squad until the end of the next round, and has one Attack Overdrive, Ghost Shot, which may target a Ghost’s last known position. Ghost Shot does not guarantee a hit: it resolves only if an enemy occupies the targeted tile during resolution. Full Cover still blocks the shot and Half Cover reduces its damage by 1.

Normal attacks still require current Line of Sight, checked when the Attack fires; a normal Attack can only name a Visible enemy and only hits if the target is still visible then. Ghost Shot remains the way to hit a Ghost without sight. This preserves information as a valuable resource while giving the Assassin a high-risk tool to punish predictable movement.

The base sight range of 7 matches the Assassin's Long Shot range and keeps both Spawn areas (8 tiles from the nearest Prime Zone tile) out of sight of the Prime Zone.

## Status

accepted. Revised: Ghost Shot is no longer the Assassin's only Overdrive. Its three Overdrive modes are Long Shot (both cards), Ghost Shot and Mark Target (a Utility card), on four Overdrive cards in total (see `docs/specs/mvp-card-set.md` and ADR 0003).
