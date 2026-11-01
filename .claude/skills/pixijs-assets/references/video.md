# Video Textures

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
  },
});
```

## Common mistakes

- Mobile autoplay needs muted and playsinline.
- Cross-origin video needs CORS.
