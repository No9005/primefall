# Tilly tests (ComfyUI, 2026-11-23 to 2026-11-25)

Every picture made while trying to get Tilly into a more detailed look and into new animations with ComfyUI on one RX 9070 XT. Kept so that the next agent can analyse what was tried and what came out. The game does not read any of it. The tools that made it are in `docs/design/heroes/tools/comfy/` (see its `README.md`, `TESTPLAN.md`, `ANIMATION-OPTIONS.md` and `RESEARCH.md`).

**Every picture carries its workflow.** ComfyUI embeds the whole graph (models, LoRAs, seed, denoise, ControlNet and IP-Adapter settings, both prompts) in the png. Read it with `node docs/design/heroes/tools/comfy/eval/png-settings.mjs <png> ...`. File names alone do not tell the settings: ComfyUI numbers repeated runs (`_00001_`, `_00002_`) and the same label was run with several workflows.

## `early-restyle-and-controlnet/` (about 33 MB)

The first rounds, all SDXL base with the pixel-art LoRA, starting from the **rig's** Tilly (the map figure), not from text. Labels come from `tilly-poses.mjs` (`<pose>-<frame>-big|small_<run>_.png`, big is 1024 px, small is 1/8):

| Files | What | Verdict |
|---|---|---|
| `pose_0000N_`, `pose-small_*` | `tilly-pose-inpaint.json`: plain SDXL inpainting of the rig figure with a mask. 1: a huge mask, the model painted a whole new figure beside her. 2 and 3: a small mask around the third arm, the model erased the arm | does not place a limb |
| `cn_00001_`, `cn-small_*` | first run of `tilly-pose-controlnet.json` (inpaint UNet, IP-Adapter, ControlNet union, pose `pulse:620`) | **neon colours: made while ComfyUI ran without `--fp32-vae --disable-dynamic-vram`**, see `start-comfyui.sh`; not a valid result of the workflow |
| `pulse-620-*`, `tag-730-*`, `act-13-big_00001_`, `act-13-big_00002_` | `tilly-pose-controlnet.json` after the fix, pose from the rig (`rig:pulse:620`, `rig:tag:730`, `hangar:act:13`) | pose roughly followed, look only approximately Tilly's (shorter, chunkier), the raised third arm of `act-13` came out with the arm down and a grey ghost of the guide beside her |
| `idle-<n>-big_*` (40 frames, and `idle-0` four times) | `tilly-restyle.json` Look D (denoise 0.75, ControlNet tile 0.9 to 1.0, seed 1, no IP-Adapter): the rig's hangar idle dressed in the detailed look | consistent figure, frame-to-frame change about 1.3 times the rig's, loop seam small |
| `act-<n>-big_*`, `act-<n>-small_*` (27 frames) | the same restyle for the **first rebuild of the hangar `act` in the rig** (not the original strip's choreography), figure layer only | change 1.2 times the rig's; the third arm complete in all frames. The choreography was then found to differ from the original (see `ANIMATION-OPTIONS.md`) |
| `origact-<n>-*` (about 11 frames) | the same restyle of the **original** hangar `act` strip (`original-hangar-strips/tilly-act.png`), stopped by the owner because the strip's own figure has wrong arms | not usable |
| `tilly-look-from-rig/` | four candidates of the look from one rig frame: A denoise 0.5, B 0.65, C `pixel-art-16bit` LoRA 0.65, D 0.75 with a strong ControlNet | the shapes and colours stay Tilly's, the detail gain is moderate. D was chosen for the idle and act tests |

## `step1-looks-from-description/` (about 8 MB)

Test plan step 1: text to image from the description alone (`tilly-looks.mjs`, SDXL base, LoRA `pixel-art-xl`, 1024 x 1024, 30 steps, `dpmpp_2m` / `karras`), four seeds each (11, 22, 33, 44), contact sheets `round1-sheet.png` and `round2-sheet.png`.

- `round1/`: plain wording. Detailed pixel-art style, but no third arm, a cannon where the robot arm should be in two pictures, mostly teal clothes, the magenta page ignored (grey). Candidate D shows two views.
- `round2/`: key parts weighted, teal cut down. Worse: technical armour, cropped bodies, magenta in the clothes.

## `step2-adding-parts/` (about 7 MB)

Starting from a picture the owner picked: `00-base.png`, a plain SDXL text-to-image result of the `tilly-restyle.json` prompt (seed 1, base UNet; it shows a woman with a gun and a robot beside her). The owner asked to add what was missing: torn clothes, the robot arm and the third arm.

| Files | What |
|---|---|
| `01-no-robot.png`, `02-no-shadow.png` (and `02-no-shadow-feet.png`) | the robot beside her and the floor shadow filled with the page colour (`eval/fill.mjs`). A first try with inpainting painted a second person into the hole (that picture was overwritten and is not kept) |
| `03-robotarm-*` and sheet | inpaint only (SDXL inpainting UNet) at the arm: teal blobs, a crystal, a human arm |
| `04-sketch.png` | rough grey sketch of the robot arm and the third arm (`eval/paint.mjs`) |
| `05-refined-*` and sheet | the sketch refined by inpainting at denoise 0.62: the third arm becomes a plain tube without segments or claw, the robot arm vanishes |
| `06-refined40-*` and sheet | refined at denoise 0.4: the sketch survives and gets hardly any detail |

The exact calls are in `docs/design/heroes/tools/comfy/step2-add-parts.sh`. Torn clothes were not done.

## `step3-klein-edit/` (FLUX.2 klein 4B image edit, the first result worth keeping)

Test plan step 1 again, now with the community's way (RESEARCH.md): the ComfyUI gallery template `image_flux2_klein_image_edit_4b_distilled` (the branch with one input picture: slots `76.image`, `75.text`, `75.noise_seed`; models `flux-2-klein-4b-fp8`, `qwen_3_4b`, `flux2-vae`; 4 steps, about 15 s per picture, VRAM in use peaked at about 13.2 GB of 17.1 GB incl. the desktop). The reference picture is `step2-adding-parts/01-no-robot.png` (the owner's base picture, robot taken out). Seed 1 everywhere, one edit per prompt:

