import { Application, Assets, Container, Graphics } from "pixi.js";
import { computeFill, computeFit, type FillView, type StageFit } from "./stage-fit";

/** What a scene gets from the stage (ADR 0026). */
export interface SceneEnv {
  fit(): StageFit;
  /** The size handed to a scene that fills its element (`fit: "fill"`). */
  view(): FillView;
  reducedMotion(): boolean;
  /** Asks for one more drawn frame after the scene changed while it is not animating. */
  invalidate(): void;
}

/** A scene builds a container, declares its atlases and reports whether it is ready and animating. */
export interface Scene {
  name: string;
  /**
   * How the stage places the scene: "frame" (default) fits the 960 x 444 design frame into the window; "fill" gives the scene the size
   * of the element the stage is mounted in (`viewChanged`) and leaves the camera to the scene.
   */
  fit?: "frame" | "fill";
  /** Atlas or image URLs the scene needs; loaded on enter, destroyed on leave if no other scene uses them. Read again on leave. */
  readonly assets: readonly string[];
  /** Runs before the assets are acquired, for a scene whose asset list is only known after reading a file. */
  prepare?(): Promise<void>;
  create(env: SceneEnv): Container;
  enter?(): void;
  leave?(): void;
  /** Moves the scene by delta time (rule 4). */
  update(deltaMs: number): void;
  ready(): boolean;
  animating(): boolean;
  fitChanged?(fit: StageFit): void;
  /** A "fill" scene: the size or the resolution is this (called on enter and whenever it changes). */
  viewChanged?(view: FillView): void;
  reducedMotionChanged?(reduced: boolean): void;
}

/** Loads and destroys textures. The real one is PixiJS's loader; tests count calls with a fake. */
export interface AssetSource {
  load(urls: readonly string[]): Promise<void>;
  unload(urls: readonly string[]): Promise<void>;
}

/** The rendering side of the stage: the single Application. Faked in tests. */
export interface StageHost {
  root: { setAttribute(name: string, value: string): void };
  /** Puts the stage root into the element a screen provides (below its UI); the root stays the same one between screens. */
  mount?(parent: HTMLElement): void;
  show(container: Container): void;
  hide(container: Container): void;
  /** Places the stage container and sizes the canvas to the window. */
  applyFit(fit: StageFit, windowWidth: number, windowHeight: number): void;
  /** Sizes the canvas to the view and puts the stage container at scale 1 (a "fill" scene). */
  applyFill(view: FillView): void;
  /** The size of the element the root is mounted in, when it has one. */
  size?(): { width: number; height: number } | undefined;
  render(): void;
  onContextLost(callback: () => void): void;
  onContextRestored(callback: () => void): void;
  destroy(): void;
}

export interface FrameClock {
  request(callback: () => void): number;
  cancel(handle: number): void;
  /** Milliseconds since an arbitrary start. */
  now(): number;
}

export interface StageEnvironment {
  window: { width: number; height: number; devicePixelRatio: number };
  isHidden(): boolean;
  reducedMotion: { matches(): boolean; subscribe(callback: () => void): () => void };
  /** Calls back when the window size or the page visibility changed. */
  onChange(callback: () => void): () => void;
}

export interface Stage {
  showScene(name: string): Promise<void>;
  /** Leaves the current scene: destroys its container and textures, clears the seam attributes. */
  leaveScene(): Promise<void>;
  /** Advances the clock by a given delta without real time passing (tests, recordings). */
  step(deltaMs: number): void;
  fit(): StageFit;
  /** Measures the window and the mount element again. */
  refit(): void;
  reducedMotion(): boolean;
  destroy(): void;
}

export interface StageDeps {
  host: StageHost;
  assets: AssetSource;
  clock: FrameClock;
  environment: StageEnvironment;
  scenes: readonly Scene[];
}

const MAX_FRAME_MS = 100;

