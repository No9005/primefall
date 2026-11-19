#!/usr/bin/env bash
# Rebuilds the best version of the Notstrom music, in the order it was made on 2026-11-16/17:
#   1. the refrain test is uploaded (so it can be an audio reference),
#   2. the whole piece in three stages (each stage keeps the earlier part as an audio reference: inpainting),
#   3. afterwards the layers for the game (drone, pulse, drums), each a single chunk without a seed and without a reference.
# THIS COSTS CREDITS: about 7,200 for the whole piece and about 2,500 for the three layers (about 31 credits per second of new audio).
# Needs ELEVENLABS_API_KEY. `DRY_RUN=1` only shows what would be sent and patches the plans with placeholder ids.
# The song ids in the saved plans (see ../../README.md) may no longer exist at ElevenLabs; this script replaces them with the new ones.
set -euo pipefail
cd "$(dirname "$0")/../.."          # audio-source/music
API="https://api.elevenlabs.io"
OUT="${OUT:-work}"; mkdir -p "$OUT"
DRY="${DRY_RUN:-0}"
[ "$DRY" = 1 ] || : "${ELEVENLABS_API_KEY:?set ELEVENLABS_API_KEY}"

compose() {   # compose NAME PLAN.json -> prints the Song-Id
  local name="$1" plan="$2"
  if [ "$DRY" = 1 ]; then echo "would POST $plan -> $OUT/$name.mp3" >&2; echo "DRYRUN_$name"; return; fi
  local code
  code=$(curl -sS -D "$OUT/$name.hdr" -o "$OUT/$name.mp3" -X POST "$API/v1/music?output_format=mp3_44100_128" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d @"$plan" -w '%{http_code}')
  [ "$code" = 200 ] || { echo "$name: HTTP $code"; head -c 400 "$OUT/$name.mp3"; exit 1; }
  grep -i '^song-id:' "$OUT/$name.hdr" | awk '{print $2}' | tr -d '\r'
}
patch() {     # patch PLAN OLD_ID NEW_ID OUT.json: the earlier song's id into the plan
  python3 - "$1" "$2" "$3" "$4" <<'PY'
import sys
src,old,new,dst=sys.argv[1:5]
t=open(src).read()
assert old in t, f"{old} not in {src}"
open(dst,"w").write(t.replace(old,new))
PY
}

# 1. the refrain test as an audio reference (the upload is stored for inpainting)
if [ "$DRY" = 1 ]; then REF="DRYRUN_upload"; echo "would upload pieces/refrain-test-the-good-feeling.mp3" >&2
else REF=$(curl -sS -X POST "$API/v1/music/upload" -H "xi-api-key: $ELEVENLABS_API_KEY" -F "file=@pieces/refrain-test-the-good-feeling.mp3" | python3 -c 'import sys,json;print(json.load(sys.stdin)["song_id"])'); fi
echo "refrain test, uploaded: $REF"

# 2. the whole piece in three stages (seed 424242 in the plans)
patch plans/stage-1.json fZDeTVYfbJujEraIqfiL_upload "$REF" "$OUT/stage-1.json"
S1=$(compose stage1 "$OUT/stage-1.json"); echo "stage 1 (Intro, Strophe 1, Aufbau, Refrain 1; 100 s): $S1"
patch plans/stage-2.json l0CGzRMzAFDAFQezPg1s "$S1" "$OUT/stage-2.json"
S2=$(compose stage2 "$OUT/stage-2.json"); echo "stage 2 (+ Strophe 2, Refrain 2, Bridge; 180 s): $S2"
patch plans/stage-3.json hF6hdmMPuJ6jScDiPnYJ "$S2" "$OUT/stage-3.json"
S3=$(compose stage3 "$OUT/stage-3.json"); echo "stage 3 (+ Finale, Ende; 233 s): $S3"

# 3. the layers for the game, afterwards and independent of the piece: no seed, no reference
for l in drone pulse drums; do echo "layer $l: $(compose "$l" "plans/pilot-2-$l.json")"; done

echo "Next: tools/align.py stretches the layers to exactly 72.000 BPM and cuts loops of exactly 8 bars (see ../../README.md)."
