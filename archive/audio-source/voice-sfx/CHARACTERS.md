# The Heroes' voices: character, tags and what to avoid

For writing **new lines that sound like the old ones**. Three parts per Hero: who they are, how the lines are directed (the audio tags in square brackets that steer the delivery), and what to avoid. The tag counts are real (counted in the lines that were generated, `PROMPTS.md`); the description of each character comes from the design notes (`docs/design/world/README.md`), from the owner's own words about Max, and from reading the lines. **Where a statement is my reading and not something the owner said, it says so.** What failed is marked as *observed*; "avoid" items that are only the opposite of a Hero's palette are marked as *derived*.

## How a line is made (the same for all three)
- Model `eleven_v4` (a few early tests `eleven_v3`), `POST /v1/text-to-speech/<voice id>`, body `{"text": "[tag, tag] The line.", "model_id": "eleven_v4", "voice_settings": {"stability": ..., "similarity_boost": 0.75}}`. Every Hero has **one fixed voice**; the character comes from the **audio tags** and the wording, not from changing the voice.
- Tags are written at the start of the line (`[giddy, thrilled] Ooh, let's see what THIS one does!`) and sometimes inside it (`[short pause]`, `[giggling]`) as a beat. One to three tags, mostly adjectives of the delivery.
- **Several takes per line** (the API's `history.json`), then the owner picks; the picked take is cut at the silence and levelled to about -16 LUFS (see `apps/web/public/assets/audio/README.md`).
- **Length:** lines are short, mostly 1 to 6 words. The game's limits: a Select line about 4 s, a heavy-hit line 3.5 s (the README names two lines that run over: Max's Select 4.4 s and `hit-heavy-2` 4.0 s).
- Lines are in English; the humour comes from the wording.

---

## Max Overload (Bruiser)

**Who he is.** A loadmaster of the military: *"He moved cargo, equipment and comrades, takes orders and himself too seriously. That is where the satire sits."* In the owner's words: an officer of the loading service with a lot of paperwork, first-generation exosuit, honourably discharged, hires out to megacorps. Motto: *"I came here to move cargo and kick ass. The cargo is optional."* The exosuit is heavy and makes servo sounds; everything that hits him hits steel first (see the effects in `PROMPTS.md`).

**Voice.** ElevenLabs *Morgan - Deep, Powerful, and Confident* (`SAxJUlDKRc79XAyeWyMu`), `stability` 0.3, `similarity_boost` 0.75.

**What he sounds like (my reading of the lines).** A drill sergeant who talks in forms and regulations: barked orders, military bureaucracy as comedy ("Consider it filed!", "Request denied!", "Pain is temporary! Paperwork is forever!"). Deadpan one-liners next to loud ones. Never soft, never giddy.

**Tags he gets** (36 lines): `barks` (13), `shouting` (9), `flat` (4), `deadpan` (4), `roars` (2), `laughs` (2), `grunts` (1), `then barks` (1), `strained` (1), `wheezing` (1), `quietly` (1), `exhausted` (1), `tired` (1).
- **Loud and ordered:** `[shouting]`, `[barks]`, `[roars]` (the loud hits and attacks).
- **Dry and bureaucratic:** `[deadpan]`, `[flat]` (waiting, cover, the paper jokes: "Standing by.", "Surplus. Discarded.").
- **Strain at the end:** `[strained, wheezing]`, `[quietly, exhausted]`, `[deadpan, tired]` (exhausted, defeat).
- **A laugh as an answer to a hit:** `[laughs]` ("Nice try, soldier!").

**Avoid.**
- *Observed:* **`[barks]` was spoken** by the model as a dog's bark in the first takes; the first 0.25 to 1.2 s had to be cut off (`max/raw` has the originals, `max/final` the cut ones). A tag that names a **sound** can be taken for sound; a tag that names a **way of speaking** (`[shouting]`, `[deadpan]`) was not. For new lines prefer `[shouting]` or `[sharply]`, or keep `[barks]` and plan the cut.
- *Observed:* one line ("Bulk delivery!") had a noise at the start and was cut by hand.
- *Observed:* keep lines short; his Select (4.4 s) and one hit line (4.0 s) are over the limits.
- *Derived:* tags of the others: `[giddy]`, `[sing-song]`, `[giggling]`, `[squealing]`, `[whispering]`, `[softly]`. He does not whisper, and he does not squeal.

