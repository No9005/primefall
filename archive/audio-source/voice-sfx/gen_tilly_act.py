"""The sounds of Tilly's act in the hangar (call 44 in PROMPTS.md): fiddling, the arm tearing off, the clack of putting it back, her gasp.

    python3 archive/audio-source/voice-sfx/gen_tilly_act.py

One call per take, no retry: a call that fails stops the script (a retry would start and charge a second generation). Every answer is saved
with its response headers in `sfx/tilly/act/`. The API key is filled in by the proxy of the session; the header here is a placeholder.
"""

import json
import os
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sfx/tilly/act"
BELLA = "hpp4J3VqNfWAUOO0d1Us"  # Tilly's voice, as for all her lines (CHARACTERS.md)

EFFECTS = {
    "fiddle_a": ("A mechanic tinkering at a metal joint of a robotic arm: quick small metallic ratchet clicks and wrench turns, a short sizzling welding spark crackle, a pause, then a second sizzle. Close, dry, no music, no voice.", 2.0),
    "fiddle_b": ("A mechanic tinkering at a metal joint of a robotic arm: quick small metallic ratchet clicks and wrench turns, a short sizzling welding spark crackle, a pause, then a second sizzle. Close, dry, no music, no voice.", 2.0),
    "tear_a": ("A heavy metal robotic arm segment snapping off with a loud crack: bolts shearing, a sharp electrical spark burst, then the torn metal piece clattering and bouncing on a concrete floor. Dry, close, no music, no voice.", 2.5),
    "tear_b": ("A heavy metal robotic arm segment snapping off with a loud crack: bolts shearing, a sharp electrical spark burst, then the torn metal piece clattering and bouncing on a concrete floor. Dry, close, no music, no voice.", 2.5),
    "clack": ("A metal robotic arm segment snapping onto its mount with a hard clack and a bright electrical spark zap, then a small settling rattle. Dry, close, no music, no voice.", 1.5),
    "gasp_breath": ("A young woman sharply gasping in shock, a sudden panicked inhale. Close, dry, no words, no music.", 1.0),
}
SPEECH = {
    "gasp_a": "[startled, breathless] Oh!",
    "gasp_b": "[gasps, panicked] Oh!",
    "gasp_c": "[small, scared] Oh!",
}


def post(url: str, body: dict, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["curl", "-sS", "-m", "120", "-D", str(OUT / f"{name}.hdr"), "-o", str(OUT / f"{name}.mp3"), "-w", "%{http_code}", "-X", "POST", url, "-H", "xi-api-key: placeholder", "-H", "Content-Type: application/json", "-d", json.dumps(body)],
        capture_output=True,
        text=True,
    )
    cost = next((line.split(":")[1].strip() for line in (OUT / f"{name}.hdr").read_text().splitlines() if line.lower().startswith("character-cost")), "?")
    print(name, result.stdout, os.path.getsize(OUT / f"{name}.mp3"), "bytes, cost", cost, flush=True)
    if result.stdout != "200":
        print((OUT / f"{name}.mp3").read_text(errors="ignore")[:300])
        raise SystemExit(1)


def main() -> None:
    for name, (text, seconds) in EFFECTS.items():
        post("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {"text": text, "duration_seconds": seconds, "prompt_influence": 0.5}, name)
    for name, text in SPEECH.items():
        post(f"https://api.elevenlabs.io/v1/text-to-speech/{BELLA}?output_format=mp3_44100_128", {"text": text, "model_id": "eleven_v4", "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}, name)


if __name__ == "__main__":
    main()
