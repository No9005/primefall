# Tilly's act in the hangar, made with Pixellab

The `act` clip of Tilly in the Hero Select (`tilly.act` in `apps/web/public/assets/hangar/atlas/tilly.json`) is not rendered from the rig: it is a 33-frame animation made with Pixellab and finished by hand. The story: Tilly tinkers with her third arm, the claw rips off, she recoils in shock, picks the torn part up and clacks it back on. This page is the record of how it was made, so that the next clip can be made the same way (and so that nobody pays for a take that is already here).

| | |
|---|---|
| Frames | `frames/act_00.png` ... `act_32.png`, 64 x 64 px, the scale of the map Hero, the feet at (32, 58) |
| Timing | 33 frames in 3.3 s (10 frames per second), looped like the other `act` clips; it starts and ends in the pose of the map idle |
| Reference | `reference.png` (what Pixellab was given: the first frame of the map idle on grey) and `reference-transparent.png` |
| Raw takes | `raw/pass1/` and `raw/pass2/`: per pass 17 frames of call A (`a_00` to `a_16`) and 17 of call B (`b_00` to `b_16`), as Pixellab returned them |
| Tools | `tools/generate.py` (the two calls), `tools/build-frames.py` (raw takes to `frames/`, `--check` proves it), `../tools/pixellab-act.py` (frames into the hangar atlas) |

```
python3 -I docs/design/heroes/pixellab-act/tools/build-frames.py --check   # frames/ equals what the raw takes give
python3 -I docs/design/heroes/tools/pixellab-act.py                        # frames/ into apps/web/public/assets/hangar/atlas/tilly.*
```

Run the second script **after** `export-hangar.mjs controller` if that was run: the rig export renders its own `act` (27 frames), its straight-pole idle and its own `tolift`, `toidle` and `desel`, and the script replaces or reworks them. `CLIPS` and `BRIDGES` of `apps/web/src/hangar-select.ts` and the shadow tables of `apps/web/src/hangar-shadows.ts` carry the counts of the result (33 frames, a bridge of 66 frames).

## Working with Pixellab: what to do and what we learned

**Give it the figure at the size the game draws it.** The first try used the large reference picture of Tilly (1254 x 1890 px, mirrored to face right) scaled to 144 x 216 px. It worked (the figure held for 17 frames) but the body on the map is only 35 x 51 px, so everything fine was lost there, and one call cost 8 generations. The second try gave Pixellab the **first frame of the rig's own idle at its real size** (cropped to 64 x 64 px, x 26 to 90, y 28 to 92 of the 136 x 104 frame, on the grey `#535062`). Pixellab then draws in the same pixel grid and palette as the map, and a call costs 1 generation.

**The call.** `POST https://api.pixellab.ai/v2/animate-with-text-v3` with `first_frame`, an `action` text, `frame_count` 16, `no_background` true, a fixed `seed` (7). It answers with a job id; poll `GET /v2/background-jobs/{id}` every 5 s (about 40 s). Limits: the action text has at most 1000 characters (else 422), the frame count is 4 to 16 and even, `width x height x frames` is at most 524288. The answer has 17 frames: the first one is the frame that was sent.

**Chain calls for a longer story.** 16 frames are 1.6 s at 10 frames per second, too short for rip, shock, pick up and put back. So call B starts on the last frame of A (`first_frame`) and gets the reference as `last_frame`, which steers it back into the idle pose, so the clip ends where it began. The last frame of A and the first of B are the same picture; keep it once (33 frames, not 34).

**What the prompt must say.**
- Name the parts that matter and what they look like. Pixellab drew the robot arm as a human forearm in some frames until the prompt said "a grey metal robot arm: a square shoulder block and a gripper hand with a teal light. It stays metal in every frame."
- **Left and right.** Tilly's right arm is the robot arm, and on a figure that faces the camera that is the **left side of the picture**. Mirroring a picture swaps the sides: the mirrored Pixellab reference had the robot arm on her left. Say which side in picture terms ("on the left of the picture"), and check the sides in the result.
- Say what does not change ("Keep outline and palette") and ask for the animation principles of `docs/design/animation-criteria.md` in words: anticipation, squash and stretch, follow-through ("the gripper swings loosely, a frame later").
- The first frame comes back as it was sent, with the grey background (the transparent pixels were put on grey for the call). Make the grey transparent again.

**Check every pass before building on it.** Contact sheets at 6x, then the whole clip played at 10 frames per second (a throw-away page that plays the frames or the atlas is enough). What was wrong with the first pass: the robot arm was a human forearm in some frames, and the flash of the clack came out in pale yellow, which the palette snap turns into the rig's whites.

## How the frames were made