**All lines with their tags (what was generated):**

| Line id | Line with its tags |
|---|---|
| `select` | [barks] I move cargo and kick ass. Cargo is optional! |
| `attack_1` | [shouting] Weapons free! |
| `attack_2` | [barks] Engaging, as per the manual! |
| `attack_3` | [grunts] Consider it filed! |
| `handle_1` | [barks] Fragile, sir! |
| `handle_2` | [shouting] Sign here! |
| `buy2_1` | [barks] Double order! No refunds! |
| `buy2_2` | [shouting] Bulk delivery! |
| `coffee_1` | [barks] Take five, soldier! |
| `coffee_2` | [flat, then barks] Speed limit is zero! |
| `hardhat_1` | [barks] Helmet on! Regulation twelve! |
| `hardhat_2` | [deadpan] Safety first. Then violence. |
| `express_1` | [shouting] Incoming! |
| `express_2` | [roars] Coming through! |
| `hook_1` | [barks] Fall in, soldier! |
| `hook_2` | [shouting] Report to me! NOW! |
| `pitch_1` | [barks] Requisition approved! |
| `pitch_2` | [deadpan] Surplus. Discarded. |
| `wait_1` | [flat] Standing by. |
| `wait_2` | [flat] Awaiting orders. |
| `light_2` | [deadpan] Is that all? |
| `heavy_1` | [shouting] Is that ALL you've got?! |
| `heavy_2` | [roars] Pain is temporary! Paperwork is forever! |
| `shield_1` | [barks] Request denied! |
| `shield_2` | [laughs] Nice try, soldier! |
| `cover_1` | [barks] In position! |
| `cover_2` | [flat] Taking cover, sir. |
| `full_1` | [barks] Fortification holds! |
| `full_2` | [shouting] Not today! |
| `exh_1` | [strained, wheezing] Suit power... at zero. |
| `exh_2` | [quietly, exhausted] Tell them... I never stopped shooting. |
| `vic_1` | [shouting] Mission accomplished! File the report! |
| `vic_2` | [barks] Target neutralised. Dismissed! |
| `vic_3` | [laughs, barks] Invoice is in the mail, sir! |
| `def_1` | [deadpan, tired] Requesting early retirement. |
| `def_2` | [shouting] Retreat is not in the manual! |

**What is in the game now (the picked takes):**

| Id in the game | Spoken text | Length |
|---|---|---|
| `voice.select` | I came here to move cargo and kick ass. The cargo is optional. | 4.4 s |
| `voice.attack-1` | Weapons free! | 1.1 s |
| `voice.attack-2` | Engaging, as per the manual! | 2.1 s |
| `voice.attack-3` | Consider it filed! | 2.3 s |
| `voice.handle-1` | Fragile, sir! | 1.0 s |
| `voice.handle-2` | Sign here! | 1.0 s |
| `voice.buy2-1` | Double order! No refunds! | 2.0 s |
| `voice.buy2-2` | Bulk delivery! | 1.2 s |
| `voice.coffee-1` | Take five, soldier! | 1.3 s |
| `voice.coffee-2` | Speed limit is zero! | 1.3 s |
| `voice.hardhat-1` | Helmet on! Regulation twelve! | 2.1 s |
| `voice.hardhat-2` | Safety first. Then violence. | 2.9 s |
| `voice.express-1` | Incoming! | 0.9 s |
| `voice.express-2` | Coming through! | 2.1 s |
| `voice.hook-1` | Fall in, soldier! | 1.2 s |
| `voice.hook-2` | Report to me! NOW! | 1.7 s |
| `voice.pitch-1` | Requisition approved! | 1.4 s |
| `voice.pitch-2` | Surplus. Discarded. | 2.2 s |
| `voice.wait-1` | Standing by. | 0.9 s |
| `voice.wait-2` | Awaiting orders. | 1.1 s |
| `voice.hit-light-1` | That tickled. | 3.0 s |
| `voice.hit-light-2` | Is that all? | 0.9 s |
| `voice.hit-heavy-1` | Is that ALL you've got?! | 1.4 s |
| `voice.hit-heavy-2` | Pain is temporary! Paperwork is forever! | 4.0 s |
| `voice.hit-shield-1` | Request denied! | 1.4 s |
| `voice.hit-shield-2` | Nice try, soldier! | 2.3 s |
| `voice.cover-1` | In position! | 0.9 s |
| `voice.cover-2` | Taking cover, sir. | 1.4 s |
| `voice.full-cover-1` | Fortification holds! | 1.5 s |
| `voice.full-cover-2` | Not today! | 1.3 s |
| `voice.exhausted-1` | Suit power... at zero. | 3.0 s |
| `voice.exhausted-2` | Tell them... I never stopped shooting. | 2.6 s |
| `voice.victory-1` | Mission accomplished! File the report! | 2.4 s |
| `voice.victory-2` | Target neutralised. Dismissed! | 2.0 s |
| `voice.victory-3` | Invoice is in the mail, sir! | 2.0 s |
| `voice.defeat-1` | Requesting early retirement. | 2.0 s |
| `voice.defeat-2` | Retreat is not in the manual! | 2.4 s |

