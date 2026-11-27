import { Application, Assets, Container, Graphics, Texture, VideoSource } from "pixi.js";
import { debugLog, debugMedia } from "./debug-log";
import { computeFill, computeFit, computeHeightFit, type FillView, type StageFit } from "./stage-fit";

/** What a scene gets from the stage (ADR 0026). */
export interface SceneEnv {
  fit(): StageFit;
  /** The size handed to a scene that fills its element (`fit: "fill"`). */
  view(): FillView;
  reducedMotion(): boolean;
  /** Asks for one more drawn frame after the scene changed while it is not animating. */
  invalidate(): void;
  /** The loaded film of the scene's `videos` list at `index`; undefined when it could not be loaded. */
  video(index: number): VideoClip | undefined;
}

/** A film on a video texture (ADR 0026, rule 3: films are the one thing that is not an atlas). The real one wraps a hidden `<video>`; tests fake it. */
export interface VideoClip {
  texture: Texture;
  /** Whether the first picture can be drawn. */
  hasFrame(): boolean;
  play(): Promise<void>;
  pause(): void;
  /** Seconds into the film. */
  currentTime: number;
  /** Whether the film has played to its end (also when the browser sent no `ended`: Safari does not send it again for a film that was rewound). */
  reachedEnd(): boolean;
  /** Calls back when the film ended and when it failed to decode or play; returns what removes the listeners. */
  listen(handlers: { ended(): void; failed(): void }): () => void;
}

/** A scene builds a container, declares its atlases and reports whether it is ready and animating. */
export interface Scene {
  name: string;
  /**
   * How the stage places the scene: "frame" (default) fits the 960 x 444 design frame into the window; "height" makes the frame as high as
   * the window (a narrower window cuts its sides, a wider one shows dark sides); "fill" gives the scene the size of the element the stage
   * is mounted in (`viewChanged`) and leaves the camera to the scene.
   */
  fit?: "frame" | "height" | "fill";
  /** Atlas or image URLs the scene needs; loaded on enter, destroyed on leave if no other scene uses them. Read again on leave. */
  readonly assets: readonly string[];
  /** Films the scene needs, each as the URLs of the same film in several formats (the first one the browser can play is used). Released on leave. */
  readonly videos?: readonly (readonly string[])[];
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
  /** The page was hidden or shown again (a film pauses while it is hidden). */
  hiddenChanged?(hidden: boolean): void;
}

/** Loads and destroys textures. The real one is PixiJS's loader; tests count calls with a fake. */
export interface AssetSource {
  load(urls: readonly string[]): Promise<void>;
  unload(urls: readonly string[]): Promise<void>;
  /** Loads a film from the first of its formats that the browser plays; rejects when none loads. */
  loadVideo?(formats: readonly string[]): Promise<VideoClip>;
  /** Stops the film and destroys its video element and texture. */
  unloadVideo?(clip: VideoClip): Promise<void>;
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
  /**
   * Loads the assets and films of a scene that comes next while the current one is on show, so that `showScene` finds them ready and the
   * switch does not wait (the picture of the old scene would stay frozen meanwhile). Only the scene that is shown next keeps what it loaded.
   */
  preload(name: string): Promise<void>;
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

/** The stage: shows one scene at a time, keeps its assets loaded while it is on show, and runs the ticker only while something moves. */
class StageController implements Stage {
  private readonly host: StageHost;
  private readonly assets: AssetSource;
  private readonly clock: FrameClock;
  private readonly environment: StageEnvironment;
  private readonly scenes: readonly Scene[];
  private readonly assetUsers = new Map<string, number>();
  private current: { scene: Scene; container: Container } | undefined;
  private fitState: StageFit;
  private heightFit: StageFit;
  private view: FillView;
  private reduced: boolean;
  private frameHandle: number | undefined;
  private lastTime = 0;
  private entering = 0;
  /** The scene that is being entered, until it is on show: it asks for its fit while it is created. */
  private entered: Scene | undefined;
  /** The films of the scene that is being entered or is on show. */
  private clips: (VideoClip | undefined)[] = [];
  /** Scenes whose assets and films are being or have been loaded ahead of `showScene`; each holds its own claim on its assets. */
  private readonly preloaded = new Map<Scene, Promise<(VideoClip | undefined)[]>>();
  private destroyed = false;
  private readonly sceneEnv: SceneEnv;
  private readonly stopWatching: () => void;
  private readonly stopMotion: () => void;

