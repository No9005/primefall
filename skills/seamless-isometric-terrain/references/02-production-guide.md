# 02 — Production Guide (ComfyUI)

## Required models

| Type | File | Note |
|---|---|---|
| Checkpoint | juggernautXL_ragnarokBy | SDXL base |
| LoRA 1 | isometric_tilemap_xl | strength 0.75 |
| LoRA 2 | white_background_sdxl | strength 0.7 |
| VAE | sdxl_vae | standard SDXL VAE |
| Export | ComfyUI-Inspyrenet-Rembg or SAM | background removal |

## Sampler settings

| Setting | Value |
|---|---|
| Sampler | dpmpp_2m |
| Scheduler | karras |
| Steps | 30 |
| CFG | 6.5 |
| Denoise | 1.0 |
| Seed | Fixed for every tile |
| Latent | 1024x1024, batch 1 |

## Node graph

```text
CheckpointLoaderSimple
  -> LoraLoader (isometric_tilemap_xl, 0.75)
    -> LoraLoader (white_background_sdxl, 0.7)
      -> CLIPTextEncode positive
      -> CLIPTextEncode negative
EmptyLatentImage (1024x1024, batch 1)
KSampler
VAELoader -> VAEDecode
  -> SaveImage
  -> InspyrenetRembg -> SaveImage
```

## Workflow

1. Load checkpoint and both LoRAs.
2. Use the prompts from `03-prompts.md`.
3. Fix the seed and sampler settings.
4. Generate the grass tile first as the reference.
5. Keep the seed locked; change only the surface phrase for each new tile.
6. Run every output through rembg or SAM for a transparent PNG.
7. Import the PNGs into the engine tilemap.