---

## Tilly Turnover (Controller)

**Who she is.** *"Tinkerer and mech mechanic. Her third arm is her own build, which also explains the Scout Drone, Barricade and Placed Cover as scrap-built gear."* Motto: *"Everything is a spare part if you squint hard enough."* (The cards: Price Tag, Site Survey, Urban Renewal, Temporary Solution, Heavy Metal.)

**Voice.** ElevenLabs *Bella - Professional, Bright, Warm* (`hpp4J3VqNfWAUOO0d1Us`), `stability` 0.5 (a few re-takes at 0.3), `similarity_boost` 0.75. The first tests used another voice (`WtA85syCrJwasGeHGH2p`, name not recorded) which was not kept.

**What she sounds like (my reading).** A gleeful improviser who is delighted by what she builds and not worried about whether it works: "Fire in the hole! [short pause] Probably!". Bright, fast, sing-song; when she is hit she becomes **small and pouty, not angry** ("Ow... that was not in the plans..."). Puns on parts and prices.

**Tags she gets** (34 lines): `giddy` (10), `short pause` (8), `sing-song` (5), `pouty` (5), `thrilled` (3), `excited` (3), `small` (3), `quick` (3), `squealing` (2), `sulking` (2), `whispers` (2), `breathless` (2), `mischievous` (2), `playful` (2), `cheerful` (2), `proud` (2), `smug` (2), `curious` (1), `giggling` (1), `doubtful` (1), `unsure` (1), `worried` (1), `weak` (1), `quiet` (1), `trembling` (1), `brave` (1), `defiant` (1), `triumphant` (1), `encouraging` (1), `bright` (1), `gleeful` (1), `shouting` (1), `hyped` (1), `matter-of-fact` (1), `thrifty` (1), `relieved` (1), `cheeky` (1), `surprised` (1), `indignant` (1), `whiny` (1), `hurt` (1), `hushed` (1), `teasing` (1).
- **Joy:** `[giddy]` (her most frequent tag), `[excited]`, `[thrilled]`, `[sing-song]`, `[playful]`, `[mischievous]`, `[gleeful]`, `[cheerful]`, `[proud]`, `[smug]`, `[hyped]`.
- **The beat:** `[short pause]` before the punchline (8 times), with `[giggling]` or `[squealing]` after it.
- **Hit and tired:** `[small]`, `[pouty]`, `[sulking]`, `[unsure]`, `[worried]`, `[whiny]`, `[weak]`, `[trembling, brave]`, `[whispers]` (a hug, "Probably.").
- **Defeat with spirit:** `[sulking, defiant]` ("I'll build a bigger one!").

**Avoid.**
- *Derived:* **`[flat]`, `[deadpan]`, `[barks]`, `[roars]`** (Max) and **`[quietly]`, `[dryly]`, `[calm]`** (Kit). She is never dry or military; and she does not get truly angry: a hit makes her sulk.
- *Derived:* long lines. Her lines are one short sentence, two at most, with the pause as the beat.
- *Observed:* the Tilly folders hold several takes per line (`tilly/raw`, one `attack_4_v2`); the owner chose between takes, so generate more than one.

**All lines with their tags (what was generated):**