  constructor({ host, assets, clock, environment, scenes }: StageDeps) {
    this.host = host;
    this.assets = assets;
    this.clock = clock;
    this.environment = environment;
    this.scenes = scenes;
    const { width, height, devicePixelRatio } = environment.window;
    this.fitState = computeFit(width, height, devicePixelRatio);
    this.heightFit = computeHeightFit(width, height, devicePixelRatio);
    this.view = this.measureView();
    this.reduced = environment.reducedMotion.matches();
    this.sceneEnv = {
      fit: () => this.fitOf(this.current?.scene ?? this.entered),
      view: () => this.view,
      reducedMotion: () => this.reduced,
      invalidate: () => this.schedule(),
      video: (index) => this.clips[index],
    };
    this.stopWatching = environment.onChange(() => this.onEnvironmentChange());
    this.stopMotion = environment.reducedMotion.subscribe(() => {
      this.reduced = environment.reducedMotion.matches();
      this.current?.scene.reducedMotionChanged?.(this.reduced);
      this.schedule();
    });
    // Context loss (rule 8): rebuild the current scene, which reloads its textures.
    host.onContextLost(() => {
      this.stopTicker();
      if (this.current) this.setAttributes(this.current.scene.name, false);
    });
    host.onContextRestored(() => {
      const scene = this.current?.scene;
      if (scene) void this.leaveCurrent().then(() => this.enter(scene));
    });
    host.applyFit(this.fitState, environment.window.width, environment.window.height);
  }

  private setAttributes(name: string, ready: boolean): void {
    this.host.root.setAttribute("data-scene", name);
    this.host.root.setAttribute("data-scene-ready", String(ready));
  }

  private measureView(): FillView {
    const area = this.host.size?.();
    const { window: size } = this.environment;
    const [width, height] = area && area.width > 0 && area.height > 0 ? [area.width, area.height] : [size.width, size.height];
    return computeFill(width, height, size.devicePixelRatio);
  }

  private fitOf(scene: Scene | undefined): StageFit {
    return scene?.fit === "height" ? this.heightFit : this.fitState;
  }

  /** Puts the canvas and the stage container where the scene wants them and tells the scene. */
  private place(scene: Scene | undefined): void {
    if (scene?.fit === "fill") {
      this.host.applyFill(this.view);
      scene.viewChanged?.(this.view);
    } else {
      const chosen = this.fitOf(scene);
      this.host.applyFit(chosen, this.environment.window.width, this.environment.window.height);
      scene?.fitChanged?.(chosen);
    }
  }

  private async acquire(urls: readonly string[]): Promise<void> {
    const fresh = urls.filter((url) => !this.assetUsers.has(url));
    urls.forEach((url) => this.assetUsers.set(url, (this.assetUsers.get(url) ?? 0) + 1));
    if (fresh.length > 0) await this.assets.load(fresh);
  }

  private async release(urls: readonly string[]): Promise<void> {
    const unused = urls.filter((url) => {
      const left = (this.assetUsers.get(url) ?? 1) - 1;
      if (left > 0) this.assetUsers.set(url, left);
      else this.assetUsers.delete(url);
      return left <= 0;
    });
    if (unused.length > 0) await this.assets.unload(unused);
  }

  private async acquireVideos(scene: Scene): Promise<(VideoClip | undefined)[]> {
    const load = this.assets.loadVideo?.bind(this.assets);
    return Promise.all((scene.videos ?? []).map((formats) => (load ? load(formats).catch(() => undefined) : undefined)));
  }

  private async releaseVideos(loaded: readonly (VideoClip | undefined)[]): Promise<void> {
    for (const clip of loaded) if (clip) await this.assets.unloadVideo?.(clip);
  }

  private drawFrame(): void {
    this.host.render();
    if (this.current && this.current.scene.ready()) this.setAttributes(this.current.scene.name, true);
  }

  private frame(): void {
    this.frameHandle = undefined;
    const now = this.clock.now();
    const delta = Math.min(now - this.lastTime, MAX_FRAME_MS);
    this.lastTime = now;
    this.advance(delta);
  }

  private advance(deltaMs: number): void {
    if (!this.current || this.environment.isHidden()) return;
    this.current.scene.update(deltaMs);
    this.drawFrame();
    if (this.current.scene.animating()) this.schedule();
  }

  /** The ticker runs only while the scene animates or changed, and not while the page is hidden (rule 6). */
  private schedule(): void {
    if (this.destroyed || this.frameHandle !== undefined || this.environment.isHidden() || !this.current) return;
    this.lastTime = this.clock.now();
    this.frameHandle = this.clock.request(() => this.frame());
  }

  private stopTicker(): void {
    if (this.frameHandle === undefined) return;
    this.clock.cancel(this.frameHandle);
    this.frameHandle = undefined;
  }

