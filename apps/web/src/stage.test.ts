import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeFit, DESIGN_HEIGHT, DESIGN_WIDTH, MAX_CANVAS_SIDE } from "./stage-fit";
import { createProofScene, createStage, PROOF_SPEED, type AssetSource, type StageEnvironment, type StageHost } from "./stage";

function setup() {
  const attributes: Record<string, string> = {};
  const state = { hidden: false, reduced: false, requests: 0, renders: 0, loads: [] as string[], unloads: [] as string[] };
  let pending: (() => void) | undefined;
  let lost = () => {};
  let restored = () => {};
  const changeListeners: (() => void)[] = [];
  const motionListeners: (() => void)[] = [];
  const host: StageHost = {
    root: { setAttribute: (name, value) => void (attributes[name] = value) },
    show: () => {},
    hide: () => {},
    applyFit: () => {},
    applyFill: () => {},
    render: () => void state.renders++,
    onContextLost: (cb) => void (lost = cb),
    onContextRestored: (cb) => void (restored = cb),
    destroy: () => {},
  };
  const assets: AssetSource = {
    load: async (urls) => void state.loads.push(...urls),
    unload: async (urls) => void state.unloads.push(...urls),
  };
  const environment: StageEnvironment = {
    window: { width: 844, height: 390, devicePixelRatio: 3 },
    isHidden: () => state.hidden,
    reducedMotion: { matches: () => state.reduced, subscribe: (cb) => (motionListeners.push(cb), () => {}) },
    onChange: (cb) => (changeListeners.push(cb), () => {}),
  };
  const clock = {
    request: (cb: () => void) => {
      state.requests++;
      pending = cb;
      return 1;
    },
    cancel: () => void (pending = undefined),
    now: () => 0,
  };
  const proof = createProofScene();
  const stage = createStage({ host, assets, clock, environment, scenes: [proof] });
  return {
    stage, proof, attributes, state,
    hasPendingFrame: () => pending !== undefined,
    runFrame: () => { const cb = pending; pending = undefined; cb?.(); },
    loseContext: () => lost(),
    restoreContext: () => restored(),
    pageChanged: () => changeListeners.forEach((cb) => cb()),
    motionChanged: () => motionListeners.forEach((cb) => cb()),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("stage fit", () => {
  it.each([
    ["phone landscape", 844, 390],
    ["4:3", 1024, 768],
    ["21:9", 2560, 1080],
  ])("puts the frame fully inside a %s window", (_name, width, height) => {
    const fit = computeFit(width, height, 1);
    expect(fit.offsetX).toBeGreaterThanOrEqual(0);
    expect(fit.offsetY).toBeGreaterThanOrEqual(0);
    expect(fit.offsetX + DESIGN_WIDTH * fit.scale).toBeLessThanOrEqual(width + 1e-9);
    expect(fit.offsetY + DESIGN_HEIGHT * fit.scale).toBeLessThanOrEqual(height + 1e-9);
    expect(fit.visible.left * fit.scale).toBeCloseTo(fit.offsetX);
    expect(DESIGN_WIDTH + fit.visible.left + fit.visible.right).toBeCloseTo(width / fit.scale);
    expect(DESIGN_HEIGHT + fit.visible.top + fit.visible.bottom).toBeCloseTo(height / fit.scale);
  });

  it("exposes extra visible area on the sides in a wide window and above and below in a tall one", () => {
    expect(computeFit(2560, 1080, 1).visible.left).toBeGreaterThan(0);
    expect(computeFit(1024, 768, 1).visible.top).toBeGreaterThan(0);
  });

  it("caps the canvas resolution", () => {
    const fit = computeFit(2560, 1440, 3);
    expect(2560 * fit.resolution).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    expect(computeFit(844, 390, 2).resolution).toBe(2);
  });
});

describe("stage scenes", () => {
  it("sets the seam attributes only once the scene is loaded, and clears them on leave", async () => {
    const t = setup();
    const shown = t.stage.showScene("proof");
    expect(t.attributes["data-scene"]).toBe("proof");
    expect(t.attributes["data-scene-ready"]).toBe("false");
    await shown;
    expect(t.attributes["data-scene-ready"]).toBe("true");
    await t.stage.leaveScene();
    expect(t.attributes["data-scene"]).toBe("");
    expect(t.attributes["data-scene-ready"]).toBe("false");
  });

  it("destroys the textures of a scene when it is left", async () => {
    const t = setup();
    await t.stage.showScene("proof");
    expect(t.state.loads).toEqual(["proof.png"]);
    expect(t.state.unloads).toEqual([]);
    await t.stage.showScene("proof");
    expect(t.state.unloads).toEqual(["proof.png"]);
  });

  it("steps the proof scene deterministically", async () => {
    const t = setup();
    await t.stage.showScene("proof");
    t.stage.step(100);
    t.stage.step(50);
    expect(t.proof.x()).toBeCloseTo(150 * PROOF_SPEED);
  });

  it("runs the ticker only while the scene animates and the page is visible", async () => {
    const t = setup();
    await t.stage.showScene("proof");
    expect(t.hasPendingFrame()).toBe(true);
    t.state.hidden = true;
    t.pageChanged();
    expect(t.hasPendingFrame()).toBe(false);
    t.state.hidden = false;
    t.pageChanged();
    expect(t.hasPendingFrame()).toBe(true);
    t.proof.stopped = true;
    t.runFrame();
    expect(t.hasPendingFrame()).toBe(false);
  });

  it("rebuilds the current scene after a context loss", async () => {
    const t = setup();
    await t.stage.showScene("proof");
    t.loseContext();
    expect(t.attributes["data-scene-ready"]).toBe("false");
    t.restoreContext();
    await flush();
    expect(t.attributes["data-scene"]).toBe("proof");
    expect(t.attributes["data-scene-ready"]).toBe("true");
    expect(t.state.loads).toEqual(["proof.png", "proof.png"]);
  });

  it("tells scenes about reduced motion and its changes", async () => {
    const t = setup();
    t.state.reduced = true;
    await t.stage.showScene("proof");
    expect(t.stage.reducedMotion()).toBe(true);
    expect(t.proof.animating()).toBe(false);
    t.state.reduced = false;
    t.motionChanged();
    expect(t.stage.reducedMotion()).toBe(false);
    expect(t.proof.animating()).toBe(true);
  });
});

describe("one PixiJS Application", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  async function lint(file: string) {
    const eslint = new ESLint({ cwd: repoRoot, overrideConfig: { languageOptions: { parserOptions: { projectService: false } }, rules: { "@typescript-eslint/no-unsafe-enum-comparison": "off" } } });
    const [result] = await eslint.lintText('import { Application } from "pixi.js";\nexport const app = new Application();\n', { filePath: path.join(repoRoot, file) });
    return result?.messages.map((m) => m.message) ?? [];
  }

  it("forbids new Application() anywhere outside the stage", async () => {
    expect((await lint("apps/web/src/other.ts")).some((m) => m.includes("PixiJS Application"))).toBe(true);
    expect(await lint("apps/web/src/stage.ts")).toEqual([]);
    expect((await lint("apps/web/src/Board.tsx")).some((m) => m.includes("PixiJS Application"))).toBe(true);
  });
});