| Line id | Line with its tags |
|---|---|
| `attack_1` | [giddy, thrilled] Ooh, let's see what THIS one does! |
| `attack_2` | [excited, curious] Ooh, I wonder what this button does! |
| `attack_3` | [giddy, sing-song] Fire in the hole! [short pause] [giggling] Probably! |
| `attack_4` | [giddy, doubtful] This should not work! [short pause] [squealing] It's working! |
| `hit_1` | [small, pouty] Ow... [short pause] that was not in the plans... |
| `hit_2` | [sulking, unsure] Hey... that was my favourite arm... |
| `hit_3` | [small, worried] Um... I think something is... leaking? |
| `exhausted` | [weak, pouty] I need... [short pause] a new body. [whispers] And a hug. |
| `victory` | [squealing, breathless] It worked! IT WORKED! [short pause] [giddy] I can't believe it worked! |
| `victory_2` | [sing-song, thrilled] Reassembled! [short pause] [giddy] Ahead of schedule! |
| `defeat` | [quiet, trembling, brave] It's fine... it's fine... I can fix this. [short pause] [whispers] Probably. |
| `defeat_2` | [sulking, defiant] I'll build a bigger one! [short pause] [pouty] Next time! |
| `price_tag_1` | [giddy, triumphant] Everything must go! |
| `price_tag_2` | [sing-song, mischievous] Marked down! |
| `site_survey_1` | [playful, cheerful] Go fetch! |
| `site_survey_2` | [encouraging, bright] Eyes up, buddy! |
| `urban_renewal_1` | [thrilled, breathless] Fresh start! |
| `urban_renewal_2` | [gleeful, mischievous] Redecorating! |
| `temporary_solution_1` | [proud, giddy] Good enough! |
| `temporary_solution_2` | [excited, quick] Instant wall! |
| `heavy_metal_1` | [excited, shouting] Turn it up! |
| `heavy_metal_2` | [giddy, hyped] Scrap party! |
| `pitch_1` | [sing-song, matter-of-fact] Parts is parts! |
| `pitch_2` | [cheerful, thrifty] Waste not! |
| `shield_1` | [relieved, cheeky] Ha, nope! |
| `shield_2` | [smug, sing-song] Nice try! |
| `light_1` | [surprised, pouty] Ouchie! |
| `light_2` | [indignant, quick] Hey! |
| `heavy_1` | [pouty, small] That hurt! |
| `heavy_2` | [whiny, hurt] Ow, ow, ow! |
| `cover_1` | [quick, giddy] Duck and cover! |
| `cover_2` | [playful, hushed] Hiding spot! |
| `fullcover_1` | [proud, smug] Built it myself! |
| `fullcover_2` | [giddy, teasing] Can't touch this! |

**What is in the game now (the picked takes):**

| Id in the game | Spoken text | Length |
|---|---|---|
| `voice.select` | Everything is a spare part! If you squint hard enough! | 4.0 s |
| `voice.attack-1` | Ooh, let's see what THIS one does! | 2.6 s |
| `voice.attack-2` | Ooh, I wonder what this button does! | 2.6 s |
| `voice.attack-3` | Fire in the hole! Probably! | 3.3 s |
| `voice.attack-4` | This should not work... It's working! It's WORKING! | 4.3 s |
| `voice.price-tag-1` | Everything must go! | 1.8 s |
| `voice.price-tag-2` | Marked down! | 1.4 s |
| `voice.site-survey-1` | Go fetch! | 1.1 s |
| `voice.site-survey-2` | Eyes up, buddy! | 1.1 s |
| `voice.urban-renewal-1` | Fresh START! | 1.5 s |
| `voice.urban-renewal-2` | Redecorating! | 1.6 s |
| `voice.temporary-solution-1` | Good enough! | 1.2 s |
| `voice.temporary-solution-2` | Instant wall! | 1.3 s |
| `voice.heavy-metal-1` | Turn it up! | 1.1 s |
| `voice.heavy-metal-2` | Scrap party! | 1.5 s |
| `voice.pitch-1` | Parts is parts! | 1.4 s |
| `voice.pitch-2` | Waste not! | 1.3 s |
| `voice.hit-light-1` | Ouchie! | 1.1 s |
| `voice.hit-light-2` | Hey! | 0.6 s |
| `voice.hit-heavy-1` | That hurt! | 1.2 s |
| `voice.hit-heavy-2` | Ow, ow, ow! | 2.1 s |
| `voice.hit-shield-1` | Ha, nope! | 1.0 s |
| `voice.hit-shield-2` | Nice try! | 1.6 s |
| `voice.cover-1` | Duck and cover! | 1.1 s |
| `voice.cover-2` | Hiding spot! | 1.1 s |
| `voice.full-cover-1` | Built it myself! | 1.6 s |
| `voice.full-cover-2` | Can't touch this! | 1.4 s |
| `voice.exhausted-1` | I need... a new body. | 2.4 s |
| `voice.exhausted-2` | And a hug. | 1.1 s |
| `voice.victory-1` | Four screws left over. Perfect. | 3.1 s |
| `voice.victory-2` | It worked! IT WORKED! I can't believe it worked! | 4.2 s |
| `voice.victory-3` | Reassembled! Ahead of schedule! | 3.3 s |
| `voice.defeat-1` | It's fine... it's fine... I can fix this. Probably. | 4.1 s |
| `voice.defeat-2` | I'll build a bigger one! Next time! | 2.8 s |

