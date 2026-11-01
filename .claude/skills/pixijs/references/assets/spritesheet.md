# Spritesheet: Texture Atlases and Animations

Load and use texture atlases and animation sheets with PixiJS's `Spritesheet` class. Atlases reduce draw calls by packing many textures into a single image.

## Quick start

```ts
const sheet = await Assets.load("spritesheet.json");

const hero = new Sprite(sheet.textures["hero.png"]);
app.stage.addChild(hero);

const walk = new AnimatedSprite(sheet.animations["walk"]);
walk.animationSpeed = 0.15;
walk.play();
app.stage.addChild(walk);
```

When loaded through `Assets.load()`, the JSON file is fetched, the atlas image is loaded, and `sheet.parse()` is called automatically.

## Spritesheet JSON format

```json
{
  "frames": {
    "hero.png": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 },
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "anchor": { "x": 0.5, "y": 0.5 }
    }
  },
  "animations": {
    "walk": ["walk_01.png", "walk_02.png", "walk_03.png"]
  },
  "meta": {
    "image": "spritesheet.png",
    "size": { "w": 512, "h": 256 },
    "scale": "1"
  }
}
```

Key fields:

- `frames` maps frame names to rectangle data, trim info, anchors, and 9-slice borders.
- `rotated` indicates the frame is stored rotated 90 degrees in the atlas.
- `trimmed` indicates transparent padding was removed.
- `animations` maps animation names to ordered frame-name arrays.
- `meta.scale` sets the texture-source resolution.
- `meta.image` is the atlas image filename, resolved relative to the JSON file.

## Manual creation

```ts
const texture = await Assets.load("atlas.png");
const sheet = new Spritesheet({
  texture,
  data: spritesheetJsonData,
  cachePrefix: "myAtlas_",
});
await sheet.parse();
```

`parse()` is async for large spritesheets. `cachePrefix` prevents cache collisions when multiple atlases share frame names.

## Cleanup

```ts
sheet.destroy();
sheet.destroy(true); // also destroys the base atlas texture
```

## Common mistakes

- Ensure `meta.scale` matches the actual atlas resolution.
- Do not access `sheet.textures` before parsing completes.