| File | Prompt (shortened) | Result |
|---|---|---|
| `arm3-a_00001_.png` | add a long mechanical grey arm with three segments, teal glowing joints and a pincer, rising from behind her right shoulder | a detailed third arm with segments, teal joints and a claw; the character unchanged |
| `robotarm-a_00001_.png` | replace the gun and her right arm with a grey robotic arm of segmented plates with teal joints and a claw hand | a robotic arm with a metal fist; side effect: a grey cuff appeared on her other forearm |
| `torn-a_00001_.png` | make the jacket sleeves and the trousers frayed and torn | ragged hems, rips and patches on the trousers, slightly frayed cuffs |
| `chain2-a_00001_.png` | `torn` then the robot arm (the prompt now says her other arm stays bare) | torn trousers and the robot arm, the other arm bare |
| `chain3-a_00001_.png` | `chain2` then the third arm | the third arm is there, **but the robot arm is gone again**, and the colours drift a little with every edit |
| **`all-a_00001_.png`** | all three changes in **one** prompt (robot arm, third arm, torn clothes, other arm stays bare) | **all three at once**; face, hair and jacket the same; the third arm is thick and ends in a hand with three or four fingers, not a two-pronged pincer |

Read the exact prompts with `png-settings.mjs` (the png carries the template's graph). Lessons: one prompt with all changes beats a chain of edits (a later edit can undo an earlier one, and the colours drift); name what must stay (the other arm, face, hair); the edit model keeps the character where the SDXL passes did not.

## `step4-klein-variants/` (three directions for the refined picture)

The owner's notes on `step3-klein-edit/all-a_00001_.png`: keep the gun of the original (it is needed for her shooting animations); the robot hand looked like a glove, the whole arm from the shoulder should be robotic; the third arm looked as if it came out of her backside, it should come out of her upper back, be more filigree and look put together from scrap. Same template and reference (`step2-adding-parts/01-no-robot.png`, which still has the gun), one prompt with all changes, three third-arm directions. `variants-sheet.png` shows them side by side.

| File | Third arm | Robot arm and gun | Other arm |
|---|---|---|---|
| `v1-scrap-pipes_00001_.png` (seed 1) | thin, curving over her head, pipes and cables with a wrench-like pincer at the end; from her upper back | whole arm robotic, gun held | gets a robotic cuff (not wanted) |
| `v2-tools-and-hose_00001_.png` (seed 2) | a rusty wrench on a hose and a bent pipe, strapped to her back; clean and readable | whole arm robotic, gun held | bare (as asked) |
| `v3-pistons-harness_00001_.png` (seed 3) | hydraulic pistons and cables on a harness, but **three** appendages (a second one reaches forward, a small hand with a pointing finger appears on the left) | whole arm robotic, gun held | bare |

The prompts are readable with `png-settings.mjs`.

## `step5-klein-robot-third-arm/` (gun in the left hand, a third arm that reads as a robot arm)

The owner's notes on `step4-klein-variants/`: the gun goes into her **left** hand (the right of the picture); the robotic right arm (the left of the picture) is fine; the third arm is not in the direction it should take: it must be recognisable as a **robot arm** (pipes, a wrench and a hose were not), still thin and put together from scrap. Same template, reference and **the same seed 1** for all three, so that prompt and chance can be told apart. One prompt with all changes (robotic right arm hanging relaxed with an open hand, gun moved to the other hand, a thin robot arm out of her upper back, torn trousers). `variants-sheet.png` shows them.

| File | Third arm | Reading |
|---|---|---|
| `w1-servo-segments_00001_.png` | thin metal segments, round ball joints with small servos, a two-pronged pincer | clearly a robot arm and the most filigree; reads a little like a trident on a stick, not much scrap |
| `w2-scrap-robot_00001_.png` | a boxy rusty segment with exposed wiring, a mechanical joint, a two-pronged claw | the scrap look; boxy and thicker |
| `w3-insect-leg-robot_00001_.png` | a thin jointed arm holding a rusty block with prongs | odd: the end is a block, not a hand |

In all three the gun is in her left hand, but it is much **smaller** than the original's (a pistol held low by the hip), and the robotic right arm hangs relaxed with an open hand.

## `step6-klein-scrap-arm-and-gun/` (a longer jointed scrap arm, the gun in the bare hand)

The owner's notes on `step5-klein-robot-third-arm/`: W2 (the scrap robot) is the better third arm, but it shows no joints to move it with, it should be longer (it extends Tilly's reach), and in the wait position it should go over her head. `00-base-padded.png` is the base picture with 320 px of extra room above (made with `eval/pad.mjs`; the edit scales to 1.4 megapixels: slot `75/80.megapixels`), otherwise an arm that arches over her head would be cut off. Results are 1056 x 1376.

