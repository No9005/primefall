#!/bin/bash
# Inpainting of the last two bars of the refrain. NOT RUN YET: it spends credits (about 207 per call).
# DRY_RUN=1 (the default) only prints what would be sent.
cd "$(dirname "$0")"
for seed in 424242 7 99; do
  if [ "${DRY_RUN:-1}" = "1" ]; then echo "would POST plan-a-seed$seed.json to /v1/music"; continue; fi
  curl -sS -D hdr-seed$seed.txt -o refrain-inpaint-seed$seed.mp3 -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
    -H "xi-api-key: placeholder" -H "Content-Type: application/json" -d @plan-a-seed$seed.json -w "%{http_code}\n"
done