---

## Kit Crosshair (Assassin)

**Who they are.** *"Former syndicate assassin. 'Crosshair' is the cover name from the syndicate days. Why Kit works for a client now (debt, an amnesty, an open bill) stays open on purpose. The name is not tied to a gender."* Motto: *"Nobody asked for my real name. Nobody will."* Kit hides (a Hidden state), so their effects are soft: cloth, padded steps.

**Voice.** ElevenLabs *Oxley - Evil Character* (`2gPFXx8pN3Avh27Dw5Ma`), `stability` 0.5, `similarity_boost` 0.75. (A baritone that is meant to sound menacing; here it is kept **quiet**.)

**What they sound like (my reading).** Quiet, flat and dry; money and debt as the language of a killer ("Everything has a price.", "Bad debt.", "That is a bonus I will not be collecting."). Understatement is the joke; the threat is in how little is said. Short lines, no exclamations.

**Tags they get** (31 lines): `quietly` (9), `calm` (8), `flatly` (8), `dryly` (6), `dry` (4), `pause` (3), `quiet` (3), `softly` (3), `whispering` (1), `matter-of-fact` (1), `annoyed` (1), `wry` (1), `content` (1), `very softly` (1), `almost gentle` (1), `barely audible` (1), `shrug in the voice` (1), `unhurried` (1).
- **The base:** `[quietly]`, `[calm]`, `[flatly]`, `[dryly]` / `[dry]`, `[softly]`, `[matter-of-fact]`.
- **Very low:** `[whispering]`, `[very softly]`, `[barely audible]`, `[almost gentle]` (hiding, vanishing).
- **A shade of attitude:** `[wry]`, `[annoyed]`, `[content]`, `[shrug in the voice]`, `[unhurried]`; `[pause]` for a beat.

**Avoid.**
- *Derived:* **`[shouting]`, `[roars]`** (Max) and **`[giddy]`, `[giggling]`, `[squealing]`, `[sing-song]`** (Tilly). Kit never raises the voice, never laughs out loud and never celebrates.
- *Derived:* exclamation marks and long sentences; a Kit line is a fact.
- *Derived:* `[menacing]` or `[evil]`: the voice is already dark; asking for menace makes it a villain instead of a tired professional.

**All lines with their tags (what was generated):**

| Line id | Line with its tags |
|---|---|
| `select` | [quietly, calm] Nobody asked for my real name. [pause] [flatly] Nobody will. |
| `long_shot_1` | [whispering, calm] Breathe out. It helps. |
| `long_shot_2` | [flatly, quiet] Dead centre. As usual. |
| `vanish_1` | [quietly, dry] I was never here. |
| `vanish_2` | [softly, calm] Don't look for me. |
| `personal_space_1` | [flatly, dry] Personal space. Look it up. |
| `personal_space_2` | [quiet, matter-of-fact] Too close. Let's fix that. |
| `shield_breaker_1` | [dryly, quietly] Armour is a suggestion. |
| `pitch_1` | [flatly] Everything has a price. |
| `pitch_2` | [quietly] No questions asked. |
| `wait_1` | [calm] Patience. |
| `wait_2` | [quietly] I can wait. |
| `hit_light_1` | [dryly] Hm. |
| `hit_light_2` | [flatly] Noted. |
| `hit_heavy_1` | [quietly, annoyed] Sloppy. My mistake. |
| `hit_heavy_2` | [dryly] That will cost you. |
| `hit_hidden_1` | [flatly, dry] So much for subtle. |
| `hit_hidden_2` | [quietly, wry] Well. That's one way to be seen. |
| `hidden_ends_1` | [calm] Spotted. Fine. |
| `hidden_ends_2` | [softly, dry] Hello. |
| `cover_1` | [quietly] Better. |
| `cover_2` | [softly, content] Cosy. |
| `full_cover_1` | [flatly] Try again. |
| `full_cover_2` | [dryly] They always miss. |
| `exhausted_1` | [very softly, almost gentle] Contract terminated. |
| `exhausted_2` | [barely audible, calm] Tell them I was never here. |
| `victory_1` | [flatly, calm] Paid in full. |
| `victory_2` | [dryly] Nothing personal. [pause] Everything billable. |
| `victory_3` | [calm, quiet] Satisfied customers. [pause] Mostly. |
| `defeat_1` | [quietly, shrug in the voice] Bad debt. |
| `defeat_2` | [dryly, unhurried] That is a bonus I will not be collecting. |

