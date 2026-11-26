import { type Container, Rectangle, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createNotstromIntroScene, NOTSTROM_INTRO_SCENE_NAME } from "./notstrom-intro-scene";
import { createStage, type AssetSource, type StageEnvironment, type StageHost, type VideoClip } from "./stage";

const FILM = { width: 1280, height: 592 };

/** A film that the test drives: it counts how often it plays and pauses and lets the test end or break it. */
function fakeClip() {
  let handlers: { ended(): void; failed(): void } | undefined;
  const state = { plays: 0, pauses: 0, frame: true, rejectPlay: false, listeners: 0 };
  const clip: VideoClip = {
    texture: new Texture({ frame: new Rectangle(0, 0, FILM.width, FILM.height) }),
    hasFrame: () => state.frame,
    play: () => {
      state.plays++;
      return state.rejectPlay ? Promise.reject(new Error("blocked")) : Promise.resolve();
    },
    pause: () => void state.pauses++,
    currentTime: 0,
    listen(next) {
      handlers = next;
      state.listeners++;
      return () => void state.listeners--;
    },
  };
  return { clip, state, end: () => handlers?.ended(), fail: () => handlers?.failed() };
}

function setup(options: { window?: { width: number; height: number }; failToLoad?: boolean } = {}) {
  const attributes: Record<string, string> = {};
  const state = { loads: [] as string[][], unloaded: [] as VideoClip[], hidden: false };
  const shown: Container[] = [];
  const film = fakeClip();
  let pending: (() => void) | undefined;
  let lost = () => {};
  let restored = () => {};
  let changed = () => {};
  const host: StageHost = {
    root: { setAttribute: (name, value) => void (attributes[name] = value) },
    show: (container) => void shown.push(container),
    hide: () => {},
    applyFit: () => {},
    applyFill: () => {},
    render: () => {},
    onContextLost: (callback) => void (lost = callback),
    onContextRestored: (callback) => void (restored = callback),
    destroy: () => {},
  };
  const assets: AssetSource = {
    load: async () => {},
    unload: async () => {},
    loadVideo: async (formats) => {
      state.loads.push([...formats]);
      if (options.failToLoad) throw new Error("decode error");
      return film.clip;
    },
    unloadVideo: async (clip) => void state.unloaded.push(clip),
  };
  const environment: StageEnvironment = {
    window: { ...(options.window ?? { width: 844, height: 390 }), devicePixelRatio: 1 },
    isHidden: () => state.hidden,
    reducedMotion: { matches: () => false, subscribe: () => () => {} },
    onChange: (callback) => ((changed = callback), () => {}),
  };
  const clock = { request: (callback: () => void) => ((pending = callback), 1), cancel: () => void (pending = undefined), now: () => 0 };
  const scene = createNotstromIntroScene(() => ["film.webm", "film.mp4"]);
  const stage = createStage({ host, assets, clock, environment, scenes: [scene] });
  const results: boolean[] = [];
  scene.watch((playedToEnd) => results.push(playedToEnd));
  return {
    scene,
    stage,
    film,
    attributes,
    state,
    results,
    sprite: () => shown[shown.length - 1]?.children.find((child): child is Sprite => child instanceof Sprite),
    hasPendingFrame: () => pending !== undefined,
    loseContext: () => lost(),
    restoreContext: () => restored(),
    pageChanged: (hidden: boolean) => {
      state.hidden = hidden;
      changed();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Notstrom Intro scene", () => {
  it("loads the film in both formats, plays it at once and is ready when the first picture can be drawn", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    expect(t.state.loads).toEqual([["film.webm", "film.mp4"]]);
    expect(t.film.state.plays).toBe(1);
    expect(t.attributes["data-scene"]).toBe(NOTSTROM_INTRO_SCENE_NAME);
    expect(t.attributes["data-scene-ready"]).toBe("true");
    expect(t.sprite()?.texture.source.scaleMode).toBe("nearest");
    expect(t.hasPendingFrame()).toBe(true);
  });

  it("tells the sounds how far the film itself is, only while it plays", async () => {
    const t = setup();
    const heard: number[] = [];
    t.scene.clock = (filmMs) => heard.push(filmMs);
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.film.clip.currentTime = 2.7;
    t.scene.update(0);
    t.scene.skip();
    t.film.clip.currentTime = 3;
    t.scene.update(0);
    expect(heard.at(-1)).toBe(2700);
    expect(heard).not.toContain(3000);
  });

  it("is not ready while the first picture cannot be drawn", async () => {
    const t = setup();
    t.film.state.frame = false;
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    expect(t.attributes["data-scene-ready"]).toBe("false");
  });

  it("tells the screen once that the film ran to its end, and stops the ticker", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.film.end();
    t.film.end();
    t.scene.skip();
    expect(t.results).toEqual([true]);
    expect(t.scene.animating()).toBe(false);
  });

  it("tells the screen once that a tap skipped it, and pauses the film", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.scene.skip();
    t.scene.skip();
    t.film.end();
    expect(t.results).toEqual([false]);
    expect(t.film.state.pauses).toBeGreaterThan(0);
  });

  it("finishes as if skipped when the film cannot be loaded", async () => {
    const t = setup({ failToLoad: true });
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    expect(t.results).toEqual([false]);
  });

  it("finishes as if skipped when the film fails while it plays", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.film.fail();
    expect(t.results).toEqual([false]);
  });

  it("finishes as if skipped when the browser blocks the film", async () => {
    const t = setup();
    t.film.state.rejectPlay = true;
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    await flush();
    expect(t.results).toEqual([false]);
  });

  it("releases the film and clears the seam on leaving", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    await t.stage.leaveScene();
    expect(t.state.unloaded).toEqual([t.film.clip]);
    expect(t.film.state.listeners).toBe(0);
    expect(t.attributes["data-scene"]).toBe("");
    expect(t.attributes["data-scene-ready"]).toBe("false");
    t.stage.destroy();
    expect(t.state.unloaded).toEqual([t.film.clip]);
  });

  it("pauses while the page is hidden and goes on when it returns", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.pageChanged(true);
    expect(t.film.state.pauses).toBe(1);
    expect(t.scene.animating()).toBe(false);
    t.pageChanged(false);
    expect(t.film.state.plays).toBe(2);
    expect(t.scene.animating()).toBe(true);
    expect(t.hasPendingFrame()).toBe(true);
  });

  it("rebuilds after a lost context and goes on from where the film was", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.film.clip.currentTime = 3.5;
    t.loseContext();
    t.restoreContext();
    await flush();
    await flush();
    expect(t.state.loads).toHaveLength(2);
    expect(t.film.clip.currentTime).toBe(3.5);
    expect(t.film.state.plays).toBe(2);
    expect(t.results).toEqual([]);
    expect(t.attributes["data-scene-ready"]).toBe("true");
  });

  it("plays again from the start the next time it is shown", async () => {
    const t = setup();
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    t.film.clip.currentTime = 2;
    t.scene.watch(undefined);
    await t.stage.leaveScene();
    t.scene.watch(() => {});
    t.film.clip.currentTime = 0;
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    expect(t.film.clip.currentTime).toBe(0);
  });

  it.each([
    ["phone landscape", 844, 390],
    ["4:3", 1024, 768],
    ["21:9", 2560, 1080],
  ])("shows the whole film, as large as fits and in the middle, in a %s window", async (_name, width, height) => {
    const t = setup({ window: { width, height } });
    await t.stage.showScene(NOTSTROM_INTRO_SCENE_NAME);
    const sprite = t.sprite()!;
    const shownWidth = FILM.width * sprite.scale.x;
    const shownHeight = FILM.height * sprite.scale.y;
    expect(sprite.scale.x).toBeCloseTo(sprite.scale.y);
    expect(shownWidth).toBeLessThanOrEqual(width + 1e-6);
    expect(shownHeight).toBeLessThanOrEqual(height + 1e-6);
    expect(Math.min(width - shownWidth, height - shownHeight)).toBeCloseTo(0);
    expect(sprite.x).toBeCloseTo((width - shownWidth) / 2);
    expect(sprite.y).toBeCloseTo((height - shownHeight) / 2);
  });
});
