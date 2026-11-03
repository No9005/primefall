# Offline MVP Prototype Spec

## Problem Statement

A player wants to play a quick, tactical 3v3 match where both squads plan simultaneously, commit their commands, and watch a deterministic battle resolve. The player needs clear roles, meaningful positioning, hidden information, and a readable victory condition without managing a separate health pool.

## Solution

Primefall provides a mobile-first, offline 3v3 tactical match on the Reactor Deck. The player controls one Hero, allied AI controls the other two Heroes, and enemy AI controls all three opposing Heroes.

Both squads plan simultaneously, commit commands, and resolve combat through a deterministic priority-interleaved Resolution. A squad wins by controlling the central 3 by 3 Prime Zone during three consecutive Resolutions.

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
12. As a player, I want one Overwatch Nest with Full Cover, so that I can contest a valuable scouting position.
13. As a player, I want the Overwatch Nest to have a limited sightline into the Prime Zone, so that it rewards positioning without automatically controlling the objective.
14. As a player, I want only one Overwatch Nest, so that controlling information becomes a meaningful secondary objective.
15. As a player, I want terrain to remain visible at all times, so that I can plan movement and positioning even when enemies are concealed.
16. As a player, I want enemies to be Visible only with current Line of Sight, so that information remains valuable.
17. As a player, I want enemies that leave sight to appear as Ghosts at their last known position, so that I can make informed predictions without perfect information.
18. As a player, I want enemies without a known position to remain Unknown, so that scouting has a clear purpose.
19. As a player, I want my Squad to share vision, so that information gathered by one Hero benefits the entire team.
20. As a player, I want my Hero to have a fixed 12-card Deck, so that my long-term survival is tied to my card resources.
21. As a player, I want unblocked damage to remove cards from the top of my Deck, so that every point of damage has a lasting cost.
22. As a player, I want my Hero to become Exhausted when its Deck is empty, so that Deck-as-Life creates a clear defeat condition.
23. As a player, I want my Squad to lose when all three Heroes are Exhausted, so that matches have a decisive end.
24. As a player, I want to draw up to four cards at the start of each round, so that I have fresh tactical options without losing access to retained cards.
25. As a player, I want to retain unused Hand cards between rounds, so that I can plan around future turns.
26. As a player, I want every card to have four possible uses, so that I always face a meaningful opportunity-cost decision.
27. As a player, I want to play a card’s primary effect, so that I can use its intended tactical purpose.
28. As a player, I want to Pitch a card for 1 Energy, so that I can fund Attack and Utility effects.
29. As a player, I want to use any card as Move 2, so that I can reposition even when I do not want to use its primary effect.
30. As a player, I want to use any card as Block 2, so that I can create Shield instead of using its primary effect.
31. As a player, I want a card to fulfill only one role during a round, so that card use remains a meaningful commitment.
32. As a player, I want Energy to expire at the end of the round, so that resource planning stays round-scoped.
33. As a player, I want the Discard to be shuffled into a new Deck cycle when no non-exiled cards remain, so that a Hero can continue fighting after spending cards.
34. As a player, I want to plan an ordered queue of actions for each Hero, so that I can express tactical intent.
35. As a player, I want both Squads to commit their plans simultaneously, so that neither side can react to the other’s final commands.
36. As a player, I want a fixed planning timer with early commit, so that matches keep moving.
37. As a player, I want the game to resolve committed actions deterministically after both Squads commit, so that outcomes are fair and reproducible.
38. As a player, I want Resolution to process one action from every non-exhausted Hero’s queue per Tick, so that action order matters.
39. As a player, I want actions to be validated when they execute, so that illegal actions fail without disrupting later planned actions.
40. As a player, I want simultaneous attacks to both resolve, so that aggression remains risky and consequential.
41. As a player, I want two Heroes attempting to enter the same free tile in the same Tick to both fail, so that movement conflicts have a clear rule.
42. As a player, I want a Block to take effect immediately in its Tick, so that I can protect against an attack resolved in that same Tick.
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
75. As a player, I want allied AI to move toward the objective, attack visible enemies, and block when appropriate, so that teammates contribute meaningfully.
76. As a player, I want enemy AI to use simple legal-action heuristics, so that matches remain challenging without complex behaviour.
77. As a player, I want the match to end immediately when one Squad controls the Prime Zone during three consecutive Resolutions, so that victory is clear.
78. As a player, I want Core Rush to be unavailable in the first prototype, so that the Prime Zone remains the only victory path.
79. As a player, I want the user interface to use the project glossary vocabulary, so that game concepts remain consistent.
80. As a player, I want to always control the Bruiser in the first prototype, so that the first match is simple to understand.
81. As a player, I want to see the current Round as "Round X / 30", so that I know how much time is left.
82. As a player, I want the match to end after 30 Rounds with the Squad holding more Deck cards winning, so that every match finishes.
83. As a player, I want to see my Hand and the number of cards in my Deck and Exile, so that I can plan my economy.
84. As a player, I want to see the Deck, Discard and Exile counts and the Shield of Visible enemies, so that I can predict when they will have their strong cards again.
85. As a player, I want Ghosts to show the last seen counts and Unknown enemies to show nothing, so that scouting is valuable.
86. As a player, I want the spec to respect the existing ADRs, so that future implementation follows the documented decisions.

