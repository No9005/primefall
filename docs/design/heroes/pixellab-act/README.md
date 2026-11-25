# Tilly's act in the hangar, made with Pixellab

The `act` clip of Tilly in the Hero Select (`tilly.act` in `apps/web/public/assets/hangar/atlas/tilly.json`) is not rendered from the rig: it is a 33-frame animation made with Pixellab and finished by hand. The story: Tilly tinkers with her third arm, the claw rips off, she recoils in shock, picks the torn part up and clacks it back on.

| | |
|---|---|
| Frames | `frames/act_00.png` ... `act_32.png`, 64 x 64 px, the scale of the map Hero, the feet at (32, 58) |
| Timing | 33 frames in 3.3 s (10 frames per second), looped like the other `act` clips; it starts and ends in the pose of the map idle |
| Into the atlas | `python3 -I docs/design/heroes/tools/pixellab-act.py` (palette snap, hangar frame 136 x 116 px with the feet at (58, 112), `tolift`, `toidle` and the bridge) |

Run the script **after** `export-hangar.mjs controller` if that was run: the rig export renders its own `act` (27 frames) and the script replaces it. `CLIPS` and `BRIDGES` of `apps/web/src/hangar-select.ts` and the shadow tables of `apps/web/src/hangar-shadows.ts` carry the new counts (33 frames, a bridge of 66 frames: two for each frame of the act, the pose and then the first frame of the ready pose).

## How the frames were made

1. **Reference.** The first frame of the map idle of the Controller (`apps/web/public/assets/heroes/controller/idle.json`, frame `controller.idle.000`), cropped to 64 x 64 px (x 26 to 90, y 28 to 92 of the 136 x 104 frame) on the grey `#535062`. This is the figure of the rig, so Pixellab continues its style.
2. **Pixellab `animate-with-text-v3`**, 64 x 64 px, `no_background`, seed 7, 16 frames per call, two calls:
   - A (tinker, rip, shock): first frame the reference. Action: Tilly reaches up behind her shoulder and tinkers with the big gripper arm on her back; a spark; the claw segment snaps off and drops; her body recoils with a shock (head back, eyes wide, mouth open, shoulders up, knees bent); the torn segment clatters on the ground beside her feet.
   - B (pick up, put back): first frame the last frame of A, last frame the reference (so that the clip ends in the idle pose). Action: she freezes one beat, crouches and snatches the torn segment, looks at it, swings it up behind her back, jams it onto the stump; a clack and a spark; she breathes out and stands calm.
   - Both prompts name the arm: "Her right arm (on the left of the picture) is a grey metal robot arm: a square shoulder block and a gripper hand with a teal light. It stays metal in every frame. When she shrugs, the square shoulder block jerks up with her shoulders and the gripper swings loosely, a frame later. Her other arm is human."
3. **Arm of the first pass.** A first pass without that sentence gave the robot arm as a human forearm in some frames. The robot-arm strip of the second pass (x 0 to 28, y 32 to 54 of every frame, without its pale yellow flash pixels) was copied into the frames of the first pass, then the remaining skin-coloured pixels of that arm (x under 30, y 31 to 57) were set to the metal greys of the hand.
4. **Idle arm.** The rig's idle draws the third arm as a straight pole; the script replaces it with the arched arm of the first act frame (moved with the head of each idle frame), so the idle and the act show the same arm, down to its first joint. The arm trails the head by three frames and sways a pixel of its own; both fade out towards the first frame, so `tolift`, `toidle` and the end of `desel` meet it exactly. Every animation that uses an idle frame (`tolift`, `toidle`, the end of `desel`) gets the arched frame.
5. **Desel.** The rig's `desel` runs from the hold pose (arm bent up) to the idle with a straight pole. The script keeps frame 0, clears the pole in the frames between and swings the forearm and claw of the arched arm about the elbow from the angle of the hold pose down to the idle arch (frames 1 to 13, with a small dip below it for follow-through; `DESEL_SWING`); the last frame is the arched idle.
6. **Bridge.** The bridge from a moment of the act into the ready pose is the pose, then a dithered half-and-half mix of it with the ready pose, then the ready pose begins (`tolift` and `toidle` stay two frames: a dither between nearly equal poses only speckles the arm).
7. **Palette.** The script snaps every pixel to the 23 colours of the rig's Tilly (the colours of the atlas used at least 300 times, close shades merged) and makes the alpha binary.

Credits: a 64 x 64 px call costs one generation of the trial plan.

## Known gaps (against `docs/design/animation-criteria.md`)

- 10 frames per second: the beats (rip, clack) are stepped; there is no anticipation in front of the rip beyond the tinkering.
- The pose at the start is the map idle, not the hangar idle (`tolift` and `toidle` are two frames and bridge the difference).
- The torn segment on the ground is small; the clack in B is a bright flash, not yet in the teal of the Controller.
- No split body; no hit stop.
