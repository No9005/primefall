import { Container } from "pixi.js";
import { loadPixelHeroes, pixelHeroSheetUrls, resetPixelHeroes } from "./heroes";
import { loadPixelAtlas, type PixelAtlas, PIXEL_ATLAS_URL, resetPixelAtlas } from "./pixel-terrain";
import type { FillView } from "./stage-fit";
import type { Scene, SceneEnv } from "./stage";

// The Notstrom Map (the match board) as a scene on the stage (ADR 0026). The scene owns the containers and the clock; what is drawn into
// them, the camera and the input belong to the board component (Board.tsx), which shows what the match state and the UI ask for.

export const BOARD_SCENE_NAME = "board";

/** The containers the board is drawn into, in drawing order (the camera moves `world`). */
export interface BoardLayers {
  world: Container;
  floor: Container;
  planning: Container;
  /** Props, walls and the Heroes, sorted by tile depth. */
  objects: Container;
  /** The Fog of War clouds: above the floor and the props, below the planning marks and the effects. */
  fog: Container;
  /** Above the props and the Heroes, below the effects. */
  planningTop: Container;
  effects: Container;
  /** The tileset of the Pixel art style. */
  atlas: PixelAtlas;
}

/** The scene's time, in milliseconds, moved only by the stage ticker. Every animation of the board follows it. */
export interface BoardClock {
  now(): number;
  /** Calls `step` with the time on every frame until the returned function is called; the ticker runs while anyone is subscribed. */
  subscribe(step: (now: number) => void): () => void;
}

export function createBoardClock(onSubscribed: () => void = () => undefined): BoardClock & { advance(deltaMs: number): void; active(): boolean } {
  let now = 0;
  const steps = new Set<(now: number) => void>();
  return {
    now: () => now,
    subscribe(step) {
      steps.add(step);
      onSubscribed();
      return () => void steps.delete(step);
    },
    advance(deltaMs) {
      now += deltaMs;
      for (const step of [...steps]) if (steps.has(step)) step(now);
    },
    active: () => steps.size > 0,
  };
}

/** Where the board's textures come from. The real ones are PixiJS's loader; a test hands over fakes. */
export interface BoardAssets {
  load(): Promise<PixelAtlas>;
  /** The URLs to hand to the stage's loader once `load` is done (it unloads them when the board is left). */
  urls(): readonly string[];
  reset(): void;
}

const pixiBoardAssets: BoardAssets = {
  load: async () => {
    const [atlas] = await Promise.all([loadPixelAtlas(), loadPixelHeroes()]);
    return atlas;
  },
  urls: () => [PIXEL_ATLAS_URL, ...pixelHeroSheetUrls()],
  reset() {
    resetPixelHeroes();
    resetPixelAtlas();
  },
};

export interface BoardScene extends Scene {
  clock: BoardClock;
  /** The size the board fills, in CSS pixels. */
  view(): FillView;
  /** The containers while the scene is on the stage. */
  layers(): BoardLayers | undefined;
  /** Calls back with the layers when the scene is put on the stage and with `undefined` when it is left; also now, if it is there. */
  watchLayers(listener: (layers: BoardLayers | undefined) => void): () => void;
  /** Calls back when the size really changed (the view starts framed on the own Squad again). */
  watchView(listener: (view: FillView) => void): () => void;
  /** The component drew the tiles and the Heroes: the next frame is the first one that is ready. */
  markDrawn(): void;
  /** The component changed something: draw one more frame. */
  touch(): void;
}

export function createBoardScene(assets: BoardAssets = pixiBoardAssets): BoardScene {
  let env: SceneEnv | undefined;
  let layers: BoardLayers | undefined;
  let atlas: PixelAtlas | undefined;
  let drawn = false;
  let urls: readonly string[] = [];
  let view: FillView = { width: 0, height: 0, resolution: 1 };
  const layerListeners = new Set<(layers: BoardLayers | undefined) => void>();
  const viewListeners = new Set<(view: FillView) => void>();
  const clock = createBoardClock(() => env?.invalidate());
  const publish = () => layerListeners.forEach((listener) => listener(layers));

  const scene: BoardScene = {
    name: BOARD_SCENE_NAME,
    fit: "fill",
    get assets() {
      return urls;
    },
    clock,
    view: () => view,
    layers: () => layers,
    async prepare() {
      atlas = await assets.load();
      // Copied: the stage reads the list again when the scene is left, after the loaders forgot their sheets.
      urls = [...assets.urls()];
    },
    create(sceneEnv) {
      env = sceneEnv;
      const world = new Container();
      const [floor, planning, objects, fog, planningTop, effects] = [new Container(), new Container(), new Container(), new Container(), new Container(), new Container()];
      objects.sortableChildren = true;
      world.addChild(floor, planning, objects, fog, planningTop, effects);
      layers = { world, floor, planning, objects, fog, planningTop, effects, atlas: atlas! };
      drawn = false;
      publish();
      return world;
    },
    leave() {
      layers = undefined;
      drawn = false;
      publish();
      assets.reset();
    },
    update: (deltaMs) => clock.advance(deltaMs),
    ready: () => layers !== undefined && drawn,
    animating: () => clock.active(),
    viewChanged(next) {
      const changed = next.width !== view.width || next.height !== view.height;
      view = next;
      if (changed) viewListeners.forEach((listener) => listener(next));
    },
    watchLayers(listener) {
      layerListeners.add(listener);
      if (layers) listener(layers);
      return () => void layerListeners.delete(listener);
    },
    watchView(listener) {
      viewListeners.add(listener);
      return () => void viewListeners.delete(listener);
    },
    markDrawn() {
      drawn = true;
      env?.invalidate();
    },
    touch: () => env?.invalidate(),
  };
  return scene;
}

/** The one board of the app (a screen shows at most one). */
export const boardScene = createBoardScene();
