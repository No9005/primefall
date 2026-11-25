"""The sounds of the hangar of the Hero Select (call 45 in PROMPTS.md): the flickering light and the sparks of the fuse boxes, Max's lifting, throwing and the barbell
crashing against the metal door, and Kit's "Nice." when the rifle gleams.

    python3 archive/audio-source/voice-sfx/gen_hangar_sounds.py

One call per take, no retry: a call that fails stops the script (a retry would start and charge a second generation). Every answer is saved with its response
headers in `sfx/hangar/`. The API key is filled in by the proxy of the session; the header here is a placeholder.
"""

import json
import os
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sfx/hangar"
MAX = ("SAxJUlDKRc79XAyeWyMu", 0.3)  # Morgan, Deep, Powerful and Confident: voice id and stability (CHARACTERS.md)
KIT = ("2gPFXx8pN3Avh27Dw5Ma", 0.5)  # Oxley, Evil Character, kept quiet

FLICKER = "An old fluorescent ceiling light flickering: a short stuttering electric buzz with two quick ticks, then fading. Close, dry, no music, no voice."
SPARK = "Electric sparks jumping from a damaged fuse box: a crisp crackling zap with a few snapping pops. Short, dry, no music, no voice."
SET_DOWN = "A heavy steel barbell set down hard on a concrete floor: a deep thud, a short metallic ring, a rattle of the plates. Dry, close, no music, no voice."
WHOOSH = "A heavy steel barbell flying sideways through the air with a fast low whoosh. Dry, close, no voice, no music."
CRASH = "A heavy steel barbell crashing against a metal door: a huge clanging boom, a shower of sparks crackling, a long rattling metallic aftershock. Dry, close, no music, no voice."

EFFECTS = {
    "flicker_a": (FLICKER, 0.8),
    "flicker_b": (FLICKER, 0.8),
    "spark_a": (SPARK, 0.8),
    "spark_b": (SPARK, 0.8),
    "set_down_a": (SET_DOWN, 1.0),
    "set_down_b": (SET_DOWN, 1.0),
    "whoosh_a": (WHOOSH, 1.0),
    "whoosh_b": (WHOOSH, 1.0),
    "crash_a": (CRASH, 2.0),
    "crash_b": (CRASH, 2.0),
}
# The training grunts and the effort of the throw are Max's own voice (the effect model makes another man).
SPEECH = {
    "lift_a": (MAX, "[strained] Nnnngh... hnnnnh... HAH!"),
    "lift_b": (MAX, "[grunts, strained] Hnnnnngh... nnngh..."),
    "lift_c": (MAX, "[strained, wheezing] Hnnn... nngh... hah."),
    "throw_a": (MAX, "[shouting] HRAAAH!"),
    "throw_b": (MAX, "[roars] RRAAAGH!"),
    "nice_a": (KIT, "[quietly, content] Nice."),
    "nice_b": (KIT, "[dryly, quietly] Nice."),
    "nice_c": (KIT, "[softly, calm] Nice..."),
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
    for name, ((voice, stability), text) in SPEECH.items():
        post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128", {"text": text, "model_id": "eleven_v4", "voice_settings": {"stability": stability, "similarity_boost": 0.75}}, name)


if __name__ == "__main__":
    main()
