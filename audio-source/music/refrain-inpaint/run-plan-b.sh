#!/bin/bash
# Inpainting of the end of the refrain (the last 3 s, the line "verliert sich selbst" is sung again). NOT RUN YET: it spends credits (about 93 per call).
# DRY_RUN=1 (the default) only prints what would be sent.
cd "$(dirname "$0")"
for seed in 424242 7 99; do
  if [ "${DRY_RUN:-1}" = "1" ]; then echo "would POST plan-b-seed$seed.json to /v1/music"; continue; fi
  curl -sS -D hdr-b-seed$seed.txt -o refrain-inpaint-b-seed$seed.mp3 -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
    -H "xi-api-key: placeholder" -H "Content-Type: application/json" -d @plan-b-seed$seed.json -w "%{http_code}\n"
done
