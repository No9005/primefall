# Attack and Defend: the design reference

The look of the start flow, the side screen, the role announcement, the HUD and the end screens of the Attack and Defend mode. It was worked out with the product owner on the design canvas. **Build it the way it is shown here.** Where this text and the images disagree, the images win. Decisions behind it: ticket #303 and #298. The Hero Select screen that follows the side screen is in `docs/design/hero-select/`.

## Files (all 844 x 390, landscape phone; `reference/*.html` are the live pages)

| Image | State | Compare with |
|---|---|---|
| `overview/start-screen.png` | Start screen: Classic (default) and Attack and Defend, Resume, Tutorial, seed | the start flow |
| `overview/side-attack.png`, `side-defend.png` | side screen with the preview behind it | the side screen |
| `overview/role-banner-attack.png`, `role-banner-defend.png` | role announcement when a match starts | the banner |
| `overview/hud-attacker.png`, `hud-defender.png` | planning HUD | the HUD pills |
| `overview/hud-resolution.png` | Resolution bar in the new mode | the bar |
| `overview/end-*.png` (four), `end-screens.png` | end screens | the end texts |

## Flow

Classic: Start screen, Hero Select, match. Attack and Defend: Start screen, side screen (Attack or Defend), Hero Select, match. Back returns to the previous screen. Resume and Tutorial skip the side screen and the Hero Select (Resume restores mode, role and Hero; the Tutorial stays classic and Bruiser).

## Colours and tokens

ATTACK orange `#ff8a3d`, DEFEND blue `#4da3ff`, own Squad teal `#2ec4b6`, enemy red `#e5484d`; panels `#1b222b`, steel `#3d5a73`, text `#dbe4ec`; fonts Rajdhani (labels), Barlow (body), IBM Plex Mono (counts). Everything else is the token list of `docs/design/ui-spec.md`; touch targets and text sizes as in `docs/design/decisions.md`.

## Acceptance table

| Element | Size and position (px) | Look and text |
|---|---|---|
| Start screen entries | two buttons side by side, each at least 132 high, max total width 600, gap 16 | Classic: teal border 2 px, "DEFAULT" tag, one line of text. Attack and Defend: steel border, orange tag "NEW · TWO ROLES", the text "One Squad storms the Prime Zone, the other holds out. Pick your side next." Resume and Tutorial below, 44 high, steel border |
| Side screen, title and chip | title centred at top 20, "CHOOSE YOUR SIDE" Rajdhani 700 18 px; chip "ATTACK AND DEFEND" at the right (right 24, top 17), 30 high, no fill | back button at (24, 12), 40 high, as on the Hero Select screen (fill steel 70%, border 2 px light, white text 16 px) |
| Side buttons | two, 270 x 68, tops at 70, lefts at 142 and 432 (22 px apart) | label Rajdhani 700 30 px, letter spacing 0.14 em (ATTACK orange, DEFEND blue) with a line below ("Take the Prime Zone", "Hold the Prime Zone"); **selected**: 2.5 px border in the role colour and a tinted background; the other: 2 px steel |
| Side screen, text | (40, 314), 560 x 66, **no box** | role name in the role colour (Rajdhani 700 16 px) and the text of #303 (Barlow 500 14 px), a soft text shadow for legibility on the dimmed board |
| Next button | 160 x 48, right 24, bottom 20 | teal fill, "NEXT" and an arrow |
| Preview behind the side screen | the real board, dimmed to 50%, "PREVIEW" tag at (24, 84) | a slow camera move of about 4 s, looping: from the start of the player's Squad to the Prime Zone (Attack) or from the Prime Zone to the enemy Spawn (Defend); both Squads in their start positions, idle pose; the Defenders in the Prime Zone each have a blue shield bubble (ring 2 px `#4da3ff`, 16% fill) that shows they defend; a dashed arrow marks the way: Attack: your Spawn to the Prime Zone (orange); Defend: **from the Attackers' Spawn to you in the Prime Zone** (red, the arrowhead on the Zone); labels in IBM Plex Mono 12 px: YOUR SPAWN, PRIME ZONE (Attack); PRIME ZONE · YOUR START, ENEMY SPAWN, ATTACKERS COME FROM HERE (Defend). No Fog of War. Switching the role restarts it. |
| Role banner | a bar across the screen, 130 high, centred vertically; "YOUR ROLE" (IBM Plex Mono 700 12 px, letter spacing 0.3 em), the role word (Rajdhani 700 62 px, letter spacing 0.2 em, role colour), the goal line (Barlow 500 16 px) | ATTACK: "Control the Prime Zone for 3 Resolutions". DEFEND: "Hold out for 12 Rounds". Same timing and fade as the existing callout (`RESOLUTION_CALLOUT_MS`), board dimmed behind it |
| Role label (HUD) | pill at (8, 4), 34 high | dot and role word in the role colour, Rajdhani 700 16 px, border 1.5 px in the role colour |
| Attacker pill (centre) | 34 high, centred at top 4 | "ZONE CONTROL", three pips (filled orange, empty outlined) and "n / 3"; border orange |
| Defender pill (centre) | 34 high, centred at top 4 | "HOLD OUT", "n ROUNDS LEFT" in blue, a divider, then "ZONE: YOURS" (teal) / "ZONE: CONTESTED" (amber) / "ZONE: ENEMY" (red); border blue |
| Round pill | right 8, top 4, 34 high | "ROUND n / 12" (the mode's limit) and the timer |
| Resolution bar | full width, 28 high at the top | "RESOLUTION · TICK n / 4" at the left, the role word at the right in the role colour; the centre pill moves down to top 34 |
| End screens | centred stack | first line "YOU WERE: ATTACK" (orange) or "YOU WERE: DEFEND" (blue), IBM Plex Mono 700 12 px; result word (Rajdhani 700 56 px, teal VICTORY, red DEFEAT); reason line (Barlow 500 12 px, upper case, `#8a99a8`); detail line (Barlow 14 px); "Play again" 44 high; seed |
| End reasons | | Attacker victory: "Prime Zone controlled for 3 Resolutions" or "All Defender Heroes Exhausted". Defender victory: "Defence held · 12 Rounds played". Attacker defeat: "Defence held · 12 Rounds played". Defender defeat: "All your Heroes were Exhausted" or "Prime Zone controlled for 3 Resolutions" |

## How a ticket uses this

Take a screenshot of each state with the screenshot tool, compare it with the matching image and the table (sizes, positions, colours, texts, timing), fix every deviation yourself and attach the final screenshots to the pull request. State exactly which state could not be staged and why.
