"""Tilly's breathing for the close-up of the Notstrom Intro (issue #482, call 48 in PROMPTS.md): three takes, tags and no words. A text of tags alone is refused (400, "empty text", nothing charged), so each has a spoken "Hhh...".

    python3 archive/audio-source/voice-sfx/gen_tilly_breath.py

One call per take, no retry. `pcm_44100` is refused for speech below the Pro tier (403, nothing charged), so MP3 128 kbit/s like the other speech takes (owner's choice, 2026-11-26). Every answer is saved with its
response headers in `sfx/notstrom-intro/`. The API key is filled in by the proxy; the header is a placeholder.
"""

import json
import os
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sfx/notstrom-intro"
BELLA = "hpp4J3VqNfWAUOO0d1Us"  # Tilly's voice (CHARACTERS.md)

TAKES = {
    "tilly_breath_a": "[breathing softly, hushed] Hhh... [inhales slowly] [short pause] Hhh... [exhales slowly] [inhales slowly] [short pause] [exhales slowly]",
    "tilly_breath_b": "[hushed, nervous] Hhh... [inhales] [short pause] Hhhh... [exhales] [inhales] [short pause] [exhales softly]",
    "tilly_breath_c": "[whispers] Hhh... [slow breath in] [short pause] Hhh... [slow breath out]",
}


def post(name: str, text: str) -> None:
    raw = OUT / f"{name}.mp3"
    body = {"text": text, "model_id": "eleven_v4", "voice_settings": {"stability": 0.3, "similarity_boost": 0.75}}
    result = subprocess.run(
        ["curl", "-sS", "-m", "120", "-D", str(OUT / f"{name}.hdr"), "-o", str(raw), "-w", "%{http_code}", "-X", "POST", f"https://api.elevenlabs.io/v1/text-to-speech/{BELLA}?output_format=mp3_44100_128", "-H", "xi-api-key: placeholder", "-H", "Content-Type: application/json", "-d", json.dumps(body)],
        capture_output=True,
        text=True,
    )
    cost = next((line.split(":")[1].strip() for line in (OUT / f"{name}.hdr").read_text().splitlines() if line.lower().startswith("character-cost")), "?")
    print(name, result.stdout, os.path.getsize(raw), "bytes, cost", cost, flush=True)
    if result.stdout != "200":
        print(raw.read_text(errors="ignore")[:300])
        raise SystemExit(1)


def main() -> None:
    for name, text in TAKES.items():
        post(name, text)


if __name__ == "__main__":
    main()
