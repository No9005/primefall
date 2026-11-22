# Scene atlases

One animation format for scenes (ADR 0026, rule 3): a PNG and a JSON in PixiJS v8's sprite sheet format. The match Heroes' sheets (`docs/design/pixel-heroes/README.md`) and the hangar atlases are the same format, so one loader and one player (`src/atlas-animator.ts`) read both.

## The JSON

- `frames`: trimmed frames, each with `frame`, `spriteSourceSize`, `sourceSize` and an `anchor`. Identical frames are stored once.
- `animations`: a name to a list of frame names; a frame may be named several times.
- `meta.clips` (optional): per animation name `{ "frames": n, "durationMs": ms }`. All frames of an animation share the duration evenly, so 40 frames in 2000 ms and 8 frames in 550 ms both play at the right total time. Sheets without it (the match Heroes') play at 20 frames per second.
- No page is larger than 4096 px on a side. `parseAtlas` in `src/atlas.ts` checks all of this.

Hangar atlases (`public/assets/hangar/atlas/<hero>.png|json`): one per Hero (`max`, `tilly`, `kit`), one animation per clip (`max.idle`, `max.tolift`, ...) and per bridge (`max.bridge.act`; a bridge's duration is its frames times `BRIDGE_FRAME_MS`). The anchor is the middle of the bottom edge of the whole frame. Clip frame counts and durations are not repeated anywhere: the packer reads `CLIPS` and `BRIDGES` of `src/hangar-select.ts`.

## The packer

```
npm run atlas -w apps/web            # write the atlases from the strips
npm run atlas -w apps/web -- --check # fail if the committed atlases differ from what the strips produce
```

It trims the transparent border of every frame, stores identical frames once and packs them in rows (tallest first, 1 px apart) into the smallest page within 4096 px. The output is deterministic. Check mode compares the JSON byte for byte and the picture by its pixels (compressed bytes can differ between zlib versions). A test runs the same check.
