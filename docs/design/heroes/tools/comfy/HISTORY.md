# How we got to Tilly's detailed look (v1, v2) and the pixel clean-up

Chronological, with the settings needed to repeat each step. Pictures of every step are in `archive/tilly-tests/` (README per step). Prompt lessons in `KLEIN-EDIT-NOTES.md`, the community research in `RESEARCH.md`, the test plan in `TESTPLAN.md`. ComfyUI must be started with `start-comfyui.sh` (`--fp32-vae --disable-dynamic-vram`, otherwise the output is black or striped on this ROCm machine).

## 0. Starting point and goal

The hangar scene played Tilly from a parametric canvas rig; it did not look like her map sprite. The owner wanted a more detailed pixel-art look (the picture they supplied), with her three odd parts: a robotic right arm, a long mechanical third arm from the back, torn clothes. Later also new poses and intro clips. Everything runs locally on an RX 9070 XT (16 GB).

## 1. Dead end: SDXL (step 1 and early rounds)

Archive: `early-restyle-and-controlnet/`, `step1-looks-from-description/`, `step2-adding-parts/`.

- SDXL base, `pixel-art-xl` LoRA, ControlNet Union (openpose), IP-Adapter plus, SDXL inpaint; restyle from the rig frames, then inpaint for poses.
- Result: poor. SDXL does not draw a third arm or a robot arm from words or from a flat sketch; inpainting smoothed or erased them.
- One round was good: the **base picture** (`step2-adding-parts/00-base.png`): SDXL base UNet, LoRA only on CLIP at 0.8, the restyle prompt, seed 1, cfg 6, 30 steps, `dpmpp_2m` / `karras`. It has her face, hair, jacket and trousers, but lacks the robot arm and third arm and the clothes are intact. The owner called this "basically a good version" and asked to drop the "chunky, stocky" wording.

## 2. The community lane: an edit model (step 3)

`RESEARCH.md`: the community does not describe a character in text, it shows the model the picture and asks for the change. Chosen: **FLUX.2 klein 4B distilled, image edit** (Apache-2.0; template `image_flux2_klein_image_edit_4b_distilled`; files `flux-2-klein-4b-fp8`, `qwen_3_4b`, `flux2-vae`, SHA-256 checked). 15 to 25 s a picture, about 13 GB VRAM at 1.4 megapixels. One prompt with all changes gave the robot arm, third arm and torn clothes at once (`step3-klein-edit/`).

## 3. Refinement with the owner (steps 4 to 6)

- Step 4 (three variants): the robot part looked like a glove, the third arm came out of her hip, it was not scrappy. Owner: make it a whole arm, from the back, thinner, made from scrap.
- Step 5: robot arm clearly a robot; owner: no visible joints, should be longer and arch over her head when waiting.
- Step 6: jointed long scrap arm (**x2**: whole right arm robotic hanging relaxed with an open hand, gun moved to the other hand, long scrap robot arm with ball joint, servo, hydraulic piston, wrist and pincer rising from the upper back and arching over her head, torn trousers; seed 2, `megapixels` 1.4). The model lost the gun in that run.
- **v1** = x2 plus the original gun. Asking the model for the gun never worked (chained edits undid each other, "her left hand" was read as the robotic one, a second reference picture copied the wrong side), so the gun was **pasted**: cut from `step2-adding-parts/01-no-robot.png` region `40,405,170,250`, mirrored, scale 1.03125, pasted at `495,858` (`eval/paste.mjs`). Input prepared with `eval/pad.mjs 320 0 0 0` (headroom so the arm is not cut off; 1024 x 1344). Output 1056 x 1376. Result: `step6-.../tilly-reference-v1.png`.

## 4. v2: no gun, goggles, matching eyes (step 7)

Owner: remove the weapons, keep robotic and real hand, the eyes do not match, give her welding goggles. Same x2 base, prompt added: goggles of two round dark green lenses in a rusty frame with a strap **on top of her forehead, pushed up above her eyes**, "redraw both eyes cleanly and matching", "change nothing else". The first wording put them over the eyes and was stopped. Seeds 1 to 3: seed 1 (J1) had matching eyes. **`step7-.../tilly-reference-v2.png` = J1.**

## 5. Pixel clean-up (step 8)

`pixel-cleanup.mjs` (needs a running ComfyUI): flatten page colour and paint out the floor shadow (`eval/cutout.mjs flatten`), upload, `pixel-cleanup.json` (`PixelArtDetectorToImage`, `reduce_palette`, 24 colours), key the page to alpha and crop (`eval/cutout.mjs key`), 6x preview (`eval/cutout.mjs preview`). Result `step8-pixel-cleanup/tilly-clean.png`: 209 x 315 px, transparent, nothing lost in the face, goggles or arms. Details in the archive README.

## 6. Reproduce it

1. `start-comfyui.sh`; load the klein template, set slots as in `KLEIN-EDIT-NOTES.md` (picture from `step2-adding-parts/00-base.png` after `fill.mjs` to remove the robot and shadow, then `pad.mjs`).
2. Run the x2 prompt, seed 2, then the goggles prompt, seed 1 (`step7-.../`).
3. `node pixel-cleanup.mjs --in <v2 png> --out <png> --colors 24 --tol 36 --clear "0,1347,1056,29;0,1300,243,47;357,1300,68,47;532,1300,60,47"`.

## 7. Not done yet

Gun pasted back for shooting animations (only in v1), grip and fingers, a segmented third arm for animation, poses and frames from the reference, Wan 2.2 5B tests, sheet packing into the hangar atlas, acceptance criteria and the agent feedback loop (`TESTPLAN.md`).
