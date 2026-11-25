#!/usr/bin/env bash
# Starts ComfyUI the way this machine needs (RX 9070 XT, ROCm, kernel 7.3.x), in the foreground:
#   docs/design/heroes/tools/comfy/start-comfyui.sh [extra ComfyUI options]
#
# `--fp32-vae --disable-dynamic-vram` are required: without them every SDXL image came out black, striped or flat (the VAE ran in bf16 and the
# dynamic VRAM loader broke the output after a kernel update). Plain SDXL base showed it, so it is not the models. The server listens on
# localhost only. Where it lives: COMFYUI_DIR (default ~/claude-home/code/ComfyUI, with its own .venv).
#
# From an agent: the MCP's `restart_comfyui` takes the same options as `extra_args: ["--fp32-vae", "--disable-dynamic-vram"]`
# (or run this script in the background and poll http://127.0.0.1:8188/system_stats).
set -euo pipefail

COMFYUI_DIR="${COMFYUI_DIR:-$HOME/claude-home/code/ComfyUI}"
PYTHON="$COMFYUI_DIR/.venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "No ComfyUI venv at $COMFYUI_DIR/.venv (set COMFYUI_DIR to the ComfyUI folder)." >&2
  exit 1
fi
if curl -s -m 2 http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then
  echo "Something already answers on port 8188 (ComfyUI is running). Stop it first (the MCP's stop_comfyui, or its terminal)." >&2
  exit 1
fi

cd "$COMFYUI_DIR"
exec "$PYTHON" main.py --listen 127.0.0.1 --port 8188 --fp32-vae --disable-dynamic-vram "$@"
