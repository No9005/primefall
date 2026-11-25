#!/usr/bin/env bash
# The calls of the first round on the owner's base picture of Tilly (a plain SDXL text-to-image result with the restyle prompt of tilly-restyle.json,
# seed 1, base UNet; saved as base-from-owner.png): take out the robot beside her and the floor shadow, sketch the robot arm and the third arm in grey
# and refine the sketch with an inpaint pass. ComfyUI must be running (start-comfyui.sh). Usage: step2-add-parts.sh <base png> <out folder> [seed]
# Result of this round: at denoise 0.62 the model smooths the sketch away (the third arm becomes a plain tube, the robot arm vanishes); at 0.4 the sketch
# stays but gets hardly any detail. The coordinates are those of the 1024 x 1024 base picture.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; base="$1"; out="$2"; seed="${3:-1}"
mkdir -p "$out"
node "$here/eval/fill.mjs" "$base" "$out/01-no-robot.png" sample:10,10 548,0,476,1024
node "$here/eval/fill.mjs" "$out/01-no-robot.png" "$out/02-no-shadow.png" sample:10,10 60,950,190,70 250,988,300,30 366,950,46,36 508,950,45,60
node "$here/eval/paint.mjs" "$out/02-no-shadow.png" "$out/04-sketch.png" \
  "rect:40,395,200,290,#9cb3ad" "rect:205,470,40,70,#9cb3ad" \
  "outlined:262,470,246,572,36,#8f9aa3" "outlined:226,578,266,578,44,#aeb8c0" "outlined:236,598,222,652,16,#8f9aa3" "outlined:256,598,270,652,16,#8f9aa3" \
  "circle:260,472,15,#6ff0d0" "circle:246,574,9,#6ff0d0" \
  "outlined:512,335,595,215,26,#8f9aa3" "outlined:595,215,705,128,22,#8f9aa3" "outlined:705,128,800,76,19,#8f9aa3" "outlined:800,76,826,34,11,#8f9aa3" "outlined:800,76,834,86,11,#8f9aa3" \
  "circle:512,335,17,#8f9aa3" "circle:595,215,13,#6ff0d0" "circle:705,128,12,#6ff0d0" "circle:800,76,10,#6ff0d0"
node "$here/inpaint.mjs" --image "$out/04-sketch.png" --mask "r:195,385,125,330;r:480,15,380,345" \
  --prompt "detailed pixel art, grey robotic arms with segmented metal plates, teal glowing joints and a two-pronged pincer claw, black outline, rich shading, metal highlights, flat blue-grey background" \
  --negative "gun, weapon, human hand, text, extra limbs, blurry, photo, realistic, person, face" --seed "$seed" --denoise 0.5 --grow 3 --out "$out/06-refined.png"