| File | What |
|---|---|
| `x1`, `x2`, `x3-jointed-long_00001_.png` (seeds 1, 2, 3) | the same prompt: a long scrap robot arm out of the upper back with a ball joint on a mounting plate at the shoulder, an elbow with an exposed servo and a hydraulic piston, a wrist joint and a two-pronged pincer, rusty mismatched parts with welds, bolts and wiring, longer than her torso, arching over her head. **x2 is the best** (longest, clear joints, a pincer at the end); x1 ends in a rusty disc with claws, x3 in a robotic hand with fingers. In all three the gun was lost from her left hand (x1 and x3: in the robotic hand, x2: gone) |
| `g1`, `g2-gun-left_00001_.png` | an edit of x2 that puts a rifle "in her left hand": the model reads "left" as the robotic hand (g1) or puts a gun in both hands (g2) |
| **`h1-gun-right-of-image_00001_.png`** | the same edit with the **side of the picture** instead of "her left": the robotic hand on the left of the picture empty and open, one gun in the bare hand on the right of the picture. The long scrap arm stays untouched. **The current best picture** |
| `h2-gun-right-of-image_00001_.png` | seed 2 of that prompt: again a gun in both hands |

Lessons: name the side by the picture, not by her left or right; a follow-up edit that says "change nothing else" keeps the rest (the arm stayed identical); leave room around the figure when something has to reach beyond the old frame.