## Implementation Decisions

- Build an offline, client-side 3v3 tactical match prototype in TypeScript.
- Use the Reactor Deck as the first map: a horizontally oriented, mirror-symmetric 31 by 17 tile grid (ADR 0016).
- Place the 3 by 3 Prime Zone at columns 14–16 and rows 7–9.
- Keep the Prime Zone free of permanent Cover.
- Provide exactly one Overwatch Nest at column 15, row 1, with Full Cover and a limited sightline into the Prime Zone.
- Spawn one Squad on the left edge (column 1, rows 7–9) and the other on the right edge (column 29, rows 7–9), without direct Line of Sight into the Prime Zone.
- Implement three Hero classes: Bruiser/Vanguard, Controller/Tactician, and Assassin/Striker.
- Give each Hero a fixed 12-card Deck with no Flex cards.
- Implement Deck-as-Life: unblocked damage removes cards from the top of the target’s Deck; an empty Deck causes Exhaustion.
- Implement Shield as a round-scoped defensive value created through Block 2.
- Distances use Chebyshev distance and movement is 8-directional; Cover is occupiable and ignored by attackers at Range 1; Pitch is a planning step; a Hero's queue has at most 4 actions (ADR 0020).
- Implement four standard uses for every card: primary effect, Pitch 1, Move 2, or Block 2.
- Implement Energy as a round-scoped resource produced by Pitching and required for Attack and Utility effects.
- Implement simultaneous planning with a fixed timer and early commit.
- Implement deterministic priority-interleaved Resolution using per-Hero action queues and Ticks.
- Validate actions at execution time; illegal actions fail without affecting later actions.
- Implement squad-shared, enemy-only Fog of War with Visible, Ghost, and Unknown states. Base sight range is 7 tiles (9 for a Hidden Assassin); Visible requires sight range and Line of Sight.
- Implement Hidden only for the Assassin through selected Utility cards.
- Implement Marked as a Squad-wide visibility effect until the end of the next round.
- Implement Ghost Shot as the Assassin’s Attack Overdrive that targets a Ghost’s last known position.
- Use simple legal-action heuristics for allied and enemy AI: move toward the objective, attack visible enemies, and block when appropriate.
- Keep match state in browser memory, with optional localStorage support.
- Use PixiJS for stylized 2.5D presentation with an orthographic camera.
- Do not use Matter.js in the MVP; movement, Line of Sight, Cover, and combat are tile-based simulation rules.
- The player always controls the Bruiser / Vanguard; Hero choice is a later extension.
- A match ends after 30 Rounds (ADR 0019); the Round counter is shown in the UI as "Round X / 30".
- Only a Match Host computes outcomes; the client sends Squad Plans and renders Squad View and filtered events (ADR 0017). The offline prototype runs the host in the browser main thread behind an asynchronous interface.
- Card effects are declarative data interpreted by the engine (ADR 0018).
- Tooling, repository layout and CI follow ADR 0018.
- Do not publish the spec to a GitHub Issue; store it as a Markdown document under `docs/specs/`.

## Testing Decisions

- Test external behaviour, not implementation details.
- Use the authoritative Match Simulation as the primary test seam.
- Given a starting Match State and two committed Squad Plans, the simulation must produce exactly one deterministic resulting Match State.
- Test movement, collision conflicts, Line of Sight, Cover, Hidden, Marked, Ghosts, Energy, Deck Damage, Exhaustion, and victory conditions through this seam.
- Prefer existing seams; do not introduce additional seams unless a higher-level test cannot otherwise be expressed.
- Use the Reactor Deck layout and the MVP card set as stable fixtures for deterministic scenario tests.
- Treat AI behaviour as heuristic: test that AI actions are legal and objective-oriented, not that a specific action is always chosen.

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