export function createStage(deps: StageDeps): Stage {
  const { host, assets, clock, environment } = deps;
  const assetUsers = new Map<string, number>();
  let current: { scene: Scene; container: Container } | undefined;
  let fit = computeFit(environment.window.width, environment.window.height, environment.window.devicePixelRatio);
  let view = measureView();
  let reduced = environment.reducedMotion.matches();
  let frameHandle: number | undefined;
  let lastTime = 0;
  let entering = 0;
  let destroyed = false;

  const setAttributes = (name: string, ready: boolean) => {
    host.root.setAttribute("data-scene", name);
    host.root.setAttribute("data-scene-ready", String(ready));
  };

  function measureView(): FillView {
    const area = host.size?.();
    const { window: size } = environment;
    const [width, height] = area && area.width > 0 && area.height > 0 ? [area.width, area.height] : [size.width, size.height];
    return computeFill(width, height, size.devicePixelRatio);
  }

  /** Puts the canvas and the stage container where the scene wants them and tells the scene. */
  function place(scene: Scene | undefined) {
    if (scene?.fit === "fill") {
      host.applyFill(view);
      scene.viewChanged?.(view);
    } else {
      host.applyFit(fit, environment.window.width, environment.window.height);
      scene?.fitChanged?.(fit);
    }
  }

  const env: SceneEnv = { fit: () => fit, view: () => view, reducedMotion: () => reduced, invalidate: () => schedule() };

  async function acquire(urls: readonly string[]) {
    const fresh = urls.filter((url) => !assetUsers.has(url));
    urls.forEach((url) => assetUsers.set(url, (assetUsers.get(url) ?? 0) + 1));
    if (fresh.length > 0) await assets.load(fresh);
  }

  async function release(urls: readonly string[]) {
    const unused = urls.filter((url) => {
      const left = (assetUsers.get(url) ?? 1) - 1;
      if (left > 0) assetUsers.set(url, left);
      else assetUsers.delete(url);
      return left <= 0;
    });
    if (unused.length > 0) await assets.unload(unused);
  }

  function drawFrame() {
    host.render();
    if (current && current.scene.ready()) setAttributes(current.scene.name, true);
  }

  function frame() {
    frameHandle = undefined;
    const now = clock.now();
    const delta = Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;
    advance(delta);
  }

  function advance(deltaMs: number) {
    if (!current || environment.isHidden()) return;
    current.scene.update(deltaMs);
    drawFrame();
    if (current.scene.animating()) schedule();
  }

  /** The ticker runs only while the scene animates or changed, and not while the page is hidden (rule 6). */
  function schedule() {
    if (destroyed || frameHandle !== undefined || environment.isHidden() || !current) return;
    lastTime = clock.now();
    frameHandle = clock.request(frame);
  }

  function stopTicker() {
    if (frameHandle === undefined) return;
    clock.cancel(frameHandle);
    frameHandle = undefined;
  }

  async function leaveCurrent() {
    const old = current;
    if (!old) return;
    current = undefined;
    stopTicker();
    old.scene.leave?.();
    host.hide(old.container);
    old.container.destroy({ children: true });
    setAttributes("", false);
    await release(old.scene.assets);
  }

  async function enter(scene: Scene) {
    const ticket = ++entering;
    setAttributes(scene.name, false);
    await scene.prepare?.();
    if (ticket !== entering || destroyed) return;
    await acquire(scene.assets);
    if (ticket !== entering || destroyed) {
      await release(scene.assets);
      return;
    }
    view = measureView();
    place(scene);
    const container = scene.create(env);
    scene.reducedMotionChanged?.(reduced);
    current = { scene, container };
    host.show(container);
    scene.enter?.();
    drawFrame();
    if (scene.animating()) schedule();
  }

  async function showScene(name: string) {
    const scene = deps.scenes.find((candidate) => candidate.name === name);
    if (!scene) throw new Error(`Unknown scene: ${name}`);
    reduced = environment.reducedMotion.matches();
    setAttributes(name, false);
    await leaveCurrent();
    await enter(scene);
  }

  function refit() {
    fit = computeFit(environment.window.width, environment.window.height, environment.window.devicePixelRatio);
    view = measureView();
    place(current?.scene);
    if (current) drawFrame();
  }

  const stopWatching = environment.onChange(() => {
    refit();
    if (environment.isHidden()) stopTicker();
    else if (current?.scene.animating()) schedule();
  });
  const stopMotion = environment.reducedMotion.subscribe(() => {
    reduced = environment.reducedMotion.matches();
    current?.scene.reducedMotionChanged?.(reduced);
    schedule();
  });

  /** Context loss (rule 8): rebuild the current scene, which reloads its textures. */
  host.onContextLost(() => {
    stopTicker();
    if (current) setAttributes(current.scene.name, false);
  });
  host.onContextRestored(() => {
    const scene = current?.scene;
    if (scene) void leaveCurrent().then(() => enter(scene));
  });
  host.applyFit(fit, environment.window.width, environment.window.height);

  return {
    showScene,
    async leaveScene() {
      entering++; // an enter that is still loading must not show its scene after this
      await leaveCurrent();
      setAttributes("", false);
    },
    step: advance,
    fit: () => fit,
    refit,
    reducedMotion: () => reduced,
    destroy() {
      destroyed = true;
      stopTicker();
      stopWatching();
      stopMotion();
      const scene = current?.scene;
      current?.container.destroy({ children: true });
      current = undefined;
      if (scene) void release(scene.assets);
      host.destroy();
    },
  };
}

