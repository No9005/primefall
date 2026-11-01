# Video Textures

PixiJS loads videos through `Assets.load()` and returns a `Texture` backed by a `VideoSource`.

## Quick start

```ts
const videoTex = await Assets.load("intro.mp4");
const sprite = new Sprite(videoTex);
app.stage.addChild(sprite);
```

## Load options

```ts
const texture = await Assets.load({
  src: "city.mp4",
  data: {
    autoPlay: false,
    loop: true,
    muted: true,
    preload: true,
    playsinline: true,
    updateFPS: 30,
  },
});
```

## Format fallback

```ts
Assets.add({
  alias: "clip",
  src: "clip.{webm,mp4}",
});
```

## Mobile autoplay

Set both `muted: true` and `playsinline: true` for autoplay on iOS and mobile Chrome.

## Manual playback

```ts
const videoSource = texture.source;
videoSource.resource.play();
```

## Common mistakes

- Mobile browsers block autoplay with sound.
- Cross-origin video needs CORS headers for canvas extraction.
