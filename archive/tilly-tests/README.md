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

## `original-hangar-strips/`

Tilly's nine original hangar strips as they were drawn on the design canvas (idle, tolift, act, toidle, select, selecti, hold, desel, bridge-act; frames of 136 x 116 px; counts and times in `apps/web/src/hangar-select.ts`). They were removed from `archive/hangar/strips/` when her atlas moved to the rig export (Git: commit `3f0c734`). Kept as the reference for her original choreography, in particular the `act` (see `ANIMATION-OPTIONS.md`).

## What this shows

SDXL with text, a ControlNet or an inpaint pass does not draw Tilly's third arm or robot arm reliably, and a refinement either destroys a sketch or leaves it flat. The community's lane (an image-edit model with the picture as a reference) did it in `step3-klein-edit/`; the sprite-sheet LoRA and the pixel-snapping step are still to try: `docs/design/heroes/tools/comfy/RESEARCH.md`.