/** The proof scene: a rectangle that moves with the ticker. Used by tests only; no screen requests it. */
export const PROOF_SCENE_NAME = "proof";
export const PROOF_SPEED = 0.1; // design pixels per millisecond

export function createProofScene(): Scene & { x(): number; stopped: boolean } {
  let rect: Graphics | undefined;
  let reducedMotion = false;
  let position = 0;
  const scene = {
    name: PROOF_SCENE_NAME,
    assets: ["proof.png"] as readonly string[],
    stopped: false,
    x: () => position,
    create() {
      rect = new Graphics().rect(0, 0, 40, 40).fill(0xff8800);
      const container = new Container();
      container.addChild(rect);
      return container;
    },
    update(deltaMs: number) {
      if (reducedMotion || scene.stopped) return;
      position += PROOF_SPEED * deltaMs;
      if (rect) rect.x = position;
    },
    ready: () => rect !== undefined,
    animating: () => !reducedMotion && !scene.stopped,
    reducedMotionChanged(reduced: boolean) {
      reducedMotion = reduced;
    },
  };
  return scene;
}

/** The real thing: one PixiJS Application, the only one the app creates (the glossary pictures still have their own, see eslint.config.js). */
export async function createPixiHost(): Promise<StageHost> {
  const app = new Application();
  await app.init({ background: "#12161c", preference: "webgl", antialias: true, autoDensity: true, autoStart: false, sharedTicker: false });
  const root = document.createElement("div");
  root.style.cssText = "position:absolute;inset:0;z-index:0;";
  root.setAttribute("data-scene", "");
  root.setAttribute("data-scene-ready", "false");
  root.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);
  const canvas = app.canvas;
  return {
    root,
    mount: (element) => void element.prepend(root),
    show: (container) => void world.addChild(container),
    hide: (container) => void world.removeChild(container),
    size: () => (root.parentElement ? { width: root.parentElement.clientWidth, height: root.parentElement.clientHeight } : undefined),
    applyFit(fit, width, height) {
      app.renderer.resize(width, height, fit.resolution);
      world.scale.set(fit.scale);
      world.position.set(fit.offsetX, fit.offsetY);
    },
    applyFill(fill) {
      app.renderer.resize(fill.width, fill.height, fill.resolution);
      world.scale.set(1);
      world.position.set(0, 0);
    },
    render: () => app.renderer.render(app.stage),
    onContextLost: (callback) =>
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        callback();
      }),
    onContextRestored: (callback) => canvas.addEventListener("webglcontextrestored", callback),
    destroy() {
      app.destroy(true, { children: true });
      root.remove();
    },
  };
}

export const pixiAssets: AssetSource = {
  async load(urls) {
    await Assets.load([...urls]);
  },
  async unload(urls) {
    await Assets.unload([...urls]);
  },
};

export function browserClock(): FrameClock {
  return { request: (cb) => requestAnimationFrame(cb), cancel: (handle) => cancelAnimationFrame(handle), now: () => performance.now() };
}

export function browserEnvironment(): StageEnvironment {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  return {
    get window() {
      return { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio };
    },
    isHidden: () => document.hidden,
    reducedMotion: {
      matches: () => query.matches,
      subscribe(callback) {
        query.addEventListener("change", callback);
        return () => query.removeEventListener("change", callback);
      },
    },
    onChange(callback) {
      window.addEventListener("resize", callback);
      document.addEventListener("visibilitychange", callback);
      return () => {
        window.removeEventListener("resize", callback);
        document.removeEventListener("visibilitychange", callback);
      };
    },
  };
}
