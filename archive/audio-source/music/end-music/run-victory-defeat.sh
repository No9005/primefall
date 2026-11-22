#!/bin/bash
# NOT RUN YET: each call spends about 620 credits. DRY_RUN=1 (the default) only prints.
cd "$(dirname "$0")"
for name in victory defeat; do
  if [ "${DRY_RUN:-1}" = "1" ]; then echo "would POST plan-$name.json to /v1/music"; continue; fi
  curl -sS -D hdr-$name.txt -o jingle-$name.mp3 -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" -H "xi-api-key: placeholder" -H "Content-Type: application/json" -d @plan-$name.json -w "%{http_code}\n"
done
