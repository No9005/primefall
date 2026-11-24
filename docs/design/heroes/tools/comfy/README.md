# Tilly poses in ComfyUI (intro videos, new animations)

New poses of Tilly for the intro videos and as a base for new rig animations. The rig stays the source of the game's sprites; this is for pictures where the rig's flat figure is not enough.

| File | What |
|---|---|
| `prepare-tilly-inpaint.mjs` | Writes `tilly-source.png` (Tilly of the hangar atlas, the look reference), `tilly-blank.png` and the masks into ComfyUI's `input/` |
| `render-pose-guides.mjs` | Renders poses of the rig (`hangar:act:13`, `rig:pulse:620`, ...) as `tilly-guide-*.png`, the pose input of the ControlNet |
| `tilly-pose-controlnet.json` | The workflow: SDXL inpainting UNet + pixel-art LoRA, IP-Adapter (her look from `tilly-source.png`), ControlNet union with the outline (Canny) of the guide as the pose, composited into the page (`tilly-blank.png`, or a scene for an intro frame) |
| `tilly-pose-inpaint.json` | The first workflow: plain SDXL base inpainting with a mask. It cannot place a limb (it erases it or paints a new figure); kept as the simple baseline |

Where the work stopped and which ways are left for the hangar animations: `ANIMATION-OPTIONS.md`.

## Models to download

Already in `~/comfy-models/` (used by the first workflow too): `checkpoints/sd_xl_base_1.0.safetensors` and the LoRAs `loras/pixel-art-xl.safetensors` (and the two other pixel-art LoRAs). The ControlNet workflow needs four more files (about 11 GB), all from Hugging Face, into the folders of the ComfyUI workspace (`~/claude-home/code/ComfyUI/models/`; the folder names below are the ones ComfyUI and the IP-Adapter node look in):

| File to save as | From | Size | Folder |
|---|---|---|---|
| `controlnet-union-sdxl-1.0-promax.safetensors` | `https://huggingface.co/xinsir/controlnet-union-sdxl-1.0/resolve/main/diffusion_pytorch_model_promax.safetensors` | 2.5 GB | `controlnet/` |
| `sd_xl_inpainting_0.1_unet_fp16.safetensors` | `https://huggingface.co/diffusers/stable-diffusion-xl-1.0-inpainting-0.1/resolve/main/unet/diffusion_pytorch_model.fp16.safetensors` | 5.1 GB | `unet/` |
| `ip-adapter-plus_sdxl_vit-h.safetensors` | `https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors` | 0.85 GB | `ipadapter/` |
| `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` | `https://huggingface.co/h94/IP-Adapter/resolve/main/models/image_encoder/model.safetensors` | 2.5 GB | `clip_vision/` |

The file names matter: the workflow names them. Download with the `download_model` tool of the ComfyUI MCP, or from a terminal in the folder, for example `curl -L -C - -o controlnet-union-sdxl-1.0-promax.safetensors <url>`; `-C -` continues a partial file after an interruption. A file is complete when its size equals the one above (the MCP's `download` tool reports `completed`).

Custom node pack: `ComfyUI_IPAdapter_plus` (`git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus` into `ComfyUI/custom_nodes/`; ComfyUI-Manager is not installed, so `install_node` does not work). Restart ComfyUI afterwards.

## Run

ComfyUI must be started like this on this machine (RX 9070 XT, kernel 7.3.x): `python main.py --listen 127.0.0.1 --port 8188 --fp32-vae --disable-dynamic-vram`. Without the last two options every SDXL image came out black, striped or flat (also plain SDXL base, so it is not the models: their SHA-256 sums match Hugging Face's). In the MCP: `restart_comfyui` with `extra_args: ["--fp32-vae", "--disable-dynamic-vram"]`.

```
node docs/design/heroes/tools/comfy/tilly-poses.mjs --poses rig:pulse:620,hangar:act:13 --out my-poses
```

This writes the inputs (`prepare-tilly-inpaint.mjs`), renders the pose guides from the rig (`render-pose-guides.mjs`), runs `tilly-pose-controlnet.json` once per pose (about 30 s each) and collects `<pose>-big-seed<n>.png` (1024 px) and `-small-` (128 px) in the folder. `--seed`, `--workflow` and `--set <node>.<input>=<value>` change a run (strengths and denoise are named in the workflow); `--no-prepare` skips the inputs.

Look at each result next to its guide `ComfyUI/input/tilly-guide-<pose>.png`: the pose must match the guide and her look the reference.

## State (first runs)

The pipeline runs end to end. With the defaults the pose follows the guide only roughly and her look only approximately (orange top, teal reactor and goggles, brown ponytail, robot arm; but a shorter, chunkier figure than the rig's, and a pose with the third arm raised came out with the arm down). Next to tune: ControlNet strength and end percent (node 14), IP-Adapter weight (node 7), the prompt (node 8), a mask that fits the pose (`tilly-mask-figure.png`), several seeds per pose. For the game's sprites the rig stays the source; this is for intro pictures and as a reference for new rig keyframes.
