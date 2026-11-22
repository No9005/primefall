# Animation criteria

What a good, deliberately exaggerated animation in Primefall has. The bar is the hand-drawn pixel animation of *Metal Slug*. The format, timing and rig numbers are in `docs/design/animation/README.md` and `docs/design/pixel-heroes/README.md`; this page is the checklist a clip is judged against. Check a finished clip against every point and name which are met.

## Criteria

1. **Density.** Many frames, no robotic motion. A Hero clip runs at 20 fps with 40 to 110 frames per clip; a step cycle has 10 to 13. Even the idle breathes in smooth transitions. In-betweens count: small motion between the main poses is drawn, not skipped to save frames.
2. **Classic animation principles, pushed.**
   - **Anticipation:** a wind-up before the action (before a throw, a shot, a slam). It gives feedback and makes the action heavy.
   - **Squash and stretch:** bodies and gear deform on jumps, landings and hits, and spring back (a landing presses together, then rebounds).
   - **Follow-through and overlapping action:** when a Hero stops abruptly, loose parts (cape, sash, straps, the third arm, a cigar) keep moving for a few frames and settle later than the body.
3. **Split body.** Legs and upper body move independently: the legs keep a smooth walk or jump while the upper body aims, reloads or throws. A clip that restarts the legs because the arms changed is wrong.
4. **Asynchronous detail.** The world moves out of step: small independent animations (a flickering lamp, a venting pipe, a drone, a Hero in idle doing its own small action) run on their own timing, never in lockstep.
5. **Weight and secondary reaction.** An impact has layers: a bright flash, debris on its own paths, sparks, smoke that lingers. A hit is more than a white blink: single plates shake, parts fly, smoke rises from the damaged spot. A short **hit stop** (the picture holds for a few frames at the moment of impact) gives a shot or a slam its weight.
6. **Exaggeration is deliberate.** Amplitudes are pushed past the reference on purpose (see `pixel-heroes/README.md`), but the beats and durations of `docs/design/animation/README.md` hold.

## Rules from the chat (owner)

- **Heroes never overlap each other in the Hero Select.** When one Hero is chosen and plays its select clip (Max throws his bar against the wall), its picture and effects stay inside its own space and do not run over a neighbour (Max and Tilly overlapped once). A clip is checked next to the neighbouring Heroes, not alone.
- Contact shadows follow the frames: under the feet, gone while the Hero is in the air, back when the feet touch the ground. A Hero sitting on an object (Kit on the crate) casts the shadow on that object. A ring around the feet is never drawn through an object it would lie behind.
- A moving thing points the way it flies: a comet's thin end trails behind it, the head leads.

## How the clips of today measure up (audit of the sources, 2026-11-22)

Checked in the rig files (`docs/design/pixel-heroes/tools/rigs/*.js`) and `clips.json`; **not** judged by watching every clip in motion.

| Criterion | State |
|---|---|
| 1 Density | Met in count: 40 to 110 frames per clip at 20 fps, walk 10 to 13. But the in-betweens are **computed** by rotating and scaling parts (the rig), not drawn by hand; edges show steps and the Assassin's cape is one stiff part (`pixel-heroes/README.md`, Quality). |
| 2 Anticipation, squash, follow-through | Present in the rigs: keyframes with ease-out and back easing, `stretch` values such as 1.18 and 0.9 on a hit, the cape and the sash lag behind the body (`wave(t - 120, …)`). Strongest for the Assassin; **not verified clip by clip** for Max and Tilly. |
| 3 Split body | **Not met as a system.** Each clip is one rig with legs and upper body keyed together; there is no separate legs layer that keeps walking under an action. Today a Hero stands still for an action. |
| 4 Asynchronous detail | Partly: the hangar idles of the three Heroes run on their own timing (Max 2.0 s, Tilly 2.0 s, Kit 3.6 s) and the lights flicker on their own. The board effects are in step with the Tick. |
| 5 Weight, hit stop | Hits have shake and a ring flash (`shake`, `ringRedFrames`); **no hit stop** (a short freeze at the impact) is built; debris and smoke layers are limited to what `fx_back` and `fx_front` carry. |
| Heroes not overlapping | **Not checked** by an agent; reported by the owner for Max and Tilly in the Hero Select. Open. |

Gaps 3 and 5 and the overlap are the work to do before the clips count as meeting the criteria.