  private async leaveCurrent(): Promise<void> {
    const old = this.current;
    if (!old) return;
    this.current = undefined;
    this.stopTicker();
    old.scene.leave?.();
    this.host.hide(old.container);
    old.container.destroy({ children: true });
    this.setAttributes("", false);
    const loaded = this.clips;
    this.clips = [];
    await this.releaseVideos(loaded);
    await this.release(old.scene.assets);
  }

  /** Whether this enter was overtaken by a later one (or the stage was destroyed) while it was loading. */
  private overtaken(ticket: number): boolean {
    return ticket !== this.entering || this.destroyed;
  }

  /** Loads the assets and films of a scene (what `enter` and `preload` both need). */
  private async loadScene(scene: Scene): Promise<(VideoClip | undefined)[]> {
    await scene.prepare?.();
    await this.acquire(scene.assets);
    return this.acquireVideos(scene);
  }

  private async enter(scene: Scene): Promise<void> {
    const ticket = ++this.entering;
    this.setAttributes(scene.name, false);
    const early = this.preloaded.get(scene);
    this.preloaded.delete(scene);
    const loaded = await (early ?? this.loadScene(scene));
    if (this.overtaken(ticket)) {
      await this.releaseVideos(loaded);
      await this.release(scene.assets);
      return;
    }
    this.clips = loaded;
    this.view = this.measureView();
    this.place(scene);
    this.entered = scene;
    const container = scene.create(this.sceneEnv);
    this.entered = undefined;
    scene.reducedMotionChanged?.(this.reduced);
    this.current = { scene, container };
    this.host.show(container);
    scene.enter?.();
    this.drawFrame();
    if (scene.animating()) this.schedule();
  }

  async preload(name: string): Promise<void> {
    const scene = this.scenes.find((candidate) => candidate.name === name);
    if (!scene) throw new Error(`Unknown scene: ${name}`);
    if (this.destroyed || this.current?.scene === scene || this.preloaded.has(scene)) return;
    const loading = this.loadScene(scene);
    this.preloaded.set(scene, loading);
    // A load that fails is forgotten: the scene then loads itself when it is shown, as without a preload.
    await loading.then(
      () => undefined,
      () => void (this.preloaded.get(scene) === loading && this.preloaded.delete(scene)),
    );
  }

  /** Lets go of what was loaded ahead for scenes other than `keep`: they are not coming next after all. */
  private async dropPreloaded(keep: Scene): Promise<void> {
    for (const [scene, loading] of [...this.preloaded]) {
      if (scene === keep) continue;
      this.preloaded.delete(scene);
      const loaded = await loading.catch(() => undefined);
      if (loaded) await this.releaseVideos(loaded);
      await this.release(scene.assets);
    }
  }

  async showScene(name: string): Promise<void> {
    const scene = this.scenes.find((candidate) => candidate.name === name);
    if (!scene) throw new Error(`Unknown scene: ${name}`);
    this.reduced = this.environment.reducedMotion.matches();
    this.setAttributes(name, false);
    void this.dropPreloaded(scene);
    await this.leaveCurrent();
    await this.enter(scene);
  }

  async leaveScene(): Promise<void> {
    this.entering++; // an enter that is still loading must not show its scene after this
    await this.leaveCurrent();
    this.setAttributes("", false);
  }

  step(deltaMs: number): void {
    this.advance(deltaMs);
  }

  fit(): StageFit {
    return this.fitState;
  }

  refit(): void {
    const { width, height, devicePixelRatio } = this.environment.window;
    this.fitState = computeFit(width, height, devicePixelRatio);
    this.heightFit = computeHeightFit(width, height, devicePixelRatio);
    this.view = this.measureView();
    this.place(this.current?.scene);
    if (this.current) this.drawFrame();
  }

  private onEnvironmentChange(): void {
    this.refit();
    this.current?.scene.hiddenChanged?.(this.environment.isHidden());
    if (this.environment.isHidden()) this.stopTicker();
    else if (this.current?.scene.animating()) this.schedule();
  }

