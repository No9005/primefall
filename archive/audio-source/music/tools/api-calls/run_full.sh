#!/bin/bash
cd /tmp/claude-0/-home-user-primefall/50294b21-724b-50a3-9d7f-73d8954e0a5a/scratchpad/music2
curl -sS -D hdr_full.txt -o full.mp3 -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" -H "xi-api-key: placeholder" -H "Content-Type: application/json" -d @full.json -w "%{http_code}\n" > full.status 2>&1
