import { readFileSync } from "node:fs";
import { Container, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { AtlasAnimator, type AtlasSheet } from "./atlas-animator";
import { parseAtlas } from "./atlas";
import { createStage, type AssetSource, type Scene, type StageEnvironment, type StageHost } from "./stage";

/** A sheet with one fake texture per frame name, as PixiJS's loader would make from the JSON. */
function sheetOf(json: unknown): AtlasSheet & { textures: Record<string, Texture> } {
  const data = parseAtlas(json);
  const textures = Object.fromEntries(Object.keys(data.frames).map((name) => [name, new Texture()]));
  const animations = Object.fromEntries(Object.entries(data.animations).map(([name, frames]) => [name, frames.map((frame) => textures[frame] as Texture)]));
  return { animations, data: json, textures };
}

/** A synthetic atlas: every animation has distinct frames; `layers` get the same frame count. */
function syntheticJson(animations: Record<string, { frames: number; durationMs?: number }>) {
  const frames: Record<string, unknown> = {};
  const list: Record<string, string[]> = {};
  const clips: Record<string, unknown> = {};
  for (const [name, { frames: count, durationMs }] of Object.entries(animations)) {
    list[name] = [];
    for (let i = 0; i < count; i++) {
      const key = `${name}.${i}`;
      frames[key] = { frame: { x: i, y: 0, w: 1, h: 1 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 }, sourceSize: { w: 1, h: 1 }, anchor: { x: 0.5, y: 1 } };
      list[name].push(key);
    }
    if (durationMs !== undefined) clips[name] = { frames: count, durationMs };
  }
  return { frames, animations: list, meta: { image: "x.png", size: { w: 64, h: 1 }, scale: "1", clips } };
}

const shownTexture = (animator: AtlasAnimator, layer = 0) => (animator.container.children[layer] as unknown as { texture: Texture }).texture;

describe("atlas animator", () => {
  it("loops: shows the expected frame at each fixed step and wraps", () => {
    const sheet = sheetOf(syntheticJson({ loop: { frames: 4, durationMs: 200 } }));
    const animator = new AtlasAnimator(sheet);
    animator.play("loop", { loop: true });
    const seen: number[] = [];
    for (let step = 0; step < 6; step++) {
      seen.push(animator.frame);
      expect(shownTexture(animator)).toBe(sheet.animations.loop?.[animator.frame]);
      animator.update(50);
    }
    expect(seen).toEqual([0, 1, 2, 3, 0, 1]);
    expect(animator.animating).toBe(true);
  });

  it("plays a one-shot once, rests on the last frame and calls onComplete once", () => {
    const animator = new AtlasAnimator(sheetOf(syntheticJson({ shot: { frames: 3, durationMs: 150 } })));
    let completed = 0;
    animator.onComplete = () => completed++;
    animator.play("shot");
    animator.update(49);
    expect(animator.frame).toBe(0);
    animator.update(1);
    expect(animator.frame).toBe(1);
    animator.update(100);
    expect(completed).toBe(1);
    expect(animator.frame).toBe(2);
    expect(animator.animating).toBe(false);
    animator.update(500);
    expect(completed).toBe(1);
  });

  it("restarts, pauses and resumes", () => {
    const animator = new AtlasAnimator(sheetOf(syntheticJson({ shot: { frames: 4, durationMs: 400 } })));
    animator.play("shot");
    animator.update(250);
    expect(animator.frame).toBe(2);
    animator.pause();
    expect(animator.animating).toBe(false);
    animator.update(1000);
    expect(animator.frame).toBe(2);
    animator.resume();
    expect(animator.animating).toBe(true);
    animator.restart();
    expect(animator.frame).toBe(0);
    animator.stop();
    expect(animator.animating).toBe(false);
    expect(animator.container.children).toHaveLength(0);
  });

  it("plays the right total time when the duration is not a multiple of the frame count", () => {
    const sheet = sheetOf(syntheticJson({ idle: { frames: 40, durationMs: 2000 }, drop: { frames: 8, durationMs: 550 } }));
    const idle = new AtlasAnimator(sheet);
    idle.play("idle");
    idle.update(1999);
    expect(idle.animating).toBe(true);
    idle.update(1);
    expect(idle.animating).toBe(false);

    const drop = new AtlasAnimator(sheet);
    drop.play("drop");
    drop.update(549);
    expect(drop.animating).toBe(true);
    expect(drop.frame).toBe(7);
    drop.update(1);
    expect(drop.animating).toBe(false);
  });

  it("shows a still frame in reduced motion and still completes a one-shot", () => {
    const animator = new AtlasAnimator(sheetOf(syntheticJson({ loop: { frames: 4, durationMs: 200 }, shot: { frames: 4, durationMs: 200 } })));
    animator.setReducedMotion(true);
    let completed = 0;
    animator.onComplete = () => completed++;
    animator.play("loop", { loop: true });
    animator.update(120);
    expect(animator.frame).toBe(0);
    expect(animator.animating).toBe(false);
    animator.play("shot");
    expect(animator.frame).toBe(3);
    expect(completed).toBe(1);
    expect(animator.animating).toBe(false);
  });

  it("keeps the layers of a clip in the same frame at all times", () => {
    const sheet = sheetOf(syntheticJson({ back: { frames: 5 }, figure: { frames: 5 }, front: { frames: 5 } }));
    const animator = new AtlasAnimator(sheet);
    animator.play(["back", "figure", "front"], { loop: true });
    expect(animator.container.children).toHaveLength(3);
    for (let step = 0; step < 17; step++) {
      for (const [layer, name] of ["back", "figure", "front"].entries()) expect(shownTexture(animator, layer)).toBe(sheet.animations[name]?.[animator.frame]);
      animator.update(37);
    }
  });

  it("refuses layers of different lengths and unknown animations", () => {
    const animator = new AtlasAnimator(sheetOf(syntheticJson({ a: { frames: 2 }, b: { frames: 3 } })));
    expect(() => animator.play(["a", "b"])).toThrow(/same number of frames/);
    expect(() => animator.play("missing")).toThrow(/no animation/);
  });

  it("scales by whole numbers, mirrors and uses nearest-neighbour textures", () => {
    const sheet = sheetOf(syntheticJson({ a: { frames: 2 } }));
    const animator = new AtlasAnimator(sheet);
    animator.setScale(3);
    animator.setMirrored(true);
    expect([animator.container.scale.x, animator.container.scale.y]).toEqual([-3, 3]);
    animator.setMirrored(false);
    expect(animator.container.scale.x).toBe(3);
    expect(sheet.animations.a?.every((texture) => texture.source.scaleMode === "nearest")).toBe(true);
  });

  it("plays the match Heroes' sheets (no timing in the JSON: 20 frames per second, three layers)", () => {
    const json = JSON.parse(readFileSync(new URL("../public/assets/heroes/bruiser/slam.json", import.meta.url), "utf8"));
    const sheet = sheetOf(json);
    const layers = ["bruiser.slam.fx_back", "bruiser.slam.figure", "bruiser.slam.fx_front"];
    const animator = new AtlasAnimator(sheet);
    animator.play(layers);
    const count = sheet.animations["bruiser.slam.figure"]?.length ?? 0;
    animator.update(50 * 7);
    expect(animator.frame).toBe(7);
    layers.forEach((name, layer) => expect(shownTexture(animator, layer)).toBe(sheet.animations[name]?.[7]));
    animator.update(50 * count);
    expect(animator.animating).toBe(false);
    expect(animator.frame).toBe(count - 1);
  });
});

describe("atlas parser", () => {
  it("rejects an animation that names an unknown frame, a wrong frame count and a page over 4096", () => {
    const good = syntheticJson({ a: { frames: 2, durationMs: 100 } });
    expect(() => parseAtlas(good)).not.toThrow();
    expect(() => parseAtlas({ ...good, animations: { a: ["a.0", "nope"] } })).toThrow(/unknown frame/);
    expect(() => parseAtlas({ ...good, meta: { ...good.meta, clips: { a: { frames: 3, durationMs: 100 } } } })).toThrow(/timing says 3/);
    expect(() => parseAtlas({ ...good, meta: { ...good.meta, size: { w: 4097, h: 1 } } })).toThrow(/larger than 4096/);
  });
});

describe("atlas animator on the stage", () => {
  it("is used by a scene through the stage's AssetSource and released on leave", async () => {
    const atlasUrl = "assets/hangar/atlas/max.json";
    const json = JSON.parse(readFileSync(new URL("../public/assets/hangar/atlas/max.json", import.meta.url), "utf8"));
    const loaded: string[] = [];
    const unloaded: string[] = [];
    const assets: AssetSource = { load: async (urls) => void loaded.push(...urls), unload: async (urls) => void unloaded.push(...urls) };
    let animator: AtlasAnimator | undefined;
    const scene: Scene = {
      name: "hangar-test",
      assets: [atlasUrl],
      create() {
        animator = new AtlasAnimator(sheetOf(json));
        animator.play("max.idle", { loop: true });
        const container = new Container();
        container.addChild(animator.container);
        return container;
      },
      update: (deltaMs) => animator?.update(deltaMs),
      ready: () => animator !== undefined,
      animating: () => animator?.animating ?? false,
    };
    const host: StageHost = { root: { setAttribute: () => {} }, show: () => {}, hide: () => {}, applyFit: () => {}, applyFill: () => {}, render: () => {}, onContextLost: () => {}, onContextRestored: () => {}, destroy: () => {} };
    const environment: StageEnvironment = {
      window: { width: 844, height: 390, devicePixelRatio: 1 },
      isHidden: () => false,
      reducedMotion: { matches: () => false, subscribe: () => () => {} },
      onChange: () => () => {},
    };
    const stage = createStage({ host, assets, clock: { request: () => 1, cancel: () => {}, now: () => 0 }, environment, scenes: [scene] });
    await stage.showScene("hangar-test");
    expect(loaded).toEqual([atlasUrl]);
    stage.step(100);
    expect(animator?.frame).toBe(2);
    await stage.leaveScene();
    expect(unloaded).toEqual([atlasUrl]);
  });
});
