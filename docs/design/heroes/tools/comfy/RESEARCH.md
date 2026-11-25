# How the community makes game sprites with ComfyUI

Research of 2026-11-25, after the SDXL rounds in `archive/tilly-tests/` came out poor. What each part is used for, which of it fits one RX 9070 XT (16 GB VRAM, 32 GB RAM, ROCm), and what we have. Sources: pages read in full by a fetch agent unless noted; none of it was run here yet.

## The parts and what they do

| Job | What the community uses | Notes (source) |
|---|---|---|
| **Base model for sprite work** | **FLUX.2 klein 4B** (fp8; text encoder Qwen3-4B; FLUX.2 VAE) with a pixel-art LoRA; alternatives: Qwen-Image-Edit 2511, FLUX.1 Kontext dev | nuilab's sprite guide runs on a 16 GB card: the klein stack is "about 5 GB", ComfyUI-native, no custom nodes. Generate a batch of eight, judge the distribution, cull hard ([nuilab: sprites](https://aigaming.nuilab.org/workflows/sprites/)) |
| **Keep the character the same** | 1. **multi-reference editing** (the picture goes in as a reference, the prompt says what to change): klein, Kontext (ReferenceLatent), Qwen-Image-Edit. 2. **sprite-sheet LoRAs**. 3. **a character LoRA**. 4. **IP-Adapter**, but only in the SDXL lane | nuilab names them "cheapest first". More separate references make it worse; the workaround is one grid picture that stitches them ([nuilab: character consistency](https://aigaming.nuilab.org/workflows/character-consistency/)). IP-Adapter does not exist for klein |
| **New poses / angles** | the same edit model with the reference and a prompt; a turnaround LoRA (2 x 2 angles); a skeleton (OpenPose from DWPose) as a pose input to Qwen-Edit | a Hugging Face Qwen-Edit 2511 workflow uses `comfyui_controlnet_aux` DWPose skeletons ([JahJedi](https://huggingface.co/JahJedi/Qwen-Edit-Krea2-Turbo-Workflow)); Kontext keeps identity through a `ReferenceLatent` chain ([earngenix](https://www.earngenix.com/tutorials/flux-kontext-character-consistency-comfyui)). Apatero's guide only says "consider ControlNet with pose skeletons" |
| **A whole sheet in one go** | **sprite-sheet LoRAs** that draw a fixed grid | `Leon1000/pixel_spritesheet_4walk_combat_32x48_v1` (Apache-2.0): Qwen-Image-Edit-2511, 768 x 768, a 6 x 4 grid (per direction 3 walk, 2 attack, 1 hurt frame; down, left, right, up), downscale by 4 with k-centroid. `svntax-dev/pixel_spritesheet_4walk_small_lora_v1` (Apache-2.0): FLUX.2-klein-**base**-4B (not the distilled one), 512 x 512, a 4 x 4 grid, downscale by 4. `Mystic07/flux-lora-spritesheet`: FLUX.2-klein-base-9B, trigger `gmsspritesheet`, licence stated twice and not the same: check before use. All three say they are first attempts: heads cut off, bad anatomy on non-humans, the back row weak. File sizes were not on the pages |
| **Animation frames** | frame by frame with the same seed and locked sampler settings; or a video model (Wan 2.2) from one frame | Apatero (a vendor of a sprite service, treat with care): frame-by-frame "currently" beats AnimateDiff-style sequences. mor-o's pipeline (MIT, harness-driven, 24 GB NVIDIA): Qwen-Image-Edit poses a keyframe, Wan 2.2 i2v animates, BiRefNet cuts it out ([repo](https://github.com/mor-o/comfyui-2d-character-pipeline)) |
| **Pixel-perfect output** | generate big, then **detect the grid, downscale to the true size, quantise the palette, upscale with nearest neighbour**. Never an AI upscaler for pixel art | **ComfyUI-PixelArt-Detector** (`PixelArtDetectorToImage` in one node; converter with dithering; palette from a reference image so a whole asset set matches), **Sprite Fusion Pixel Snapper** (snaps AI output to a grid and a palette). Diffusion at 32 x 32 gives mush ([nuilab: pixel-perfect](https://aigaming.nuilab.org/workflows/pixel-perfect-output/)) |
| **Background** | the LoRA draws a transparent or flat page; otherwise ComfyUI's own background-removal models (`models/background_removal/`), rembg or SAM2; or a flat colour keyed out | Cut out **before** quantising, or the edges go ragged (nuilab). A colour key fails with clothes in that colour (Apatero) |
| **Sheet assembly** | an image-grid node or a script; zero-padded frame names; power-of-two sheets | Apatero. We already have an atlas format and packer (`apps/web/scripts/ATLAS.md`) |
| **Train a character LoRA** | 15 to 40 pictures of the character, trained off the box | nuilab: "roughly 24 GB of VRAM", so not on 16 GB; Apatero: learning rate about 0.0002, 15 to 20 epochs. The trainer is not named on either page |

## What fits 16 GB

- **FLUX.2 klein 4B and its base** (`black-forest-labs/FLUX.2-klein-4B` and `…-base-4B`): Apache-2.0, not gated, and ComfyUI has templates for them here (`image_flux2_klein_image_edit_4b_base`, `…_4b_distilled`, `image_flux2_klein_text_to_image`); ComfyUI-Org repackaged files: `Comfy-Org/Flux-2-Klein-4B`. File names and sizes were **not** checked yet.
- **Qwen-Image-Edit 2511**: templates exist here (`image_qwen_image_edit_2511_int8` and others). Its size on 16 GB was not checked.
- **FLUX.1 Kontext dev** as GGUF (`QuantStack/FLUX.1-Kontext-dev-GGUF`, needs the ComfyUI-GGUF node pack, files into `models/unet`): Q4_K_M 6.93 GB, Q5_K_M 8.42 GB, Q6_K 9.85 GB, Q8_0 12.7 GB. **Licence: non-commercial** (flux-1-dev-non-commercial). The page does not name the text encoders or VAE.
- AMD note ([AMD guide](https://rocm.blogs.amd.com/artificial-intelligence/comfyui-radeon-9000/README.html)): for 16 GB cards they suggest `--reserve-vram 3`. Not tried here; our machine needs `--fp32-vae --disable-dynamic-vram` anyway.

## What we have and what is missing

| Have | Missing for the community lane |
|---|---|
| SDXL base, `pixel-art-xl` LoRA, ControlNet Union (openpose type included), IP-Adapter plus (SDXL), SDXL inpainting UNet, `comfyui_controlnet_aux` with DWPose, Wan 2.2 5B (TI2V, Fun Control, Fun Inpaint), ffmpeg | an image-edit model (klein 4B, or Qwen-Edit, or Kontext GGUF), a sprite-sheet LoRA, `ComfyUI-PixelArt-Detector` (or the Pixel Snapper), a background-removal model |

## Why the SDXL rounds were poor (reading, not proof)

The community recipe for a character with fixed odd parts is not "describe it in text" but "show the model the picture and ask for the change". Our rounds asked SDXL to draw a third arm and a robot arm from words, or from a flat sketch, which SDXL does not do; an inpaint pass then smoothed or erased what it could not read. nuilab also says IP-Adapter only works in the SDXL lane, which is where we were. This is my reading of the sources; it has not been tested.

## What I would try next (cheapest first, nothing downloaded yet)

1. **klein 4B image edit with a reference** (`image_flux2_klein_image_edit_4b_*`): the owner's base picture (`archive/tilly-tests/step2-adding-parts/00-base.png`, robot removed: `01-no-robot.png`) as the reference, prompts like "add a long mechanical grey arm with three segments and a pincer rising from behind her right shoulder", "replace the gun with a grey robotic arm with a claw hand", "make the sleeves and trousers frayed and torn". Needs a check of file sizes first (about 5 GB per nuilab, not verified).
2. **Pixel clean-up** with `ComfyUI-PixelArt-Detector`: grid, downscale, palette from the reference.
3. **Poses and turnaround** from the fixed Tilly with the same model, then a sprite-sheet LoRA (the klein-base-4B one) for the walk grid.
4. **Animation**: the existing plan with Wan 2.2 5B (`TESTPLAN.md`), with frames from the steps above as start and end frames.

## Caveats

Several sources are vendors or single authors; none ran on this machine (AMD, ROCm 7, 16 GB). One page (stable-diffusion-art's Qwen multiple-angle LoRA) answered 403 and was not read. The hub workflows that look like sprite generators (Nano Banana) need paid partner nodes and are out of scope.