  reducedMotion(): boolean {
    return this.reduced;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopTicker();
    this.stopWatching();
    this.stopMotion();
    const scene = this.current?.scene;
    this.current?.container.destroy({ children: true });
    this.current = undefined;
    void this.releaseVideos(this.clips);
    this.clips = [];
    if (scene) void this.release(scene.assets);
    for (const [early, loading] of [...this.preloaded]) {
      this.preloaded.delete(early);
      void loading.then((loaded) => this.releaseVideos(loaded).then(() => this.release(early.assets)), () => undefined);
    }
    this.host.destroy();
  }
}

export function createStage(deps: StageDeps): Stage {
  return new StageController(deps);
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

/** The real thing: one PixiJS Application, the only one the app creates. */
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
  loadVideo: (formats) => pixiVideoAssets.loadVideo(formats),
  unloadVideo: (clip) => pixiVideoAssets.unloadVideo(clip),
};

/** The first of the film's formats that this browser says it can play (by the file ending); the last one when it says nothing for all. */
export function playableFormat(formats: readonly string[]): string {
  const probe = document.createElement("video");
  const mimes: Record<string, string> = { webm: 'video/webm; codecs="vp9"', mp4: 'video/mp4; codecs="avc1.640028"' };
  const playable = formats.find((url) => {
    const mime = mimes[url.split("?")[0]?.split(".").pop() ?? ""];
    return mime !== undefined && probe.canPlayType(mime) !== "";
  });
  return playable ?? formats[formats.length - 1] ?? "";
}

/** The real films: PixiJS loads a video texture; the video element is muted and plays inline (mobile browsers need both). */
function pixiVideoClip(texture: Texture): VideoClip {
  const element = (texture.source as VideoSource).resource;
  return {
    texture,
    hasFrame: () => element.readyState >= 2,
    play: () => element.play(),
    reachedEnd: () => element.ended || (element.duration > 0 && element.currentTime >= element.duration - 0.05),
    pause: () => element.pause(),
    get currentTime() {
      return element.currentTime;
    },
    set currentTime(seconds: number) {
      element.currentTime = seconds;
    },
    listen({ ended, failed }) {
      element.addEventListener("ended", ended);
      element.addEventListener("error", failed);
      return () => {
        element.removeEventListener("ended", ended);
        element.removeEventListener("error", failed);
      };
    },
  };
}

/** How long a film may take to show its first picture before it counts as not loaded (the intro then ends as if it was skipped, instead of waiting for ever). */
const FILM_LOAD_TIMEOUT_MS = 8000;

/**
 * A hidden `<video>` that has its first picture and is playing, muted. iOS loads no film before it plays (it ignores `preload`), and PixiJS's loader waits
 * for a `canplay` that never comes: the stage kept the old scene frozen on screen. So the film is played from the start of the loading, and nothing
 * ever holds it: a film that was paused after loading ran on by itself on iOS. The scene that shows it sets it to its start.
 */
async function loadFilmElement(url: string): Promise<HTMLVideoElement> {
  const element = document.createElement("video");
  element.muted = true;
  element.loop = false;
  element.preload = "auto";
  for (const attribute of ["playsinline", "webkit-playsinline", "muted"]) element.setAttribute(attribute, "");
  element.src = url;
  debugLog(`film loads: ${url}`);
  debugMedia("film", element);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => done(new Error(`The film ${url} did not load in ${FILM_LOAD_TIMEOUT_MS} ms`)), FILM_LOAD_TIMEOUT_MS);
    function done(error?: Error) {
      clearTimeout(timeout);
      element.removeEventListener("loadeddata", onData);
      element.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    const onData = () => done();
    const onError = () => done(new Error(`The film ${url} could not be loaded`));
    element.addEventListener("loadeddata", onData);
    element.addEventListener("error", onError);
    if (element.readyState >= 2) return done();
    element.load();
    // A refused play (a browser that blocks it) is not the end: the picture may still load, and the timeout ends the wait.
    void element.play().catch((error: unknown) => debugLog(`film play() refused while loading: ${error instanceof Error ? error.name : String(error)}`));
  }).catch((error: unknown) => {
    debugLog(`film failed: ${error instanceof Error ? error.message : String(error)}`);
    element.removeAttribute("src");
    element.load();
    throw error;
  });
  return element;
}

const loadedFilms = new Map<VideoClip, Texture>();

export const pixiVideoAssets: Required<Pick<AssetSource, "loadVideo" | "unloadVideo">> = {
  async loadVideo(formats) {
    const element = await loadFilmElement(playableFormat(formats));
    const source = new VideoSource({ resource: element, autoPlay: false, loop: false, muted: true, playsinline: true });
    if (source.width <= 1) source.resize(element.videoWidth, element.videoHeight);
    const texture = new Texture({ source });
    const clip = pixiVideoClip(texture);
    loadedFilms.set(clip, texture);
    return clip;
  },
  async unloadVideo(clip) {
    clip.pause();
    const texture = loadedFilms.get(clip);
    loadedFilms.delete(clip);
    if (!texture) return;
    const element = (texture.source as VideoSource).resource;
    texture.destroy(true);
    element.removeAttribute("src");
    element.load();
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