**The original gun** (the owner's requirement: it is needed for her shooting animations, and it belongs in her left hand, the right of the picture). `h1` has a compact rifle, not the original. Tries to bring the original in:

| File | Way | Result |
|---|---|---|
| `gun-a1`, `gun-a2` | the template's two-picture branch (nodes 92 and 94 un-bypassed, 75 and 9 bypassed): image 1 is x2, image 2 the base with the original gun | a1: the original gun, but with the whole human arm of the reference: it replaced her robotic arm on the left of the picture; a2: a small gun in the robotic hand. The model copies the side of the reference |
| `gun-b1`, `gun-b2`, `gun-b3` (reference `00-base-padded-mirrored.png`) | the same, with the reference mirrored so that its gun is on the right of the picture | b1: the original gun with a hand floating beside her, not attached; b2, b3: no gun at all |
| `tilly-reference-v1.png` | **not the model**: the original gun cut out of the base picture pixel for pixel (`step2-adding-parts/01-no-robot.png`, region 40,405,170,250), mirrored, scaled by 1.03125 (the edit result is 1.03125 times the padded base) and pasted onto x2 at 495,858 with `eval/paste.mjs`; the page colour is keyed out | **the current reference picture**: the original gun, in the original size and form, in the bare hand on the right of the picture, held low with the barrel pointing down and to the right; it covers her fingers |
| `gun-c1`, `gun-c2` | an edit pass over that composite: "the hand holds the gun naturally, keep the gun the same" | the pass changes almost nothing; the picture stays the composite |

Lesson: when a part of the original must come back exactly, cut it out and paste it. The edit model rebuilds, it does not copy.

## `step7-klein-goggles-no-gun/` (no gun, welding goggles on the forehead, the eyes fixed)

The owner's notes on `step6`: take the weapons away and keep the robotic hand and the real (bare) hand; her eye is faulty (in `before-x2.png` the two eyes do not match: one dark blue-grey, one green); give her welding goggles. Starting point is `x2` of step 6 (it has no gun), so "no gun" is already there. A first prompt that put the goggles **over the eyes** was stopped by the owner: the goggles go **pushed up on the forehead**, the eyes stay visible. Prompt (seeds 1, 2, 3): goggles of two round dark green tinted lenses in a rusty metal frame with a strap, on top of the forehead; redraw both eyes cleanly and matching, two dark green eyes of the same shape and size with eyelids and eyebrows; change nothing else (both hands empty, the long arm, hair, jacket, trousers, page).

| File | Eyes | Goggles |
|---|---|---|
| `j1-goggles-on-forehead_00001_.png` (seed 1) | **both green and matching** | on the forehead, round green lenses, brass-rusty frame, strap |
| `j2-...` (seed 2) | one green, one red | the same |
| `j3-...` (seed 3) | one reddish, one green | the same |
| `faces-sheet.png` | before and the three faces enlarged | |

**`tilly-reference-v2.png` is J1: the current reference picture** (no gun). Side effects of the pass: the hair on top is smoother and darker under the goggle strap, the robotic hand a little smaller. The original gun of `step6/tilly-reference-v1.png` can be pasted in again later (`KLEIN-EDIT-NOTES.md`).

Lesson: asking the model to redraw both eyes "cleanly and matching" fixed the eyes in one seed of three; try a few seeds and look at the faces enlarged.

## `original-hangar-strips/`

Tilly's nine original hangar strips as they were drawn on the design canvas (idle, tolift, act, toidle, select, selecti, hold, desel, bridge-act; frames of 136 x 116 px; counts and times in `apps/web/src/hangar-select.ts`). They were removed from `archive/hangar/strips/` when her atlas moved to the rig export (Git: commit `3f0c734`). Kept as the reference for her original choreography, in particular the `act` (see `ANIMATION-OPTIONS.md`).

## What this shows

SDXL with text, a ControlNet or an inpaint pass does not draw Tilly's third arm or robot arm reliably, and a refinement either destroys a sketch or leaves it flat. The community's lane (an image-edit model with the picture as a reference) did it in `step3-klein-edit/`; the sprite-sheet LoRA and the pixel-snapping step are still to try: `docs/design/heroes/tools/comfy/RESEARCH.md`.
