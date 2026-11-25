# Options for Tilly's hangar animations in ComfyUI

Written down so that another session or agent can pick up where this one stopped. The owner wants the hangar animations (first: Tilly's `act`) in a more detailed look than the rig's (the owner's reference was a detailed SDXL pixel-art picture: rich shading, metal highlights, a finer pixel size; it is not in the repository), and accepts that Tilly becomes a different model if that is what it takes. The rig route (`../export-hangar.mjs`, `../hangar-controller.js`) keeps the figure of the map, but its third arm and robot arm are too short in proportion to the original, so the owner wants to try ComfyUI.

## The animation to reproduce

The original `act` strip (27 frames, 136 x 116 px, 100 ms per frame) was removed from `archive/hangar/strips/` with the move to the rig export. It is kept at `archive/tilly-tests/original-hangar-strips/tilly-act.png` (with her other original strips); in Git it is at commit `3f0c734`. The beats:

- Frames 0 to 12: both arms up, the third arm forms a big arch over her head, she works on its end with both hands; her robot arm crosses in front of her chest, below her face.
- Frames 13 to 17: the third arm shoots straight up and its claw tears off and flies away (speed lines, a yellow spark); she is shocked (wide white eyes, open mouth), steam at the break.
- Frames 18 to 21: the piece falls, bounces and lies on the floor; the arm folds back; shock strokes over her head.
- Frames 22 and 23: she swings her left arm to the right (a long orange streak in 23). Frame 24: left arm up holding the piece. Frames 25 and 26: back to work.

The figure of the strip is not the map's Tilly: its arms and hands do not sit on the body correctly (hands are squares, the robot arm differs from the map). A restyle from the strip frames must not copy those shapes.

## Options

| # | Way | Original beats | Arm proportions | Download | Effort and risk |
|---|---|---|---|---|---|
| A | **Dress the original strip.** The 27 frames are the ControlNet input (lineart or canny instead of tile, so the model may redraw arms and face), an IP-Adapter holds the look | exact, with expression, piece and effects | follow the strip, the model may redraw them | none | 8 min per run. Risk: the strip's arms are wrong; with a tight guide the model copies them |
| B | **Pose by skeleton.** One skeleton per frame with arms of the right length (joints read from the strip), the model paints Tilly over it (OpenPose for the body, lineart for the third arm, chained ControlNets) | as drawn | set by us | none (OpenPose is in the loaded ControlNet Union) | Much hand work (27 skeletons). The third arm has no skeleton convention |
| C | **Video model.** Wan 2.2 turns a still plus a prompt into a video | no, the model invents the motion | model decides | about 20 to 30 GB | On 16 GB only small or quantised variants. Pixel art flickers, beats cannot be steered. Unlikely to work |
| D | **Image-edit model** (Qwen-Image-Edit, Flux Kontext), per frame: "make the third arm longer, keep pose and figure" | close to the original | steerable by prompt | about 20 GB or more | Consistency between frames unknown; untested on ROCm with this card |
| E | **Redraw only the arms** by mask per frame (inpaint) | exact | model decides | none (the inpaint UNet is loaded) | One mask per frame. The first inpaint tests (`tilly-pose-inpaint.json`) erased the arm instead of drawing one |

Not ComfyUI, for comparison: lengthen the arm parts in the rig (`SEG` and `ARM_B` in `../rigs/controller.js`). Fastest way to the right proportions, keeps the map's Tilly.

## Recommendation

1. Try **A** on six key frames first (0, 6, 13, 16, 22, 24; about two minutes) and show them before running all 27.
2. If the arms are still wrong, go to **B** for the difficult frames.
3. Leave C and D until A and B are exhausted.

## State of the tooling (what exists, what was measured)

- Machine: ComfyUI must be started with `--fp32-vae --disable-dynamic-vram` (README). Without them SDXL output is black or striped on this machine since the kernel update.
- `tilly-restyle.json` with Look D (denoise 0.75, ControlNet tile strength 0.9, end 1.0, seed 1) on the rig frames: frame-to-frame change 1.2 to 1.3 times that of the rig, loop seam visible but small. Idle (40 frames) and the rig's `act` (27 frames) were dressed that way.
- `render-pose-guides.mjs` renders guides from rig clips (`hangar:<clip>:<frame>`, `rig:<clip>:<ms>`) and, with `STRIP_FILE=<png>`, from a strip (`strip:<label>:<frame>`). It warns when a pose touches the edge of the page.
- ControlNet type `lineart` or `canny` for option A: set node 13's `type` to `canny/lineart/anime_lineart/mlsd` (in `tilly-restyle.json`), and feed node 14 an edge image from the `Canny` node instead of the guide itself.
- Open: the owner's answers to two questions: keep Look D or let the look change completely; use the strip as a pose guide only or carry over its look.

## Decision after the options (2026-11-25)

The owner stays local and on what fits the card: option C is narrowed to **Wan 2.2 TI2V-5B** (with its Fun Control and Fun Inpaint variants), the 14B models and Wan Animate were dropped, and the cloud-only sprite sheet workflows are not used. The steps are in `TESTPLAN.md`.
