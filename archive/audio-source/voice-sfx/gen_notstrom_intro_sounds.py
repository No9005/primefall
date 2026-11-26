"""The sounds of the Notstrom Intro film (issue #482): the hyperspace flight, the exit from it, the breathing in the helmet, the ship's movement.

    python3 archive/audio-source/voice-sfx/gen_notstrom_intro_sounds.py

One call per take, no retry. Lossless first (`pcm_44100`, owner's rule of 2026-11-26): a refused format stops the script before anything is charged.
Every answer is saved with its response headers in `sfx/notstrom-intro/`. The API key is filled in by the proxy; the header is a placeholder.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sfx/notstrom-intro"
FORMAT = os.environ.get("INTRO_SFX_FORMAT", "pcm_44100")

EFFECTS = {
    "hyperspace_a": ("Sci-fi hyperspace flight: a smooth continuous tunnel of rushing light, a rising airy shimmering whoosh with a low sustained pitch rise. Only the travel, no rattle, no impacts. No music, no voice.", 4.0),
    "exit_a": ('Ship exits hyperspace: a deep low "wump" followed by a short deeper "fupp", soft heavy sub-bass pulses with a quick air release. No rattle, no music, no voice.', 2.0),
    "breath_a": ("Very quiet slow breathing of a person inside a space helmet, close microphone, soft muffled inhale and exhale, faint suit hiss. No voice, no music.", 4.0),
    "ship_a": ("Underwater rocket or submarine passing: low muffled engine rumble, slow propeller churn, soft hull creaks, deep and heavy. No music, no voice.", 6.0),
}


def post(body: dict, name: str) -> None:
    raw = OUT / f"{name}.{'pcm' if FORMAT.startswith('pcm') else 'mp3'}"
    result = subprocess.run(
        ["curl", "-sS", "-m", "120", "-D", str(OUT / f"{name}.hdr"), "-o", str(raw), "-w", "%{http_code}", "-X", "POST", f"https://api.elevenlabs.io/v1/sound-generation?output_format={FORMAT}", "-H", "xi-api-key: placeholder", "-H", "Content-Type: application/json", "-d", json.dumps(body)],
        capture_output=True,
        text=True,
    )
    cost = next((line.split(":")[1].strip() for line in (OUT / f"{name}.hdr").read_text().splitlines() if line.lower().startswith("character-cost")), "?")
    print(name, result.stdout, os.path.getsize(raw), "bytes, cost", cost, flush=True)
    if result.stdout != "200":
        print(raw.read_text(errors="ignore")[:300])
        raise SystemExit(1)
    if raw.suffix == ".pcm":
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "44100", "-ac", "2", "-i", str(raw), str(raw.with_suffix(".wav"))], check=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1:] or list(EFFECTS)
    for name in only:
        text, seconds = EFFECTS[name]
        post({"text": text, "duration_seconds": seconds, "prompt_influence": 0.5}, name)


if __name__ == "__main__":
    main()
