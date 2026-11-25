"""The second try at the barbell sounds and the flickering light of the hangar (call 46 in PROMPTS.md): the first takes lacked weight and did not sound like a fluorescent tube.

    python3 archive/audio-source/voice-sfx/gen_hangar_sounds2.py

One call per take, no retry. Every answer is saved with its response headers in `sfx/hangar/`. The API key is filled in by the proxy; the header is a placeholder.
"""

import json
import os
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sfx/hangar"

FLOOR = "A huge Olympic barbell loaded with thick cast-iron weight plates dropped from head height onto a concrete floor: a massive deep boom that shakes the room, the iron plates crashing and rattling against each other, a long low metallic ring. Extremely heavy, close, dry, no music, no voice."
WHOOSH = "A very heavy iron barbell with big weight plates swung and thrown through the air: a low, thick, rumbling whoosh with a dull metallic rattle of the plates, heavy and slow-moving. Close, dry, no voice, no music."
LOCKER = "A huge heavy barbell with iron plates slammed into a steel locker door at full speed: a thunderous deep metallic impact, the sheet metal buckling and booming, plates clanging, a long rattling and ringing aftershock, sparks crackling. Extremely heavy, close, dry, no music, no voice."
TUBE = "A fluorescent tube light flickering and starting up: a rapid ticking, a harsh electric buzz with the typical 100 Hz mains hum, a few stuttering blinks, then a steady low hum. Close, dry, no music, no voice."

EFFECTS = {
    "floor_a": (FLOOR, 1.5),
    "floor_b": (FLOOR, 1.5),
    "heavy_whoosh_a": (WHOOSH, 1.0),
    "heavy_whoosh_b": (WHOOSH, 1.0),
    "locker_a": (LOCKER, 2.5),
    "locker_b": (LOCKER, 2.5),
    "tube_a": (TUBE, 1.0),
    "tube_b": (TUBE, 1.0),
}


def post(body: dict, name: str) -> None:
    result = subprocess.run(
        ["curl", "-sS", "-m", "120", "-D", str(OUT / f"{name}.hdr"), "-o", str(OUT / f"{name}.mp3"), "-w", "%{http_code}", "-X", "POST", "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", "-H", "xi-api-key: placeholder", "-H", "Content-Type: application/json", "-d", json.dumps(body)],
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
        post({"text": text, "duration_seconds": seconds, "prompt_influence": 0.5}, name)


if __name__ == "__main__":
    main()
