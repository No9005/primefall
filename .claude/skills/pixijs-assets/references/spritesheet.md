# Spritesheet

## Quick start

```ts
const sheet = await Assets.load("spritesheet.json");

const hero = new Sprite(sheet.textures["hero.png"]);
app.stage.addChild(hero);

const walk = new AnimatedSprite(sheet.animations["walk"]);
walk.animationSpeed = 0.15;
walk.play();
```

## JSON format

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
    "walk": ["walk_01.png", "walk_02.png"]
  },
  "meta": {
    "image": "spritesheet.png",
    "size": { "w": 512, "h": 256 },
    "scale": "1"
  }
}
```

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

## Common mistakes

- Ensure `meta.scale` matches the atlas resolution.
- Do not access textures before parse completes.
