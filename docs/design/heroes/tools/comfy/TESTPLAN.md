# Test plan: Tilly's animations with local video models

First manual round, done together with the owner. Goal: find out whether a local video model can turn Tilly (a detailed pixel-art look, not the rig's) into game animations and intro clips that are good enough for sprite sheets, on one RX 9070 XT (16 GB VRAM, 32 GB RAM).

## Ground rules

- **Local and free only.** No Comfy Cloud, no partner nodes (Nano Banana, Gemini, Kling and so on). The hub workflows "Single Image to Animated Sprite Sheet" and "Sprite Sheet Generator" need them and are dropped.
- **Only what fits 16 GB.** The model is **Wan 2.2 TI2V-5B**. The 14B models (`wan2.2_i2v_*_14B_fp8_scaled`, 14.3 GB each; Wan Animate fp8, 18.4 GB) were dropped with their LoRAs. 14B only comes back as a GGUF if the 5B turns out to be too weak, and that needs the ComfyUI-GGUF node pack.
- **No existing spritesheets are used for these tests.** The old hangar atlases and strips are not the base. What stays is Tilly's description (see `ANIMATION-OPTIONS.md` and the description agreed in the chat: brown ponytail, teal goggles on her forehead, frayed orange top, grey chest plate with a glowing teal reactor core, grey robotic right arm, bare left arm with an emitter cuff, a long mechanical third arm with a claw).
- Acceptance criteria are not fixed yet. They are worked out together during step 8.

## What is needed

All in `~/claude-home/code/ComfyUI/models/` (start ComfyUI with `start-comfyui.sh`, see the README):

| File | Used by | Size |
|---|---|---|
| `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` | all Wan templates | 6.7 GB |
| `vae/wan2.2_vae.safetensors` | all Wan 2.2 5B templates | 1.4 GB |
| `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors` | `video_wan2_2_5B_ti2v` | 10.0 GB |
| `diffusion_models/wan2.2_fun_control_5B_bf16.safetensors` | `video_wan2_2_5B_fun_control` | 10.0 GB |
| `diffusion_models/wan2.2_fun_inpaint_5B_bf16.safetensors` | `video_wan2_2_5B_fun_inpaint` | 10.0 GB |

The three templates use only core ComfyUI nodes (`Wan22ImageToVideoLatent`, `Wan22FunControlToVideo`, `WanFunInpaintToVideo`, `Canny`). For the first still (step 1) the SDXL files from the first round stay: `sd_xl_base_1.0`, `pixel-art-xl` LoRA, ControlNet Union, IP-Adapter plus. ffmpeg and ffprobe are static builds in `~/.local/bin`. `comfyui_controlnet_aux` with the DWPose models is kept in case a pose guide is wanted for Fun Control.

## Steps

Light to heavy. After each step: VRAM peak, time per clip, flicker (`eval/flicker.mjs`), and the owner's eye. A step that does not work stops the line behind it.

0. **Prepare.** All downloads finished and their SHA-256 sums compared with Hugging Face's; ComfyUI started with `start-comfyui.sh`; the three templates checked with `local_check`.
1. **Tilly's look from the description.** SDXL with the pixel-art LoRA, three or four candidates of the detailed look; the owner picks one. This is the start frame for everything below. Flat single-colour background, so that the background can be keyed out later.
2. **T1: Wan 2.2 5B, image to video** (`video_wan2_2_5B_ti2v`). Start frame from step 1 plus a prompt (idle breathing; "she works on the third arm, it tears off, she is shocked"). First feasibility check on 16 GB: does it run, how long, how does the pixel art hold up.
3. **T2: Wan 2.2 5B Fun Control** (`video_wan2_2_5B_fun_control`). The motion comes from a control video instead of a prompt: the rig's frames or the original strip rendered to a video (`ffmpeg`), edges via `Canny` (the template's own) or DWPose. Keeps the beats of the original animation (the original `act`: see `ANIMATION-OPTIONS.md`). The most promising step for our case.
4. **T3: Wan 2.2 5B Fun Inpaint, start and end frame** (`video_wan2_2_5B_fun_inpaint`). Keyframes at the beats of the `act` (frames 0, 13, 17, 22, 24 of the original), the model fills in between. Chain the segments.
5. **Post-processing**, the same for every test: frames as a PNG sequence (or `ffmpeg`), background removed, scaled to the sprite resolution with nearest neighbour and a fixed palette, feet aligned, packed into the atlas format of `apps/web/scripts/ATLAS.md`.
6. **In the game.** The atlas in the hangar scene, looked at with `npm run screenshots -w apps/web -- --scenario hero-select`.
7. **If the 5B is not enough:** a quantised 14B (GGUF) and the pixel-animate LoRA (`styly-agents/Wan2-2-pixel-animate`, for the 14B only). Only then.
8. **First manual round with the owner.** Look at the results together and write down the acceptance criteria: flicker value, loop seam, third arm never cut off, palette, feet position, fit in the hangar.
9. **Agent feedback loop**, only after step 8: the criteria as scripts, the runner (`tilly-poses.mjs` and a video runner), background runs with polling, a checked start of ComfyUI.

## State of the tooling

- **Step 1 switched to the community lane (2026-11-25):** FLUX.2 klein 4B image edit (gallery template `image_flux2_klein_image_edit_4b_distilled`, files `flux-2-klein-4b-fp8`, `qwen_3_4b`, `flux2-vae`, all checked by SHA-256) with the owner's base picture as a reference gave Tilly her robot arm, third arm and torn clothes in **one** prompt (`archive/tilly-tests/step3-klein-edit/all-a_00001_.png`). The SDXL text rounds are archived as dead ends. The step-1 pick for the animation tests is this picture (the owner decides). `ComfyUI-PixelArt-Detector` is installed for the pixel clean-up (step 5) but not yet run.
- **Step 0 done (2026-11-25):** the five Wan files are complete and their SHA-256 sums match Hugging Face's; ComfyUI started with `start-comfyui.sh` (argv `--fp32-vae --disable-dynamic-vram`, 16.8 GB VRAM free at start); `video_wan2_2_5B_ti2v`, `…_fun_control` and `…_fun_inpaint` pass `local_check` (runnable, no custom nodes). Nothing has been generated with them yet.
- Ready: ComfyUI start script, SDXL pipeline and runner, pose guides from the rig and from strips, the evaluation prototypes in `eval/`, ffmpeg and ffprobe, a way to view results (the agent reads images; clips go through contact sheets and the side-by-side player).
- Missing: a video runner (a ComfyUI workflow for the Wan templates run from Node, with frames saved as a PNG sequence), the acceptance criteria, a measurement of VRAM peaks, the Wan template runs themselves (nothing has been generated with a video model yet).
- Not verified: that the 5B fits 16 GB at the template's resolution and length on this card with ROCm; how pixel art survives the video VAE; how long a clip takes.