1. **Pass 1** (reference as above, the prompts below without the sentence about the arm): a clip that told the story but with the robot arm turning human in some frames.
2. **Pass 2** (the same calls with the sentence about the arm, `tools/generate.py` is this pass): the robot arm held in nearly all frames, but the hair and the face varied more from frame to frame than in pass 1.
3. **The two were joined** (`tools/build-frames.py`): the robot-arm strip of pass 2 (x 0 to 28, y 32 to 54 of every frame, without the pale yellow pixels of the flash that reaches into it) was copied into the frames of pass 1, and the skin-coloured pixels that remained on the robot arm (x under 30, y 31 to 57) were set to the metal greys of the hand. The first frame is the reference on grey; the grey is made transparent.
4. **Into the atlas** (`../tools/pixellab-act.py`):
   - every pixel is snapped to the 23 colours of the rig's Tilly (the colours of the atlas that are used at least 300 times, close shades merged), the alpha is binary;
   - the frames are set into the hangar frame (136 x 116 px, feet at (58, 112));
   - act frame 31: the glove of the right arm was in light greys (`ODD_HAND`), the frames around it have it dark; the greys are mapped to the dark ones;
   - **idle**: the rig's idle draws the third arm as a straight pole, the act as an arch; the arched arm is put into every idle frame (arm and first joint), moved with the head. The arm trails the head by three frames and sways a pixel of its own; both fade out towards the first frame, so `tolift`, `toidle` and the end of `desel` meet it exactly;
   - `tolift` and `toidle` lead to and from the first and last frame of the act (both nearly the same pose as the idle, so no in-between frames);
   - **desel**: the rig's `desel` runs from the hold pose (arm bent up) to the straight pole; the script keeps frame 0, clears the pole in the frames between and swings the forearm and claw of the arched arm about the elbow from the angle of the hold pose down into the arch (frames 1 to 13, a small dip below it for follow-through; `DESEL_SWING`), and the last frame is the arched idle;
   - **bridge** (a tap in the middle of the act): the pose of the act, then one in-between frame, then the ready pose begins. The in-between frame is the ready pose two pixels up (a small hop of surprise, the same frame for every moment). A dithered half-and-half mix of the two poses was tried first and read as a checker pattern over the figure, so it was dropped.
5. **The tables** `CLIPS`, `BRIDGES` and the contact shadows (`hangar-shadows.ts`) carry the new counts; the feet stand still in the act, so its shadow is one run at the idle spot.

Costs (trial plan, generations): with the large picture, 8 per call (the idle try and its loop try, 16 in all). At 64 x 64 px, 1 per call: pass 1 two calls, pass 2 two calls, and one call whose result was thrown away because it had been made for the wrong arm. In total about 22 of the 40 generations of the trial plan.

## The prompts

Pass 2 (and `tools/generate.py`), 840 and 723 characters:

- **A**: "Pixel art, side view, facing right, feet planted. Tilly reaches up and tinkers with the big gripper arm on her back, small jerky adjustments, a spark flickers. Then with a sharp snap the outer claw segment rips off and drops. Anticipation first, then the snap: her whole body recoils, head jerks back, eyes wide in shock, mouth open, shoulders shrug up, knees bend. The torn segment clatters on the ground beside her feet with dust and sparks. The stump on her back swings. *[arm sentence]* Strong squash and stretch, no blur. Keep outline and palette."
- **B**: "Pixel art, same character. Still in shock, Tilly freezes one beat, then crouches fast and snatches the torn gripper segment from the ground, looks at it, swings it up behind her back and jams it onto the stump. A hard clack, a bright spark, the arm shakes and settles. She breathes out, shoulders drop, and returns to her calm standing pose of the last frame. *[arm sentence]* Snappy, follow-through. Keep outline and palette. No blur." (first frame: the last frame of A, last frame: the reference)
- **arm sentence**: "Her right arm (on the left of the picture) is a grey metal robot arm: a square shoulder block and a gripper hand with a teal light. It stays metal in every frame. When she shrugs, the square shoulder block jerks up with her shoulders and the gripper swings loosely, a frame later. Her other arm is human."

Pass 1 (883 characters for A; B is the text of B above with "Tilly freezes for one beat, then dives", "holds it up and looks at it", "Fast, snappy, exaggerated motion with follow-through: the gripper arm bounces and settles a few frames after her body." and no arm sentence): A read "Pixel art character animation, side view, facing right, feet planted. Tilly reaches up behind her shoulder and tinkers with the big mechanical gripper arm on her back: small jerky adjustments, head tilted up, tongue of concentration. She twists a joint of the arm, a spark flickers, then with a sharp snap the outer forearm and claw segment rips off and drops past her shoulder. Anticipation first: a short wind-up pull, then the snap. At the snap her whole body recoils: head jerks back, eyes wide open in full shock, mouth open, shoulders up, knees bend, hands fly out to the sides. The torn segment falls and clatters on the ground beside her feet, a puff of dust and two sparks. The stump of the arm on her back hangs loose and swings. Exaggerated, heavy, hand-drawn pixel animation, strong squash and stretch, no blur. Keep the outline, palette and proportions of the reference."

Seed 7 in all calls.

## Known gaps (against `docs/design/animation-criteria.md`)

- 10 frames per second: the beats (rip, clack) are stepped; there is no anticipation in front of the rip beyond the tinkering.
- The pose at the start is the map idle, not the hangar idle (`tolift` and `toidle` are two frames and bridge the difference).
- The torn segment on the ground is small; the clack in B is a bright flash, not yet in the teal of the Controller.
- The start of the selection from the idle (`selecti`, `select`) still begins with the arm of the rig's pose and was not looked at against the arched idle arm.
- No split body; no hit stop.
