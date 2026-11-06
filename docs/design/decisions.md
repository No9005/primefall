# Design decisions of the owner

Decisions about how the game looks and behaves that were made in chat and are not (or not yet) in `ui-spec.md`. Ticket writers and agents read this before a UI ticket and do not contradict it. If a ticket has to, it says so and the owner decides. The design canvas (the published boards, referred to by letter) is the reference for looks; this file is for the decisions behind it.

| Area | Decision | Source |
|---|---|---|
| Planning screen | Removed on purpose: the Squad panel and Hero chips, the enemy panel, the turn, Zoom and Lines buttons. Target lines are always on. Pinch and pan of the board stay. | PR #244 |
| Hero identity | No role markers or icons above Heroes. The class is told by shade and shape only. | #270 |
| Team colours | Own Squad blue family, enemy Squad red family, the class by shade (option A of the colour board). Squad ring: own teal `#2ec4b6`, enemy red `#e5484d`. | animation reference, `docs/design/animation/README.md` |
| Hand | Compact, peeking from the bottom edge: name, cost and type visible; details on pull. Wait is shown as a card to the right of the Hand. | boards of the Hand, #273 |
| Card pull | Press lifts the card to the middle top; drag up past about 14 px makes it follow the finger and fades the faces in with its height; a release above the middle line parks the card under the faces and the faces stay open (tap-tap choosing is intended); a release below puts it back; pulling the parked card down, tapping it or tapping outside cancels. | boards O and V, #267 |
| Targeting | Advance Wars style Range area under the Hero; the target is picked by tapping an enemy. A shot may name only an enemy that is currently Visible; it is checked again in the Tick it fires and misses if it is no longer valid. Out of Range at planning time is a hint, never a block. | board V, #264 |
| Resolution view | Full-width bar at the top "RESOLUTION · TICK n / 4", big callout word, Heroes animate; commentary below the bar. Playback tempo per Tick is still to be checked against board U (today 1200 ms). | board U, #266 |
| Walking | A Move is one continuous walk from tile A to tile B: the figure glides at a constant speed over each step (one step is `STEP_MS`) and the walk clip keeps its stride, so the steps run into each other and the figure does not jump from tile to tile. Knockback keeps its own slide. With `prefers-reduced-motion` the figure jumps. | owner, `walk-glide` scenario |
| Timer and score | Timer pill with Round, countdown and LOCKED state; Prime Zone score in a pill that is always shown. | board Y, #269 |
| Words | Use the glossary terms. The word "Point" is not used in the UI. | owner |
| Touch targets | Two tiers: primary controls at least 40 x 40 px; secondary, dense controls at least 32 x 32 px with at least 8 px between neighbours; floor 24 x 24 px. | #268 |
| Text | At least 12 px; contrast at least 4.5:1 (3:1 for large or dimmed text). | #268 |
| Start flow | Start screen with two entries, Classic (default) and Attack and Defend. Classic leads to Hero Select; Attack and Defend leads to a side screen (Attack or Defend, with a dimmed board preview behind it), then Hero Select. Resume and Tutorial skip both. Role colours: ATTACK orange, DEFEND blue. | `docs/design/attack-defend/`, #303 |
| Hero Select | The player chooses one Hero (Bruiser, Controller or Assassin) before a match and controls only that Hero; the choice holds for the whole match. No Hero preselected, Start disabled until one is selected. Tapping a Hero plays its ready pose (Bruiser aims to the side and fires, Controller releases the drone, Assassin turns invisible). The info box shows the Hero's task and a card list. | `docs/design/hero-select/`, #318, #319 |
| Not designed yet | Tutorial look. Do not invent it in other tickets. | owner |
| Agents and screenshots | UI changes are looked at with the screenshot tool at 844 x 390 and deviations are fixed by the agent; a state that cannot be staged is stated openly in the pull request. | `CLAUDE.md`, #261 |
