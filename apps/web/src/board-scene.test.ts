import { describe, expect, it } from "vitest";
import { createBoardClock, createBoardScene, type BoardAssets } from "./board-scene";
import { BoardGestures, type GestureHost } from "./board-gestures";
import { computeFill, MAX_CANVAS_SIDE } from "./stage-fit";
import { createStage, type StageEnvironment, type StageHost } from "./stage";
import { type Camera, type CameraView, fitCamera, isZoomed, nearestPixelStepScale, pixelMaxScale, pixelStepBy } from "./board-layout";
import type { PixelAtlas } from "./pixel-terrain";

function setup(windowSize = { width: 844, height: 390 }) {
  const attributes: Record<string, string> = {};
  const state = { renders: 0, loads: [] as string[], unloads: [] as string[], fills: [] as { width: number; height: number; resolution: number }[], mount: { width: 600, height: 300 } };
  let pending: (() => void) | undefined;
  let lost = () => {};
  let restored = () => {};
  const changeListeners: (() => void)[] = [];
  const host: StageHost = {
    root: { setAttribute: (name, value) => void (attributes[name] = value) },
    show: () => {},
    hide: () => {},
    size: () => state.mount,
    applyFit: () => {},
    applyFill: (view) => void state.fills.push(view),
    render: () => void state.renders++,
    onContextLost: (cb) => void (lost = cb),
    onContextRestored: (cb) => void (restored = cb),
    destroy: () => {},
  };
  const environment: StageEnvironment = {
    window: { ...windowSize, devicePixelRatio: 3 },
    isHidden: () => false,
    reducedMotion: { matches: () => false, subscribe: () => () => {} },
    onChange: (cb) => (changeListeners.push(cb), () => {}),
  };
  const clock = { request: (cb: () => void) => ((pending = cb), 1), cancel: () => void (pending = undefined), now: () => 0 };
  const assets = { load: async (urls: readonly string[]) => void state.loads.push(...urls), unload: async (urls: readonly string[]) => void state.unloads.push(...urls) };
  const boardAssets: BoardAssets & { resets: number } = {
    resets: 0,
    load: async () => ({}) as PixelAtlas,
    urls: () => ["notstrom.json", "max/walk.json"],
    reset() {
      boardAssets.resets++;
    },
  };
  const scene = createBoardScene(boardAssets);
  const stage = createStage({ host, assets, clock, environment, scenes: [scene] });
  return {
    stage, scene, attributes, state, boardAssets,
    hasPendingFrame: () => pending !== undefined,
    loseContext: () => lost(),
    restoreContext: () => restored(),
    windowChanged: () => changeListeners.forEach((cb) => cb()),
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the fill mode of the stage", () => {
  it("hands the view the real size, not the design frame, and caps the resolution", () => {
    expect(computeFill(844, 390, 2)).toEqual({ width: 844, height: 390, resolution: 2 });
    const big = computeFill(2560, 1440, 3);
    expect(big.width).toBe(2560);
    expect(2560 * big.resolution).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });

  it("sizes the canvas to the element the stage is mounted in and tells the scene once per real change", async () => {
    const t = setup();
    const seen: { width: number; height: number }[] = [];
    t.scene.watchView((view) => seen.push({ width: view.width, height: view.height }));
    await t.stage.showScene("board");
    expect(t.state.fills.at(-1)).toEqual({ width: 600, height: 300, resolution: 3 });
    expect(t.scene.view()).toMatchObject({ width: 600, height: 300 });
    t.windowChanged();
    expect(seen).toEqual([{ width: 600, height: 300 }]);
    t.state.mount = { width: 700, height: 350 };
    t.windowChanged();
    expect(seen.at(-1)).toEqual({ width: 700, height: 350 });
  });
});

describe("the board scene", () => {
  it("is ready only once the board drew its tiles and Heroes, and clears the seam and the textures when left", async () => {
    const t = setup();
    await t.stage.showScene("board");
    expect(t.attributes["data-scene"]).toBe("board");
    expect(t.attributes["data-scene-ready"]).toBe("false");
    expect(t.state.loads).toEqual(["notstrom.json", "max/walk.json"]);
    t.scene.markDrawn();
    t.stage.step(16);
    expect(t.attributes["data-scene-ready"]).toBe("true");
    await t.stage.leaveScene();
    expect(t.attributes["data-scene"]).toBe("");
    expect(t.attributes["data-scene-ready"]).toBe("false");
    expect(t.state.unloads).toEqual(["notstrom.json", "max/walk.json"]);
    expect(t.boardAssets.resets).toBe(1);
    expect(t.scene.layers()).toBeUndefined();
  });

  it("runs no frames while nothing animates, and animations advance with the stage clock", async () => {
    const t = setup();
    await t.stage.showScene("board");
    expect(t.hasPendingFrame()).toBe(false);
    const seen: number[] = [];
    const stop = t.scene.clock.subscribe((now) => seen.push(now));
    expect(t.hasPendingFrame()).toBe(true);
    t.stage.step(250);
    t.stage.step(50);
    expect(seen).toEqual([250, 300]);
    stop();
    expect(t.scene.animating()).toBe(false);
  });

  it("rebuilds from the same watchers after a lost context", async () => {
    const t = setup();
    const built: unknown[] = [];
    t.scene.watchLayers((layers) => built.push(layers));
    await t.stage.showScene("board");
    const first = t.scene.layers();
    t.loseContext();
    t.restoreContext();
    await flush();
    expect(t.scene.layers()).toBeDefined();
    expect(t.scene.layers()).not.toBe(first);
    expect(t.attributes["data-scene"]).toBe("board");
    // layers, undefined (left), layers again
    expect(built.map((layers) => layers !== undefined)).toEqual([true, false, true]);
  });
});

