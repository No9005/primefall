import { readFileSync } from "node:fs";
import { Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { HeroClass } from "game-core";
import { parseAtlas } from "./atlas";
import { cyclePercent, crystalAt, createHangarScene, flickerOpacity, guideFrame, HANGAR_SCENE_NAME, type HangarArt, lampOpacity, moteAt, shadeOpacity, sparkFrame } from "./hangar-scene";
import { HANGAR_HEROES, HangarHeroes } from "./hangar-select";
import { createStage, type AssetSource, type StageEnvironment, type StageHost } from "./stage";

const atlasJson = (hero: string) => JSON.parse(readFileSync(new URL(`../public/assets/hangar/atlas/${hero}.json`, import.meta.url), "utf8")) as unknown;

/** Textures that are only distinct objects, one per frame name: the scene does not read pixels. */
const fakeArt: HangarArt = {
  texture: () => new Texture(),
  sheet(hero) {
    const json = atlasJson(hero);
    const data = parseAtlas(json);
    const textures = Object.fromEntries(Object.keys(data.frames).map((name) => [name, new Texture()]));
    const animations = Object.fromEntries(Object.entries(data.animations).map(([name, frames]) => [name, frames.map((frame) => textures[frame] as Texture)]));
    return { animations, data: json };
  },
};

function setup(options: { reduced?: boolean; random?: (low: number, high: number) => number } = {}) {
  const attributes: Record<string, string> = {};
  const state = { hidden: false, requests: 0, loads: [] as string[], unloads: [] as string[] };
  let pending: (() => void) | undefined;
  const host: StageHost = {
    root: { setAttribute: (name, value) => void (attributes[name] = value) },
    show: () => {},
    hide: () => {},
    applyFit: () => {},
    render: () => {},
    onContextLost: () => {},
    onContextRestored: () => {},
    destroy: () => {},
  };
  const assets: AssetSource = {
    load: async (urls) => void state.loads.push(...urls),
    unload: async (urls) => void state.unloads.push(...urls),
  };
  const environment: StageEnvironment = {
    window: { width: 844, height: 390, devicePixelRatio: 1 },
    isHidden: () => state.hidden,
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
  const scene = createHangarScene(fakeArt);
  const stage = createStage({ host, assets, clock, environment, scenes: [scene] });
  const heroes = new HangarHeroes(() => scene.invalidate(), options.reduced === true, options.random ?? ((low) => low));
  return { scene, stage, heroes, attributes, state, hasPendingFrame: () => pending !== undefined };
}

describe("the hangar scene on the stage", () => {
  it("is ready only when the first frame with the Heroes is drawn, and clears the seam on leaving", async () => {
    const { stage, scene, heroes, attributes } = setup();
    heroes.start();
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(attributes["data-scene"]).toBe(HANGAR_SCENE_NAME);
    expect(attributes["data-scene-ready"]).toBe("true");
    await stage.leaveScene();
    expect(attributes["data-scene"]).toBe("");
    expect(attributes["data-scene-ready"]).toBe("false");
  });

  it("is not ready before the screen hands over the Heroes", async () => {
    const { stage, scene, heroes, attributes } = setup();
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(attributes["data-scene-ready"]).toBe("false");
    heroes.start();
    scene.attach(heroes);
    stage.step(0);
    expect(attributes["data-scene-ready"]).toBe("true");
  });

  it("destroys what it loaded when it is left", async () => {
    const { stage, state } = setup();
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(state.loads.length).toBeGreaterThan(10);
    expect(state.unloads).toEqual([]);
    await stage.leaveScene();
    expect([...state.unloads].sort()).toEqual([...state.loads].sort());
  });

  it("plays the machine on the stage clock: Max lifts after two idles", async () => {
    const { stage, scene, heroes } = setup();
    heroes.start();
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(heroes.players.max.state.mode).toBe("idle");
    stage.step(2000 * 2 - 100);
    expect(heroes.players.max.state.mode).toBe("idle");
    stage.step(200);
    expect(heroes.players.max.state.mode).toBe("tolift");
    stage.step(700);
    expect(heroes.players.max.state.mode).toBe("act");
  });

  it("chooses one Hero at a time and takes the choice back", async () => {
    const { stage, scene, heroes } = setup();
    heroes.start();
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(heroes.tap("max")).toBe("max");
    expect(heroes.tap("kit")).toBe("kit");
    expect(HANGAR_HEROES.filter((hero) => heroes.players[hero].selected)).toEqual(["kit"]);
    stage.step(5000);
    expect(heroes.selected).toBe("kit");
    expect(heroes.players.kit.state.mode).toBe("hold");
    expect(heroes.tap("kit")).toBeUndefined();
    expect(heroes.selected).toBeUndefined();
  });

  it("opens with the initial Hero standing in the ready pose", async () => {
    const { stage, scene, heroes } = setup();
    heroes.start(HeroClass.Controller);
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(heroes.selected).toBe("tilly");
    expect(heroes.players.tilly.state.mode).toBe("hold");
  });

  it("does not animate with reduced motion: the ticker is not running and a chosen Hero shows the ready pose at once", async () => {
    const { stage, scene, heroes, state, attributes, hasPendingFrame } = setup({ reduced: true });
    heroes.start();
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    expect(scene.animating()).toBe(false);
    expect(attributes["data-scene-ready"]).toBe("true");
    state.requests = 0;
    stage.step(10_000);
    expect(heroes.players.max.state.mode).toBe("idle");
    heroes.tap("max");
    expect(heroes.players.max.state.mode).toBe("hold");
    expect(hasPendingFrame()).toBe(true); // one more frame to draw the change, then the ticker stops again
  });

  it("stops the ticker while the page is hidden", async () => {
    const { stage, scene, heroes, state } = setup();
    heroes.start();
    scene.attach(heroes);
    await stage.showScene(HANGAR_SCENE_NAME);
    state.hidden = true;
    state.requests = 0;
    stage.step(1000);
    expect(heroes.players.max.state.mode).toBe("idle");
    expect(state.requests).toBe(0);
  });
});

describe("hangar motion on the scene's time", () => {
  it("blinks the lamps once per cycle and offsets them by their delay", () => {
    expect(lampOpacity(0, 1.6, 0)).toBe(1);
    expect(lampOpacity(900, 1.6, 0)).toBe(0.08);
    expect(lampOpacity(0, 2.1, -0.7)).toBe(1);
    expect(lampOpacity(0, 1.6, -0.9)).toBe(0.08);
  });

  it("flickers and dims the shade at the moments the CSS keyframes had", () => {
    expect(flickerOpacity(0.08 * 5300)).toBe(0.5);
    expect(flickerOpacity(0.5 * 5300)).toBe(1);
    expect(shadeOpacity(0.615 * 9400)).toBe(0.55);
    expect(shadeOpacity(0.7 * 9400)).toBe(1);
  });

  it("steps the guide lights through six frames", () => {
    expect([0, 200, 1000, 1200].map(guideFrame)).toEqual([0, 1, 5, 0]);
  });

  it("shows a spark only after its delay and for 14% of its cycle", () => {
    expect(sparkFrame(300, 3.7, 0.6)).toBeUndefined();
    expect(sparkFrame(600, 3.7, 0.6)).toBe(0);
    expect(sparkFrame(600 + 0.13 * 3700, 3.7, 0.6)).toBe(5);
    expect(sparkFrame(600 + 0.2 * 3700, 3.7, 0.6)).toBeUndefined();
    expect(cyclePercent(0, 1, 1)).toBeUndefined();
  });

  it("lets the crystal fall for a moment every eleven seconds, starting after three", () => {
    expect(crystalAt(1000)).toBeUndefined();
    const first = crystalAt(3000)!;
    const later = crystalAt(3000 + 0.04 * 11_000)!;
    expect(later.y).toBeGreaterThan(first.y);
    expect(crystalAt(3000 + 0.5 * 11_000)).toBeUndefined();
    expect(crystalAt(3000 + 11_000)).toEqual(first);
  });

  it("raises a mote by up to 46 px while it fades", () => {
    expect(moteAt(0, 8, 0).rise).toBeCloseTo(0);
    expect(moteAt(0, 8, 0).opacity).toBe(0);
    const middle = moteAt(4000, 8, 0);
    expect(middle.rise).toBeLessThan(-20);
    expect(middle.opacity).toBeGreaterThan(0.5);
  });
});
