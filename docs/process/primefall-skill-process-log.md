# Primefall Skill Process Log

This document records how the Primefall design process used the Claude skills in `.claude/skills/`. It is intended as a reference for later revisions of the skills or for creating a meta skill.

## Environment

- **Model:** Perplexity (Perplexity AI assistant)
- **Interface:** Perplexity mobile app chat
- **Repository:** `no9005/primefall`
- **Working branch:** `docs/offline-mvp-spec`
- **Base branch:** `main`

All steps below were executed by Perplexity in a Perplexity mobile app chat.

## ADR origins

### ADRs 0001–0016

All ADRs, 0001 through 0016, were created within the same Perplexity mobile app chat. However, Perplexity appears to have started a new session at some point during that chat.

There appears to be a mechanism that transferred older information from the chat into the new session. This allowed the design context, prior decisions, and the ADR numbering to remain available after the session boundary.

From the user’s verifiable perspective:

- ADRs 0001–0016 were produced in the same chat.
- The chat spanned at least one internal session boundary.
- Older conversation information was carried into the later session.
- ADR 0016 was created in the later part of the chat, after the map-layout discussion.

The exact internal mechanism is not documented here. It may involve conversation-context transfer, session continuation, or another Perplexity-specific behaviour.

### ADR 0016

ADR 0016 – Reactor Deck Map was created in this chat session.

It emerged from a `grill-with-docs` session that used `grilling` and `domain-modeling` to clarify the first map layout. The discussion moved through the following decision rounds:

1. **Map theme and layout:** The first map should be a spaceship, specifically the Reactor Deck.
2. **Map orientation:** The map must be horizontal, with one Squad spawning on the left edge and the other on the right edge.
3. **Symmetry and routes:** The map is mirror-symmetric, with main routes at least two tiles wide.
4. **Prime Zone:** The central objective is a 3 by 3 reactor area with no permanent Cover.
5. **Overwatch Nest:** There is exactly one Full Cover Overwatch Nest with a limited sightline into the Prime Zone.
6. **Cover distribution:** Side corridors provide Cover for movement and retreat, but no permanent safe sightlines into the Prime Zone.
7. **Spawns and scouting:** Both Squads spawn on opposite horizontal edges without direct Line of Sight into the Prime Zone, encouraging early scouting.
8. **Prototype boundaries:** No interactive doors and no vertical levels in the first prototype.

After the user confirmed the frontier decisions, ADR 0016 was created and later revised to use the horizontal 20 by 12 layout.

## Skills used

| Skill | When | Purpose |
|---|---|---|
| `grill-with-docs` | Start of the map-layout discussion | Ran `grilling` and `domain-modeling` to stress-test the map design and create ADR 0016 and glossary entries as decisions crystallised |
| `grilling` | Throughout the map and tech discussions | Interviewed in rounds, mapped a design tree, asked only frontier questions, and recorded recommendations |
| `domain-modeling` | Throughout ADR and glossary work | Sharpened terminology, audited existing ADRs, and maintained `GLOSSARY.md` |
| `to-spec` | After the design tree reached a shared understanding | Synthesised the conversation into `docs/specs/offline-mvp-prototype.md` |

## Process timeline

### 1. Map layout discussion

**Skill:** `grill-with-docs` (via `grilling` and `domain-modeling`)

**Clarified:**

- The first map should be a spaceship: the Reactor Deck.
- The map is horizontally oriented: one Squad spawns on the left edge, the other on the right edge.
- The map is mirror-symmetric.
- Main routes are at least two tiles wide.
- The Prime Zone is a 3 by 3 reactor area.
- The Prime Zone contains no permanent Cover.
- There is exactly one Overwatch Nest with Full Cover and a limited sightline into the Prime Zone.
- Side corridors provide Cover for movement and retreat but no permanent safe sightlines into the Prime Zone.
- Doors are represented as walls or Full Cover; interactive doors are out of scope for the MVP.

**Output:**

- ADR 0016 – Reactor Deck Map.
- Updated ADR 0008 – Grid, Movement, and Ranged Attacks to a 20 by 12 grid.
- Glossary updates for Grid, Overwatch Nest, and Reactor Deck.

### 2. ADR audit

**Skill:** `domain-modeling`

**Clarified:**

