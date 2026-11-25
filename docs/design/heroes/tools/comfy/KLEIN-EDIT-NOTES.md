# FLUX.2 klein edit: what worked on Tilly (notes for the next agent)

State on 2026-11-25. The pictures behind each point are in `archive/tilly-tests/` (`step3` to `step6`); every png carries its workflow (`eval/png-settings.mjs <png>`).

## The reference picture

`archive/tilly-tests/step6-klein-scrap-arm-and-gun/tilly-reference-v1.png` (1056 x 1376, flat page, 320 px of headroom):

- the owner's base figure (brown hair, orange jacket, torn teal trousers) with her face, hair and jacket unchanged;
- her right arm (the left of the picture) a robotic arm from the shoulder, hanging relaxed, with an open empty robotic hand;
- **the original gun** in her bare left hand (the right of the picture), cut out pixel exact from the base picture (see below), held low, the barrel pointing down and to the right;
- a long, jointed robot arm made of scrap (a ball joint on a mounting plate at the shoulder, an elbow with a servo and a piston, a wrist, a two-pronged pincer; rusty mismatched parts, welds, bolts, wiring) growing out of her upper back, arching over her head: the "wait" position of her reach extension.

Not done yet: pixel grid and palette (`ComfyUI-PixelArt-Detector` is installed), poses and animation frames from this picture, a version of the arm split into segments for animating it.

## How it was made

- **Workflow:** the gallery template `image_flux2_klein_image_edit_4b_distilled` (`docs/design/heroes/tools/comfy/tilly-klein-edit.json` is the template with the slots filled). Single picture branch: slots `76.image` (and `81.image`), `75.text`, `75.noise_seed`, `75/80.megapixels`; set them with the MCP's `set_workflow_slot`, run with `run_workflow`. About 15 to 25 s per picture at 1.4 megapixels. VRAM in use peaked at about 13.2 GB of 17.1 GB (with the desktop).
- **Two-picture branch** (a reference): in the template nodes `92` (the subgraph) and `94` (its save node) are bypassed (mode 4); set both to mode 0 and bypass `75` and `9`. Image 1 is `76`, image 2 is `81`. Slots `92.text`, `92.noise_seed`, `92/111.megapixels`, `92/85.megapixels`.
- **ComfyUI** must run with `--fp32-vae --disable-dynamic-vram` (`start-comfyui.sh`). A background task of the harness is stopped after two hours; the MCP's `launch_comfyui` starts the server detached (pass the same two options as `extra_args`).

## What I learned (each with its evidence)

1. **The edit model keeps the character; SDXL did not.** One prompt on the owner's base picture gave the third arm, the robot arm and torn trousers in one run (`step3-klein-edit/all-a_00001_.png`). All the SDXL rounds in `early-restyle-and-controlnet`, `step1`, `step2` failed at that.
2. **One prompt with all changes beats a chain of edits.** Chained, a later edit can undo an earlier one (the robot arm vanished again when the third arm was added) and the colours drift a little with every pass (`step3`: `chain2`, `chain3`).
3. **Name what must stay.** "Her other arm stays bare skin", "keep her face, hair, jacket and the flat background the same" worked; without it a grey cuff appeared on the other forearm (`robotarm-a`).
4. **Name the side by the picture, not by her left or right.** "Her left hand" put the gun into the robotic hand; "the bare hand on the right side of the image" worked (`step6`: `g1` against `h1`).
5. **Say what the part is for.** "A robot arm" with pipes, a wrench and a hose was not read as a robot arm (`step4`); a segmented arm with "round ball joints", "servo" and "hydraulic piston" was. The owner wanted visible joints so it can be animated: name them (shoulder, elbow, wrist), and say it is longer than her torso.
6. **Give the picture room.** An arm that arches over her head needs headroom: `eval/pad.mjs` added 320 px on top, and the megapixels slot `75/80.megapixels` went to 1.4 so that Tilly keeps her detail. The result is sized to a multiple of 16 (1056 x 1376).
7. **A follow-up edit that says "change nothing else" keeps the rest exactly** (the long arm stayed identical in `h1`).
8. **A reference picture copies its sides and its arm** (`step6`: `gun-a1` took the whole human arm of the reference into the left of the picture; a mirrored reference gave a floating hand). Use it for style or parts that do not depend on a side.
9. **When a part of the original must come back exactly, cut it out and paste it** (`eval/paste.mjs`: a rectangle of the original, mirrored, scaled, the page colour keyed out). The edit model rebuilds it, it does not copy it. A harmonising edit pass afterwards changes almost nothing (`gun-c1`).
10. **Compare prompts with the same seed, and expect seeds to differ a lot** (the same prompt gave a gun in one hand, in both, or in none: `h1`, `h2`, `b2`).

## Repeat the gun step

```
node docs/design/heroes/tools/comfy/eval/paste.mjs <x2 png> archive/tilly-tests/step2-adding-parts/01-no-robot.png <out png> "40,405,170,250" "495,858" 1.03125 mirror
```

`x2` is `step6-klein-scrap-arm-and-gun/x2-jointed-long_00001_.png`. The numbers hold for that picture (1056 x 1376, the figure scaled 1.03125 against the 1024-wide base, 320 px of headroom): the original gun sits at 40 to 210 and 405 to 655 in the base, her bare hand at 495,577 there, which is 495,858 after the headroom and the scale.

## Next

1. Pixel clean-up of the reference picture (`PixelArtDetectorToImage`: grid, downscale, palette from the picture).
2. Poses and animation frames from it with the same lane (one prompt per pose, the rig's poses as the guide for what the pose is), then the Wan 2.2 5B tests of `TESTPLAN.md`.
3. If the third arm is to be animated as a part: ask the edit model for it alone on a flat page, or cut it out of the reference picture with `paste.mjs` (the arm is a clean silhouette on the flat page).
