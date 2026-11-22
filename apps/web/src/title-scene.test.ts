import { Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { WHIP_MS } from "./notstrom-intro";
import { computeHeightFit, DESIGN_HEIGHT, DESIGN_WIDTH } from "./stage-fit";
import { createStage, type AssetSource, type StageEnvironment, type StageHost } from "./stage";
import { FIREBALLS } from "./title-menu";
import {
  alternateProgress,
  burstAt,
  createTitleScene,
  fireballAt,
  flyLook,
  hazeOpacity,
  logoRise,
  streakLook,
  TITLE_SCENE_NAME,
  twinkleOpacity,
} from "./title-scene";

function setup(options: { reduced?: boolean } = {}) {
  const attributes: Record<string, string> = {};
  const state = { requests: 0, loads: [] as string[], unloads: [] as string[], fits: 0 };
  let pending: (() => void) | undefined;
  let lost = () => {};
  let restored = () => {};
  const host: StageHost = {
    root: { setAttribute: (name, value) => void (attributes[name] = value) },
    show: () => {},
    hide: () => {},
    applyFit: () => void state.fits++,
    applyFill: () => {},
    render: () => {},
    onContextLost: (callback) => void (lost = callback),
    onContextRestored: (callback) => void (restored = callback),
    destroy: () => {},
  };
  const assets: AssetSource = {
    load: async (urls) => void state.loads.push(...urls),
    unload: async (urls) => void state.unloads.push(...urls),
  };
  const environment: StageEnvironment = {
    window: { width: 844, height: 390, devicePixelRatio: 1 },
    isHidden: () => false,
    reducedMotion: { matches: () => options.reduced === true, subscribe: () => () => {} },
    onChange: () => () => {},
  };
  const clock = {
    request: (callback: () => void) => {
      state.requests++;
      pending = callback;
      return 1;
    },
    cancel: () => void (pending = undefined),
    now: () => 0,
  };
  const scene = createTitleScene({ texture: () => new Texture() });
  const stage = createStage({ host, assets, clock, environment, scenes: [scene] });
  return {
    scene,
    stage,
    attributes,
    state,
    hasPendingFrame: () => pending !== undefined,
    loseContext: () => lost(),
    restoreContext: () => restored(),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the title scene on the stage", () => {
  it("is ready when the first frame is drawn and clears the seam on leaving", async () => {
    const { stage, attributes } = setup();
    await stage.showScene(TITLE_SCENE_NAME);
    expect(attributes["data-scene"]).toBe(TITLE_SCENE_NAME);
    expect(attributes["data-scene-ready"]).toBe("true");
    await stage.leaveScene();
    expect(attributes["data-scene"]).toBe("");
    expect(attributes["data-scene-ready"]).toBe("false");
  });

  it("destroys what it loaded when it is left", async () => {
    const { stage, state } = setup();
    await stage.showScene(TITLE_SCENE_NAME);
    expect(state.loads).toHaveLength(8);
    expect(state.unloads).toEqual([]);
    await stage.leaveScene();
    expect([...state.unloads].sort()).toEqual([...state.loads].sort());
  });

  it("asks for the frame as high as the window", async () => {
    const { stage, scene } = setup();
    expect(scene.fit).toBe("height");
    await stage.showScene(TITLE_SCENE_NAME);
    expect(stage.fit().scale).toBeCloseTo(390 / DESIGN_HEIGHT);
  });

  it("runs the ticker while the crystals and stars move, and not with reduced motion", async () => {
    const moving = setup();
    await moving.stage.showScene(TITLE_SCENE_NAME);
    expect(moving.scene.animating()).toBe(true);
    expect(moving.hasPendingFrame()).toBe(true);

    const still = setup({ reduced: true });
    await still.stage.showScene(TITLE_SCENE_NAME);
    expect(still.scene.animating()).toBe(false);
    expect(still.hasPendingFrame()).toBe(false);
    expect(still.attributes["data-scene-ready"]).toBe("true");
  });

  it("calls the play callback once, WHIP_MS of stage time after the tap", async () => {
    const { stage, scene } = setup();
    await stage.showScene(TITLE_SCENE_NAME);
    let calls = 0;
    scene.fly(() => calls++);
    stage.step(WHIP_MS - 20);
    expect(calls).toBe(0);
    stage.step(40);
    expect(calls).toBe(1);
    stage.step(2000);
    expect(calls).toBe(1);
  });

  it("does not call the play callback when the fly-away is cancelled", async () => {
    const { stage, scene } = setup();
    await stage.showScene(TITLE_SCENE_NAME);
    let calls = 0;
    scene.fly(() => calls++)();
    stage.step(WHIP_MS + 100);
    expect(calls).toBe(0);
  });

  it("plays the fly-away with reduced motion as before and gives every frame's look to the screen", async () => {
    const { stage, scene } = setup({ reduced: true });
    await stage.showScene(TITLE_SCENE_NAME);
    const nears: number[] = [];
    scene.watchFly((look) => nears.push(look.near));
    scene.fly(() => {});
    expect(scene.animating()).toBe(true);
    stage.step(100);
    stage.step(100);
    expect(nears).toEqual([1.12, 1.38]);
  });

  it("rebuilds the title after the loss of the WebGL context", async () => {
    const { stage, attributes, loseContext, restoreContext } = setup();
    await stage.showScene(TITLE_SCENE_NAME);
    loseContext();
    expect(attributes["data-scene-ready"]).toBe("false");
    restoreContext();
    await flush();
    expect(attributes["data-scene"]).toBe(TITLE_SCENE_NAME);
    expect(attributes["data-scene-ready"]).toBe("true");
  });
});

describe("the frame as high as the window", () => {
  it.each([
    ["phone landscape", 844, 390],
    ["4:3", 1024, 768],
    ["21:9", 2560, 1080],
  ])("is as high as a %s window, with the sides cut or dark", (_name, width, height) => {
    const fit = computeHeightFit(width, height, 1);
    expect(fit.scale * DESIGN_HEIGHT).toBeCloseTo(height);
    expect(fit.offsetY).toBe(0);
    expect(fit.offsetX).toBeCloseTo((width - DESIGN_WIDTH * fit.scale) / 2);
    expect(fit.visible.left * fit.scale).toBeCloseTo(fit.offsetX);
  });

  it("cuts the sides in a narrow window and shows dark sides in a wide one", () => {
    expect(computeHeightFit(1024, 768, 1).offsetX).toBeLessThan(0);
    expect(computeHeightFit(2560, 1080, 1).offsetX).toBeGreaterThan(0);
  });
});

describe("the fly-away timing of the keyframes it replaces", () => {
  // The scales at 0 %, 12.5 % ... 100 % of the 0.6 s of the old keyframes title-near, title-mid and title-far; each holds for 75 ms (step-end).
  const near = [1, 1.12, 1.38, 1.8, 2.5, 3.7, 5.8, 9.5, 16];
  const mid = [1, 1.05, 1.14, 1.3, 1.5, 1.8, 2.3, 3, 4];
  const far = [1, 1.02, 1.05, 1.1, 1.17, 1.26, 1.38, 1.55, 1.8];

  it("pulls the near, middle and far layers in eight steps, each at its own speed", () => {
    for (let step = 0; step < 8; step++) {
      const look = flyLook(step * 75 + 10);
      expect([look.near, look.mid, look.far]).toEqual([near[step], mid[step], far[step]]);
    }
    const end = flyLook(600);
    expect([end.near, end.mid, end.far]).toEqual([16, 4, 1.8]);
    expect(flyLook(WHIP_MS).near).toBe(16);
  });

  it("fades the picture in the last 150 ms of the pull, and shows the tunnel from 22 % to 88 % of 1.4 s", () => {
    expect(flyLook(500).paneAlpha).toBe(1);
    expect(flyLook(540).paneAlpha).toBe(0.6);
    expect(flyLook(600).paneAlpha).toBe(0);
    expect(flyLook(300).tunnelAlpha).toBe(0);
    expect(flyLook(310).tunnelAlpha).toBe(1);
    expect(flyLook(1200).tunnelAlpha).toBe(1);
    expect(flyLook(1240).tunnelAlpha).toBe(0);
  });

  it("brings the streaks of light in over eight steps of the whip", () => {
    expect(flyLook(0)).toMatchObject({ whipAlpha: 0, whipScale: 0.5 });
    expect(flyLook(80)).toMatchObject({ whipAlpha: 0.4, whipScale: 0.6 });
    expect(flyLook(300)).toMatchObject({ whipAlpha: 1, whipScale: 1.3 });
    expect(flyLook(700)).toMatchObject({ whipAlpha: 0, whipScale: 4 });
    expect(streakLook(0, false)).toEqual({ scale: 0.5, opacity: 0 });
    expect(streakLook(0, true).scale).toBeCloseTo(0.5 + (2.9 * 3) / 6);
  });
});

describe("the loops of the picture", () => {
  it("blinks the stars in two steps each way over 2.4 s and pulses the haze between 0.55 and 1", () => {
    expect(twinkleOpacity(0)).toBe(1);
    expect(twinkleOpacity(1300)).toBeCloseTo(0.625);
    expect(twinkleOpacity(2500)).toBeCloseTo(0.625);
    expect(twinkleOpacity(3700)).toBe(1);
    expect(hazeOpacity(0)).toBeCloseTo(0.55);
    expect(hazeOpacity(2000)).toBeCloseTo(1, 1);
    expect(hazeOpacity(1000)).toBeCloseTo(0.775, 1);
  });

  it("bobs the logo up by 0.7 % of the frame's height in six steps", () => {
    expect(logoRise(0)).toBe(0);
    expect(logoRise(2999)).toBeCloseTo(DESIGN_HEIGHT * 0.007 * (5 / 6));
    expect(logoRise(3000)).toBeCloseTo(DESIGN_HEIGHT * 0.007); // the way back starts at the top
    expect(alternateProgress(4500, 3)).toBeCloseTo(0.5);
  });

  it("lets a crystal fall onto the planet in 12 % of its round, then burst, at the data's positions", () => {
    const [first] = FIREBALLS;
    if (!first) throw new Error("no fireball");
    expect(fireballAt(500, first).opacity).toBe(0); // before its delay of 1 s
    const falling = fireballAt(1000 + first.period * 0.04 * 1000, first);
    expect(falling.opacity).toBeCloseTo(1);
    expect(falling.x).toBeGreaterThan(first.left);
    const landed = fireballAt(1000 + first.period * 0.12 * 1000, first);
    expect(landed).toMatchObject({ x: first.left, y: first.top });
    expect(fireballAt(1000 + first.period * 0.2 * 1000, first).opacity).toBe(0);
    const burst = burstAt(1000 + first.period * 0.12 * 1000, first);
    expect(burst.scale).toBeCloseTo(0.5);
    expect(burst.opacity).toBeCloseTo(1);
    expect(burstAt(1000 + first.period * 0.5 * 1000, first).opacity).toBe(0);
  });
});