- All 16 ADRs were checked against the ADR format: short title, context, decision, and rationale.
- The Glossary was updated from a 16 by 10 Grid to a 20 by 12 Grid.
- Missing glossary terms were added: Ghost, Visible, Unknown, Tick, Slow, Knockback, Long Shot, Overwatch Nest, and Reactor Deck.
- Terminology was aligned: “Death” and “living” were replaced with “Exhaustion” and “non-exhausted”.
- ADR 0011 was revised to remove the contradictory Hero Death rule and align Squad loss with Deck-as-Life.
- ADR 0015 was kept as a decision record, while the complete card list moved to a separate spec.
- Decision rationales were added to ADR 0006, 0007, 0008, 0009, 0010, 0014, and 0015.

**Output:**

- Updated `GLOSSARY.md`.
- Updated ADR 0010, 0011, 0013, and 0015.
- Decision rationales in seven ADRs.

### 3. Technology discussion

**Skill:** `grilling`

**Clarified:**

- PixiJS v8 is the rendering layer.
- Matter.js is not needed for the MVP because Primefall uses tile-based movement, Line of Sight, Cover, and deterministic combat.
- Colyseus is the intended server-authoritative multiplayer framework for a later phase.
- The complete simulation should live in a shared rules package used by both client preview and server resolution.
- Phaser is a viable alternative but was not chosen as the primary engine because its game-loop and physics-first assumptions fit less cleanly with a turn-based, server-authoritative model.

**Output:**

- Decisions recorded in the conversation and reflected in the MVP spec.

### 4. Spec creation

**Skill:** `to-spec`

**Clarified:**

- The first spec covers the Offline MVP Prototype: 3v3, Reactor Deck, three Hero classes, simultaneous planning, Priority Resolution, Fog of War, and AI opponents.
- The authoritative Match Simulation is the primary test seam.
- The spec is stored as a Markdown document under `docs/specs/`, not published to a GitHub Issue.
- The Card Set remains a separate, authoritative reference document.

**Output:**

- `docs/specs/offline-mvp-prototype.md`.

### 5. Card set consolidation

**Skill:** `domain-modeling`

**Clarified:**

- The Card Set Spec was moved from `docs/spec/mvp-card-set.md` to `docs/specs/mvp-card-set.md` without changing its content.
- The Offline MVP Prototype Spec references the Card Set Spec as the authoritative source for card effects, Energy costs, and Overdrive modes.
- ADR 0015 references the new Card Set Spec location.
- The old `docs/spec/` location was removed.

**Output:**

- `docs/specs/mvp-card-set.md`.
- Updated references in the Prototype Spec and ADR 0015.
- Removed old Card Set Spec location.

## Skill observations

### grill-with-docs

Strengths:

- Produced a clear design tree with numbered frontier questions.
- Kept decisions with the user while facts were researched independently.
- Created ADRs and glossary entries as decisions crystallised.

Improvement ideas:

- Make the ADR and glossary update steps more explicit in the skill instructions.
- Add a rule that a Status section is only added when an ADR is revisited.
- Add a rule that implementation details belong in specs, not the glossary.

### to-spec

Strengths:

- Synthesised the conversation without re-interviewing the user.
- Produced a structured spec with problem, solution, user stories, decisions, testing, and scope.

Improvement ideas:

- Clarify how to handle multiple candidate specs from one long conversation.
- Add explicit guidance for linking supporting specs, such as a Card Set Spec.
- Clarify the output location when the project prefers Markdown files over issue-tracker entries.

### Meta skill idea

A future meta skill could orchestrate the full flow:

1. Run `grill-with-docs` to clarify the design.
2. Maintain `GLOSSARY.md` inline.
3. Create or update ADRs only when the three ADR criteria are met.
4. Run `to-spec` to synthesise the settled design into a spec.
5. Store the spec under `docs/specs/` as Markdown.
6. Cross-reference the spec, ADRs, and glossary.

## Commits

- `2a7f0968` — docs: add horizontal Reactor Deck map ADR
- `a73866b3` — docs: align grid ADR with Reactor Deck map
- `ffc1adcf` — docs: align glossary and ADRs with Reactor Deck audit
- `027d5374` — docs: add decision rationale to ADRs
- `75e309b2` — docs: add offline MVP prototype spec
- `498ad911` — docs: move card set spec into docs/specs
- `0cb6309b` — docs: remove old card set spec location
