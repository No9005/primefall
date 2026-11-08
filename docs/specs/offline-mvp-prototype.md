# Offline MVP Prototype Spec

## Problem Statement

A player wants to play a quick, tactical 3v3 match where both squads plan simultaneously, commit their commands, and watch a deterministic battle resolve. The player needs clear roles, meaningful positioning, hidden information, and a readable victory condition without managing a separate health pool.

## Solution

Primefall provides a mobile-first, offline 3v3 tactical match on the Reactor Deck. The player controls one Hero, allied AI controls the other two Heroes, and enemy AI controls all three opposing Heroes.

Both squads plan simultaneously, commit commands, and resolve combat through a deterministic priority-interleaved Resolution. In the classic mode a squad wins by Victory Points from three zones: the central 3 by 3 Prime Zone (2 per Resolution, active from Round 4) and two Outposts (1 each, active from Round 1); the first to 30 wins.

## Card Set

The complete fixed card set is maintained in `docs/specs/mvp-card-set.md`. That document is the authoritative reference for all card effects, Energy costs, and Overdrive modes.

## User Stories

1. As a player, I want to start a 3v3 match on the Reactor Deck, so that I can play a complete tactical match against AI opponents.
2. As a player, I want to control one Hero directly, so that I can make the most important tactical decisions myself.
3. As a player, I want allied AI to control my other two Heroes, so that I can focus on my own Hero without managing every unit.
4. As a player, I want enemy AI to control all three opposing Heroes, so that I can play without another human player.
5. As a player, I want both squads to spawn on opposite horizontal edges of the Reactor Deck, so that neither side begins with an unfair positional advantage.
6. As a player, I want a central 3 by 3 Prime Zone, so that I have a clear objective to contest.
7. As a player, I want the Prime Zone to contain no permanent Cover, so that holding it requires active protection and squad coordination.
8. As a player, I want to see the Prime Zone from several approach angles, so that I can plan attacks and defenses around it.
9. As a player, I want no direct Line of Sight from either Spawn area into the Prime Zone, so that early scouting matters.
10. As a player, I want side corridors with Half Cover, so that I can flank, retreat, and move without being permanently exposed.
11. As a player, I want main routes to be at least two tiles wide, so that movement does not become blocked by frustrating one-tile chokepoints.
12. _(Removed for now, ADR 0024; stories 12 to 14.)_ As a player, I want one Overwatch Nest with Full Cover, so that I can contest a valuable scouting position.
13. As a player, I want the Overwatch Nest to have a limited sightline into the Prime Zone, so that it rewards positioning without automatically controlling the objective.
14. As a player, I want only one Overwatch Nest, so that controlling information becomes a meaningful secondary objective.
15. As a player, I want terrain to remain visible at all times, so that I can plan movement and positioning even when enemies are concealed.
16. As a player, I want enemies to be Visible only with current Line of Sight, so that information remains valuable.
17. As a player, I want enemies that leave sight to appear as Ghosts at their last known position, so that I can make informed predictions without perfect information.
18. As a player, I want enemies without a known position to remain Unknown, so that scouting has a clear purpose.
19. As a player, I want my Squad to share vision, so that information gathered by one Hero benefits the entire team.
20. As a player, I want my Hero to have a fixed Deck (Bruiser 12, Controller 10, Assassin 9 cards; ADR 0025), so that my long-term survival is tied to my card resources.
21. As a player, I want unblocked damage to remove cards from the top of my Deck, so that every point of damage has a lasting cost.
22. As a player, I want my Hero to become Exhausted when its Deck and Discard are empty at the end of a Resolution, so that Deck-as-Life creates a clear defeat condition.
23. As a player, I want my Squad to lose when all three Heroes are Exhausted, so that matches have a decisive end.
24. As a player, I want to draw up to four cards at the start of each round, so that I have fresh tactical options without losing access to retained cards.
25. As a player, I want to retain unused Hand cards between rounds, so that I can plan around future turns.
26. As a player, I want every card to have four possible uses, so that I always face a meaningful opportunity-cost decision.
27. As a player, I want to play a card’s primary effect, so that I can use its intended tactical purpose.
28. As a player, I want to Pitch a card for 1 Energy, so that I can fund Attack and Utility effects.
29. As a player, I want to use any card as Move 2, so that I can reposition even when I do not want to use its primary effect.
30. As a player in Attack and Defend (not the classic mode, #358), I want to use any card as Block 2, so that I can create Shield instead of using its primary effect.
31. As a player, I want a card to fulfill only one role during a round, so that card use remains a meaningful commitment.
32. As a player, I want Energy to expire at the end of the round, so that resource planning stays round-scoped.
33. As a player, I want the Discard to be shuffled into the Deck as soon as the Deck is empty and a card must be taken from it (Deck Damage, Draw) or a Resolution ends, so that a Hero can continue fighting after spending cards.
34. As a player, I want to plan an ordered queue of actions for each Hero, so that I can express tactical intent.
35. As a player, I want both Squads to commit their plans simultaneously, so that neither side can react to the other’s final commands.
36. As a player, I want a fixed planning timer with early commit, so that matches keep moving.
37. As a player, I want the game to resolve committed actions deterministically after both Squads commit, so that outcomes are fair and reproducible.
38. As a player, I want Resolution to process one action from every non-exhausted Hero’s queue per Tick, so that action order matters.
39. As a player, I want actions to be validated when they execute, so that illegal actions fail without disrupting later planned actions. An Attack names a Declared Target in planning and is checked in the Tick it fires (see the Implementation Decisions).
40. As a player, I want simultaneous attacks to both resolve, so that aggression remains risky and consequential.
41. As a player, I want Heroes that move not to hinder each other (they can follow, cross and swap), while a Hero cannot walk through a Hero that stays where it is and two Heroes never step onto the same tile: a step onto a tile that a Hero keeps, or that another Hero steps onto too, fails and the Hero stops there, so that movement conflicts have a clear rule (ADR 0013).
42. As a player in Attack and Defend, I want a Block to take effect immediately in its Tick, so that I can protect against an attack resolved in that same Tick.
43. As a player, I want a Hero that becomes Exhausted during Resolution to complete its already committed action, so that planning remains meaningful.
44. As a player, I want Exhaustion to take effect after Resolution, so that a Hero’s final committed action is not silently cancelled.
45. As a player, I want Full Cover to block attacks and sight from the firing direction, so that positioning can create real protection.
46. As a player, I want Half Cover to reduce incoming damage by 1 without blocking sight, so that it provides partial protection without full concealment.
47. As a player, I want allied Heroes not to block Line of Sight or firing lines, so that squad positioning remains flexible.
48. As a player, I want the Bruiser to control close space and the Prime Zone, so that the team has a durable frontline.
49. As a player, I want the Controller to enable the Squad through Shield, Vision, Cover deployment, Slow, and Marked effects, so that support decisions matter.
50. As a player, I want the Assassin to scout from Hidden, mark targets, and punish exposed enemies, so that information gathering has a clear payoff.
51. As a player, I want the Assassin to become Hidden through certain Utility cards, so that stealth remains a deliberate tactical choice.
52. As a player, I want Hidden to last up to two Resolutions unless the Hero attacks or is revealed, so that stealth is temporary and contestable.
53. As a player, I want the Assassin to receive increased sight range while Hidden, so that scouting is rewarded.
54. As a player, I want to mark an enemy for my Squad until the end of the next round, so that gathered information becomes team-wide.
55. As a player, I want Ghost Shot to target a Ghost’s last known position, so that predictable movement can be punished.
56. As a player, I want Ghost Shot to hit only if an enemy occupies the targeted tile during Resolution, so that it remains a high-risk tool.
57. As a player, I want Full Cover to block Ghost Shot and Half Cover to reduce its damage, so that Cover remains important against long-range threats.
58. As a player, I want to activate Overdrive on selected cards, so that I can trade future card economy for immediate power.
59. As a player, I want Overdrive to exile the used card, so that powerful effects have a lasting cost.
60. As a player, I want some Overdrives to grant permanent buffs that end when the Hero becomes Exhausted, so that power remains tied to survival.
61. As a player, I want each Hero Deck to contain three Overdrive modes, so that Overdrive decisions remain meaningful.
62. As a player, I want the Bruiser to destroy Cover through a Zone Overdrive, so that defensive positions can be broken.
63. As a player, I want the Controller to deploy Half Cover on an empty tile, so that the team can create protection where it is needed.
64. As a player, I want the Controller to reveal an area with a Scout Drone, so that the Squad can gather information without exposing the Controller.
65. As a player, I want the Controller to apply Marked with Tag Round, so that enemies become visible to the Squad.
66. As a player, I want the Assassin to use Long Shot at Range 7, so that long-range precision is part of its identity.
67. As a player, I want the Assassin’s Long Shot Overdrive to grant bonus damage at Range 6 or 7, so that distance remains tactically relevant.
68. As a player, I want the Reactor Deck to be mirror-symmetric, so that both Squads begin with equivalent map conditions.
69. As a player, I want the Reactor Deck to have no interactive doors, so that the first prototype remains focused on core combat.
70. As a player, I want the Reactor Deck to have one floor level only, so that movement and Line of Sight remain easy to understand.
71. As a player, I want match state to remain in browser memory, so that the offline prototype does not require a backend.
72. As a player, I want optional localStorage support, so that I can retain progress between sessions without an account or server.
73. As a player, I want the game to run in a mobile-friendly web browser, so that I can play without installing an application.
74. As a player, I want the presentation to use stylized 2.5D with an orthographic camera, so that the battlefield remains readable from a tactical perspective.
75. As a player, I want allied AI to move toward the objective, attack visible enemies, and (in Attack and Defend) block when appropriate, so that teammates contribute meaningfully.
76. As a player, I want enemy AI to use simple legal-action heuristics, so that matches remain challenging without complex behaviour.
77. (Classic mode.) As a player, I want to earn Victory Points at the end of each Resolution for every zone my Squad controls (the Prime Zone 2, an Outpost 1; the Prime Zone scores from Round 4, the Outposts from Round 1), and the match to end immediately when a Squad reaches 30, so that victory is clear. The Squad with more non-Exhausted Heroes in a zone controls it; equal numbers with at least one Hero each is Contested and nobody scores. Attack and Defend keeps its own rules (user stories 90 and following).
78. As a player, I want Core Rush to be unavailable in the first prototype, so that the Prime Zone remains the only victory path.
79. As a player, I want the user interface to use the project glossary vocabulary, so that game concepts remain consistent.
80. As a player, I want to control the Bruiser by default and be able to choose another Player Hero, so that the first match is simple to understand and I can still play the other Heroes.
81. As a player, I want to see the current Round as "Round X / 30", so that I know how much time is left.
82. (Classic mode.) As a player, I want the match to end after 15 Rounds with the Squad with more Victory Points winning (equal points: the Squad with more cards not in the Exile, Deck plus Discard plus Hand; still equal: a draw), so that every match finishes.
83. As a player, I want to see my Hand and the number of cards in my Deck and Exile, so that I can plan my economy.
84. As a player, I want to see the Deck, Discard and Exile counts and the Shield of Visible enemies, so that I can predict when they will have their strong cards again.
85. As a player, I want Ghosts to show the last seen counts and Unknown enemies to show nothing, so that scouting is valuable.
86. As a player, I want the spec to respect the existing ADRs, so that future implementation follows the documented decisions.
87. As a player, I want to name the Visible enemy I want to hit in any Tick of my Queue, even if it is not in Range yet, so that I can plan a shot after my Moves; the shot is checked when it fires and misses if it is not allowed.

## Implementation Decisions

- Build an offline, client-side 3v3 tactical match prototype in TypeScript.
- Use the Reactor Deck as the first map: a horizontally oriented, mirror-symmetric 31 by 17 tile grid (ADR 0016).
- Place the 3 by 3 Prime Zone at columns 14–16 and rows 7–9.
- Keep the Prime Zone free of permanent Cover.
- Classic mode: two Outposts of 3 by 2 tiles, interim at columns 14–16, rows 3–4 and rows 12–13 (the real map comes later).
- ~~Provide exactly one Overwatch Nest at column 15, row 1, with Full Cover and a limited sightline into the Prime Zone.~~ Removed for now (ADR 0024): the Reactor Deck has no Overwatch Nest.
- Spawn one Squad on the left edge (column 1, rows 7–9) and the other on the right edge (column 29, rows 7–9), without direct Line of Sight into the Prime Zone.
- Implement three Hero classes: Bruiser/Vanguard, Controller/Tactician, and Assassin/Striker.
- Give each Hero a fixed Deck with no Flex cards: Bruiser 12, Controller 10, Assassin 9 cards (ADR 0025).
- Implement Deck-as-Life: unblocked damage removes cards from the top of the target’s Deck; a Hero whose Deck and Discard are both empty at the end of a Resolution is Exhausted. An Exhausted Hero is out of the match and its tile becomes Half Cover (it does not obstruct Moves; Cover-destroying effects such as Breach Charge destroy it; a Prime Zone tile stays a Prime Zone tile).
- Implement Shield as a round-scoped defensive value created through Shield cards, and through Block 2 in Attack and Defend only (the classic mode has no Block action, #358).
- A **Wait** button next to the Queue slots of the selected Hero adds a Wait (an hourglass slot that needs no card and no Energy and can be removed like any other slot) to the first free slot.
- Distances use Chebyshev distance and movement is 8-directional; Cover is occupiable and ignored by attackers at Range 1; Pitch is a planning step; a Hero's queue has at most 4 actions (ADR 0020).
- Implement the standard uses for every card: primary effect, Pitch 1, Move 2, and Block 2 in Attack and Defend only.
- Implement Energy as a round-scoped resource produced by Pitching and required for Attack and Utility effects.
- Implement simultaneous planning with a fixed timer and early commit.
- Implement deterministic priority-interleaved Resolution using per-Hero action queues and Ticks.
- Validate actions at execution time; illegal actions fail without affecting later actions.
- Declared Target: an Attack that hits a single enemy Hero names it in planning. Only an enemy that is currently Visible and not Exhausted can be named, whatever its Range and Line of Sight from the planned position; a Ghost or an Unknown enemy cannot be named by a normal Attack (Ghost Shot Overdrive keeps its tile rule). In the Tick the Attack fires, against the positions at the end of that Tick's movement, it is checked in this order, and the first failing check makes it a Miss with that reason: the target is visible to the Squad (`NotVisible`), not Exhausted (`TargetExhausted`), within Range (`OutOfRange`), not closer than the card's Minimum Range, `minRange` (`TooClose`), in Line of Sight (`NoLineOfSight`), not behind Full Cover (`FullCover`). A Miss does nothing and later actions of the Queue still run. Plan-time checks never block Commit for Range or Line of Sight; the planner only shows a hint that the shot may miss.
- Implement squad-shared, enemy-only Fog of War with Visible, Ghost, and Unknown states. Base sight range is 7 tiles (9 for a Hidden Assassin); Visible requires sight range and Line of Sight. A Miss on a target the Squad no longer sees (`NotVisible`) reveals nothing about that enemy: no distance, no position, no new Ghost, and the enemy Squad is not told.
- Implement Hidden only for the Assassin through selected Utility cards.
- Implement Marked as a Squad-wide visibility effect until the end of the next round.
- Implement Ghost Shot as the Assassin’s Attack Overdrive that targets a Ghost’s last known position.
- Use simple legal-action heuristics for allied and enemy AI: move toward the objective, attack visible enemies, and block when appropriate (Attack and Defend only).
- Keep match state in browser memory, with optional localStorage support.
- Use PixiJS for stylized 2.5D presentation with an orthographic camera.
- Do not use Matter.js in the MVP; movement, Line of Sight, Cover, and combat are tile-based simulation rules.
- The player controls one Player Hero; the default is the Bruiser / Vanguard, and the other two Heroes of the Squad are planned by the AI. The Hero Select screen that lets the player choose is a separate ticket.
- Classic mode: a match ends after 15 Rounds (see user story 82; this replaces the 30 Rounds and the Deck tiebreak of ADR 0019 for the classic mode); the Round counter is shown in the UI as "Round X / 15" and the Zone pill shows both Victory Point scores.
- Only a Match Host computes outcomes; the client sends Squad Plans and renders Squad View and filtered events (ADR 0017). The offline prototype runs the host in the browser main thread behind an asynchronous interface.
- Card effects are declarative data interpreted by the engine (ADR 0018).
- Tooling, repository layout and CI follow ADR 0018.
- Do not publish the spec to a GitHub Issue; store it as a Markdown document under `docs/specs/`.

## Testing Decisions

- Test external behaviour, not implementation details.
- Use the authoritative Match Simulation as the primary test seam.
- Given a starting Match State and two committed Squad Plans, the simulation must produce exactly one deterministic resulting Match State.
- Test movement, collision conflicts, Line of Sight, Cover, Hidden, Marked, Ghosts, Energy, Deck Damage, Crossfire, Exhaustion, and victory conditions through this seam.
- Test Declared Targets through this seam: an Attack hits when its target is valid in the Tick it fires (after the Hero's Moves or the enemy's Moves), and misses with one reason per failing check, without damage and without stopping later actions.
- Prefer existing seams; do not introduce additional seams unless a higher-level test cannot otherwise be expressed.
- Use the Reactor Deck layout and the MVP card set as stable fixtures for deterministic scenario tests.
- Treat AI behaviour as heuristic: test that AI actions are legal and objective-oriented, not that a specific action is always chosen.

## Attack and Defend Mode (second mode)

A second mode next to the classic mode described above, decided in ADR 0022 (Proposed). Everything above describes the classic mode, which stays the default and does not change. In this section "the Zone" is the Prime Zone.

### User Stories

88. As a player, I want to choose the mode when a match starts, so that I can play the classic mode or Attack and Defend.
89. As a player, I want one Squad to be the Defender and the other the Attacker, so that the two sides have different jobs.
90. As a player, I want the Defender's Heroes to start on the Prime Zone tiles next to their side (column 14 for the Left Squad, column 16 for the Right Squad, rows 7 to 9), so that the Attacker has to fight its way in.
91. As a player, I want the Attacker to start on its Spawn tiles, so that it has to cross the Reactor Deck first.
92. As a player, I want the Attacker to take control of the Prime Zone when at least one of its Heroes stands in it and it has at least as many Heroes in it as the Defender, so that the Defender has to Exhaust or push out the Attacker Heroes instead of just standing there.
93. As a player, I want the previous controller to keep the Zone when the Attacker does not take it, so that control does not flicker.
94. As an Attacker, I want to win by controlling the Zone during 3 consecutive Resolutions, so that pressure on the Zone is rewarded.
95. As an Attacker, I want to win by Exhausting all three Defender Heroes, so that I can also win by wearing down the Decks.
96. As a Defender, I want to win when the Round limit of the mode (default 12) has been played without an Attacker win (Defence Held), so that surviving with my Decks matters more than holding the Zone.
97. As a player, I want the Round counter to show the Round limit of the mode, so that I know how long the Defender has to hold.
98. As a player, I want every other rule (Decks, Energy, Pitch, cards, Fog of War, Exhaustion) to stay as in the classic mode, so that I only have to learn the roles.
99. As a player, I want a hit on a Hero to deal 1 extra damage when a different attacker hit that Hero in the same Tick or the Tick directly before (Crossfire), so that flanking beats rushing in alone and the middle is dangerous. This applies in both modes.

### What the Mode Changes

- Start positions of the Defender, the control rule of the Zone, the win paths and the Round limit (replacing the 30 Round limit and the Deck tiebreak of ADR 0019 for this mode).
- A new match end reason: Defence Held.
- The saved snapshot of a match carries the mode and the Attacker's Squad.

### What Stays Unchanged

The classic mode and ADR 0010 are valid for it. Decks, Energy, Pitch, the MVP card set, Cover, Line of Sight, Fog of War, Exhaustion (ADR 0011), simultaneous planning and priority-interleaved Resolution (ADR 0013) are the same in both modes.

### Testing Decisions

Through the Match Simulation seam, with the Reactor Deck and the MVP card set as fixtures:

- Zone control with ties: one Attacker Hero against one Defender Hero in the Zone gives the Attacker control; one against two does not and the previous controller keeps it; no Attacker Hero in the Zone never gives it control, whatever the count of Defender Heroes.
- Exhausted Heroes do not count towards the Zone.
- The two win paths: control during 3 consecutive Resolutions (progress resets when control is lost), and all three Defender Heroes Exhausted.
- The Defender's Round limit: after the last Round of the limit without an Attacker win the match ends with Defence Held and the Defender wins; the 30 Round limit and the Deck tiebreak do not apply; an Attacker win in the last Round of the limit wins over Defence Held.
- The Defender's start positions for both sides, and that the classic mode is unchanged.
- The AI produces legal plans for both roles (heuristic, as in the classic mode).

## Future Work: UI Tests

Browser tests are intentionally not part of the MVP. Rough idea for later: a small Playwright suite that starts the app, plays a complete offline match against the AI with a fixed seed, and asserts the main flow (planning, commit, Resolution playback, end screen with Round counter); plus screenshot comparisons for the HUD and card Hand at a mobile viewport. It should run separately from `npm test` and, if added to CI, in its own job.

## Out of Scope

- Online multiplayer and Colyseus integration.
- Persistent backend services and databases.
- Interactive doors, hacking, and door state changes.
- Multiple floors, elevators, shafts, and vertical movement.
- Core Rush as a victory path.
- Flexible decks, deck building, and card collection.
- Advanced AI behaviours beyond simple legal-action heuristics.
- Physics-based simulation with Matter.js.
- Publishing the spec to a GitHub Issue.

## Further Notes

The spec uses the project glossary vocabulary and respects the existing ADRs. The Reactor Deck is intentionally open at its centre so that Controller effects, especially Deploy Cover, Scout Drone, Aegis Protocol, and Marked effects, become tactically valuable.

The single Overwatch Nest is a secondary objective rather than a permanent safe scouting position. It rewards positioning while remaining contestable, preventing passive camping without making information gathering worthless.

ADR 0011 retains an explicit accepted Status because it revisits and replaces the earlier Hero Death rule.