describe("the board clock", () => {
  it("steps subscribers by the delta and lets one unsubscribe itself while running", () => {
    const clock = createBoardClock();
    const calls: string[] = [];
    const stopA = clock.subscribe((now) => {
      calls.push(`a${now}`);
      stopA();
    });
    clock.subscribe((now) => calls.push(`b${now}`));
    clock.advance(10);
    clock.advance(10);
    expect(calls).toEqual(["a10", "b10", "b20"]);
  });
});

describe("the input layer's gestures", () => {
  const view: CameraView = { width: 844, height: 390, pixel: true };
  function gestures(initial?: Camera) {
    const log = { taps: [] as { x: number; y: number }[], presses: [] as (object | undefined)[], byHand: [] as Camera[] };
    let camera = initial ?? fitCamera(view);
    const host: GestureHost = {
      camera: () => camera,
      view: () => view,
      setCameraByHand: (next) => {
        camera = next;
        log.byHand.push(next);
      },
      press: (point) => void log.presses.push(point),
      tap: (point) => void log.taps.push(point),
    };
    return { log, input: new BoardGestures(host), camera: () => camera };
  }

  it("taps where the finger came up", () => {
    const g = gestures();
    g.input.pointerDown(1, 100, 100);
    g.input.pointerUp(1, 101, 100);
    expect(g.log.taps).toEqual([{ x: 101, y: 100 }]);
    expect(g.log.presses.at(-1)).toBeUndefined();
  });

  it("pans a zoomed board with one finger and does not tap after a drag", () => {
    const fitted = fitCamera(view);
    const start = { ...fitted, scale: pixelStepBy(fitted.scale, 1) };
    const g = gestures(start);
    expect(isZoomed(g.camera(), view)).toBe(true);
    g.input.pointerDown(1, 100, 100);
    g.input.pointerMove(1, 130, 100);
    expect(g.log.byHand).toHaveLength(1);
    expect(g.log.byHand[0]!.scale).toBe(start.scale);
    expect(g.log.byHand[0]!.x).not.toBe(start.x);
    g.input.pointerUp(1, 130, 100);
    expect(g.log.taps).toEqual([]);
  });

  it("does not pan an overview that shows the whole board, but still taps", () => {
    const g = gestures();
    g.input.pointerDown(1, 100, 100);
    g.input.pointerMove(1, 160, 100);
    g.input.pointerUp(1, 160, 100);
    expect(g.log.byHand).toEqual([]);
    expect(g.log.taps).toHaveLength(1);
  });

  it("pinches with two fingers, lands on a whole zoom step and does not tap", () => {
    const g = gestures();
    g.input.pointerDown(1, 400, 200);
    g.input.pointerDown(2, 440, 200);
    g.input.pointerMove(2, 600, 200);
    expect(g.log.byHand.length).toBeGreaterThan(0);
    // A fourfold pinch zooms in, within the limit, and lands on a whole step (the same one the wheel and the buttons reach).
    const fitted = fitCamera(view).scale;
    expect(g.camera().scale).toBeGreaterThan(fitted);
    expect(g.camera().scale).toBeLessThanOrEqual(pixelMaxScale(fitted));
    expect(nearestPixelStepScale(g.camera().scale)).toBe(g.camera().scale);
    g.input.pointerUp(2, 600, 200);
    g.input.pointerUp(1, 400, 200);
    expect(g.log.taps).toEqual([]);
  });

  it("zooms one step for a wheel notch and ignores the run-out of a trackpad swipe", () => {
    const g = gestures();
    g.input.wheel({ x: 400, y: 200, deltaY: -1, deltaMode: 1, at: 0 });
    const zoomed = g.camera().scale;
    expect(zoomed).toBe(pixelStepBy(fitCamera(view).scale, 1));
    g.input.wheel({ x: 400, y: 200, deltaY: -50, deltaMode: 0, at: 50 });
    expect(g.camera().scale).toBe(zoomed);
  });
});
