"""Asks Pixellab for the two pieces of Tilly's act (A: tinker, rip, shock; B: pick up, put back) and saves the 17 frames of each.

    python3 -I docs/design/heroes/pixellab-act/tools/generate.py raw/pass3

This costs generations (one per call at 64 x 64 px, so two for a pass) and a call cannot be taken back: do not run it to look at what it does.
The frames in `raw/pass1` and `raw/pass2` are the takes the clip was made from; `tools/build-frames.py` turns raw takes into `frames/`.

Access: in a cloud session the proxy puts the key on requests to api.pixellab.ai (nothing to set). Elsewhere set PIXELLAB_API_KEY.
The endpoint is `POST /v2/animate-with-text-v3`; it answers with a background job that is polled at `GET /v2/background-jobs/{id}`.
Limits that were met: the action text may have at most 1000 characters (longer gives 422); the frame count is 4 to 16 and even, and
width x height x frames must be at most 524288; the answer has frame_count + 1 frames, the first being the first frame that was sent.
"""

import base64
import io
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parents[1]
API = "https://api.pixellab.ai/v2"
BACKGROUND = (83, 80, 98, 255)
SEED = 7

# Pass 2, the prompts the clip was finished with. Pass 1 had the same texts without the sentence about the arm (see README.md).
ARM = (
    "Her right arm (on the left of the picture) is a grey metal robot arm: a square shoulder block and a gripper hand with a teal light. "
    "It stays metal in every frame. When she shrugs, the square shoulder block jerks up with her shoulders and the gripper swings loosely, a frame later. "
    "Her other arm is human. "
)
ACTION_A = (
    "Pixel art, side view, facing right, feet planted. Tilly reaches up and tinkers with the big gripper arm on her back, small jerky adjustments, a spark flickers. "
    "Then with a sharp snap the outer claw segment rips off and drops. Anticipation first, then the snap: her whole body recoils, head jerks back, eyes wide in shock, "
    "mouth open, shoulders shrug up, knees bend. The torn segment clatters on the ground beside her feet with dust and sparks. The stump on her back swings. "
) + ARM + "Strong squash and stretch, no blur. Keep outline and palette."
ACTION_B = (
    "Pixel art, same character. Still in shock, Tilly freezes one beat, then crouches fast and snatches the torn gripper segment from the ground, looks at it, "
    "swings it up behind her back and jams it onto the stump. A hard clack, a bright spark, the arm shakes and settles. "
    "She breathes out, shoulders drop, and returns to her calm standing pose of the last frame. "
) + ARM + "Snappy, follow-through. Keep outline and palette. No blur."


def on_background(image: Image.Image) -> Image.Image:
    flat = Image.new("RGBA", image.size, BACKGROUND)
    flat.paste(image, (0, 0), image)
    return flat


def encode(image: Image.Image) -> dict:
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return {"base64": base64.b64encode(buffer.getvalue()).decode()}


def call(url: str, body: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if os.environ.get("PIXELLAB_API_KEY"):
        headers["Authorization"] = f"Bearer {os.environ['PIXELLAB_API_KEY']}"
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, headers=headers)
    return json.load(urllib.request.urlopen(request, timeout=60))


def animate(first: Image.Image, action: str, last: Image.Image | None = None) -> list:
    body = {"first_frame": encode(first), "action": action, "frame_count": 16, "no_background": True, "seed": SEED}
    if last is not None:
        body["last_frame"] = encode(last)  # the animation is steered towards it: B ends in the pose of the reference
    job = call(f"{API}/animate-with-text-v3", body)["background_job_id"]
    for _ in range(60):
        answer = call(f"{API}/background-jobs/{job}")
        if answer["status"] != "processing":
            return [Image.open(io.BytesIO(base64.b64decode(image["base64"]))).convert("RGBA") for image in answer["last_response"]["images"]]
        time.sleep(5)
    raise TimeoutError(job)


def main() -> None:
    target = HERE / sys.argv[1]
    target.mkdir(parents=True, exist_ok=True)
    reference = Image.open(HERE / "reference.png").convert("RGBA")
    a = animate(reference, ACTION_A)
    b = animate(on_background(a[-1]), ACTION_B, last=reference)
    for prefix, frames in (("a", a), ("b", b)):
        for index, frame in enumerate(frames):
            frame.save(target / f"{prefix}_{index:02d}.png")
    print(f"{len(a)} + {len(b)} frames written to {target}")


if __name__ == "__main__":
    main()