**What is in the game now (the picked takes):**

| Id in the game | Spoken text | Length |
|---|---|---|
| `voice.attack-1` | Quiet. | 0.8 s |
| `voice.attack-2` | Clean. | 0.8 s |
| `voice.attack-3` | Noted. | 0.7 s |
| `voice.select` | Nobody asked for my real name. Nobody will. | 3.1 s |
| `voice.long-shot-1` | Breathe out. It helps. | 2.1 s |
| `voice.long-shot-2` | Dead centre. As usual. | 2.0 s |
| `voice.vanish-1` | I was never here. | 1.3 s |
| `voice.vanish-2` | Don't look for me. | 1.1 s |
| `voice.personal-space-1` | Personal space. Look it up. | 2.0 s |
| `voice.personal-space-2` | Too close. Let's fix that. | 2.2 s |
| `voice.shield-breaker-1` | Armour is a suggestion. | 2.1 s |
| `voice.shield-breaker-2` | Hard shell. Soft centre. | 2.2 s |
| `voice.shield-breaker-3` | Let's see what's underneath. | 1.7 s |
| `voice.pitch-1` | Everything has a price. | 1.6 s |
| `voice.pitch-2` | No questions asked. | 1.5 s |
| `voice.pitch-3` | Cards. Organs. Doesn't matter. | 2.8 s |
| `voice.wait-1` | Patience. | 0.9 s |
| `voice.wait-2` | I can wait. | 0.9 s |
| `voice.wait-3` | Patience is a firearm. | 2.2 s |
| `voice.hit-light-1` | Hm. | 0.5 s |
| `voice.hit-light-2` | Noted. | 0.9 s |
| `voice.hit-heavy-1` | Sloppy. My mistake. | 2.1 s |
| `voice.hit-heavy-2` | That will cost you. | 1.6 s |
| `voice.hit-hidden-1` | So much for subtle. | 1.5 s |
| `voice.hit-hidden-2` | Well. That's one way to be seen. | 2.4 s |
| `voice.hidden-ends-1` | Spotted. Fine. | 1.5 s |
| `voice.hidden-ends-2` | Hello. | 0.6 s |
| `voice.cover-1` | Better. | 0.6 s |
| `voice.cover-2` | Cosy. | 0.9 s |
| `voice.full-cover-1` | Try again. | 1.0 s |
| `voice.full-cover-2` | They always miss. | 1.7 s |
| `voice.exhausted-1` | Contract terminated. | 1.5 s |
| `voice.exhausted-2` | Tell them I was never here. | 1.9 s |
| `voice.victory-1` | Paid in full. | 1.1 s |
| `voice.victory-2` | Nothing personal. Everything billable. | 2.8 s |
| `voice.victory-3` | Satisfied customers. Mostly. | 2.6 s |
| `voice.defeat-1` | Bad debt. | 1.7 s |
| `voice.defeat-2` | That is a bonus I will not be collecting. | 3.3 s |

---

## A checklist for a new line
1. **Who says it, and what just happened?** (an attack, a hit, a card, hiding, exhaustion, the end of the match)
2. **Pick one to three tags from that Hero's palette above**, the way of speaking first; add `[short pause]` only for Tilly's punchline or Kit's beat.
3. **One short sentence**, in the Hero's kind of humour (Max: orders and paperwork; Tilly: parts and plans; Kit: price and debt). Under 3.5 s.
4. **Generate several takes** with the Hero's voice and settings, pick, cut the silence, level to about -16 LUFS (the scripts in this folder: `export_*.py`).
5. **Listen for tags that were spoken** (a sound tag like `[barks]`) and for noise at the start; cut or take another.
