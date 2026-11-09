import { SquadId } from "game-core";
import { aiStyleFor, planSquad } from "game-core/ai";
import { createLocalHost } from "game-core/local-host";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiPlanner, answerPlanRequest, createWorkerPlanner, WORKER_TIMEOUT_MS } from "./ai-planner";

describe("AI planner", () => {
  it("the Worker's answer is the plan planSquad gives for the same Squad View and seed", async () => {
    for (const seed of [1, 7, 42, 1234]) {
      const host = createLocalHost(seed);
      const view = await host.getSquadView(SquadId.Right);
      const style = aiStyleFor(seed, SquadId.Right);
      const response = answerPlanRequest({ id: 3, view, heroIds: undefined, style, seed });
      expect(response.id).toBe(3);
      expect(response.plan).toEqual(planSquad(view, undefined, style, seed));
    }
  });

  it("without Workers the app planner plans on the main thread with the same result", async () => {
    const host = createLocalHost(5);
    const view = await host.getSquadView(SquadId.Left);
    const style = aiStyleFor(5, SquadId.Left);
    expect(await aiPlanner(view, undefined, style, 5)).toEqual(planSquad(view, undefined, style, 5));
  });

  it("a failing planner makes submitPlan reject and leaves the Round open, so Commit can be tried again", async () => {
    let fail = true;
    const host = createLocalHost(11, undefined, async (view, heroIds, style, seed) => {
      if (fail) throw new Error("The AI Worker failed.");
      return planSquad(view, heroIds, style, seed);
    });
    const plan = { squad: SquadId.Left, heroes: [] };
    const before = host.snapshot();
    await expect(host.submitPlan(plan)).rejects.toThrow("The AI Worker failed.");
    expect(host.snapshot()).toBe(before);
    fail = false;
    await expect(host.submitPlan(plan)).resolves.toBeDefined();
  });

  it("a Round that changed while the AI was planning is rejected, not resolved twice", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const host = createLocalHost(12, undefined, async (view, heroIds, style, seed) => {
      await gate;
      return planSquad(view, heroIds, style, seed);
    });
    const plan = { squad: SquadId.Left, heroes: [] };
    const first = host.submitPlan(plan);
    const second = host.submitPlan(plan);
    release();
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("measures the time from Commit to the Resolution on the default planner", async () => {
    const timings: number[] = [];
    for (const seed of [1, 7, 42, 1234]) {
      const host = createLocalHost(seed);
      const start = performance.now();
      await host.submitPlan({ squad: SquadId.Left, heroes: [] });
      timings.push(Math.round(performance.now() - start));
    }
    // Measured: 83, 68, 77, 71 ms per Round for seeds 1, 7, 42, 1234 (default planner, main thread).
    expect(timings.every((ms) => ms < 5000)).toBe(true);
  });

  it("a local host that plans through the app planner gives the same Resolution as the default", async () => {
    const direct = createLocalHost(9);
    const viaPlanner = createLocalHost(9, undefined, aiPlanner);
    const plan = { squad: SquadId.Left, heroes: [] };
    const a = await direct.submitPlan(plan);
    const b = await viaPlanner.submitPlan(plan);
    expect(b).toEqual(a);
  });
});

describe("the Worker planner when the Worker fails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A Worker whose behaviour a test chooses: it breaks on start, or never answers. */
  const stubWorker = (behaviour: "error" | "silent") => {
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;
      constructor() {
        if (behaviour === "error") queueMicrotask(() => this.onerror?.());
      }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
  };

  it("plans on the main thread when the Worker errors, with the plan planSquad gives", async () => {
    stubWorker("error");
    const view = await createLocalHost(5).getSquadView(SquadId.Left);
    const style = aiStyleFor(5, SquadId.Left);
    expect(await createWorkerPlanner()(view, undefined, style, 5)).toEqual(planSquad(view, undefined, style, 5));
  });

  it("plans on the main thread when the Worker does not answer, so Commit never waits for ever", async () => {
    stubWorker("silent");
    vi.useFakeTimers();
    const view = await createLocalHost(6).getSquadView(SquadId.Left);
    const style = aiStyleFor(6, SquadId.Left);
    const planned = createWorkerPlanner()(view, undefined, style, 6);
    await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS + 1);
    expect(await planned).toEqual(planSquad(view, undefined, style, 6));
  });
});
