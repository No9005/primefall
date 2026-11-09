// The AI planner for the browser: the search runs in a Web Worker so the phone stays responsive. The Worker only
// calls `planSquad`, so a plan is the same as one computed on the main thread for the same Squad View and seed.

import { type AiStyle, planSquad } from "game-core/ai";
import type { SquadPlan, SquadView } from "game-core";
import type { SquadPlanner } from "game-core/local-host";

export interface PlanRequest {
  readonly id: number;
  readonly view: SquadView;
  readonly heroIds: readonly string[] | undefined;
  readonly style: AiStyle;
  readonly seed: number;
}

export interface PlanResponse {
  readonly id: number;
  readonly plan?: SquadPlan;
  readonly error?: string;
}

/** What the Worker does with one request; exported so tests can compare it with `planSquad` without a Worker. */
export function answerPlanRequest(request: PlanRequest): PlanResponse {
  try {
    return { id: request.id, plan: planSquad(request.view, request.heroIds, request.style, request.seed) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The planner the app uses; its Worker starts on first use. */
export const aiPlanner: SquadPlanner = createWorkerPlanner();

/** How long the Worker may take before the main thread plans instead (a plan takes tens of milliseconds). */
export const WORKER_TIMEOUT_MS = 15000;

/**
 * A planner that asks one Worker, started on first use. Plans on the main thread where Workers do not exist, and when the
 * Worker fails or does not answer in time: planning is deterministic, so the plan is the same and the Round goes on
 * instead of Commit waiting for ever.
 */
export function createWorkerPlanner(): SquadPlanner {
  const onMainThread: SquadPlanner = async (view, heroIds, style, seed) => planSquad(view, heroIds, style, seed);
  if (typeof Worker === "undefined") return onMainThread;
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<number, { resolve: (plan: SquadPlan) => void; reject: (error: Error) => void }>();
  const drop = (reason: string) => {
    for (const waiting of pending.values()) waiting.reject(new Error(reason));
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  const start = (): Worker => {
    const created = new Worker(new URL("./ai-worker.ts", import.meta.url), { type: "module" });
    created.onmessage = (event: MessageEvent<PlanResponse>) => {
      const { id, plan, error } = event.data;
      const waiting = pending.get(id);
      pending.delete(id);
      if (plan) waiting?.resolve(plan);
      else waiting?.reject(new Error(error ?? "The AI Worker failed."));
    };
    created.onerror = () => drop("The AI Worker failed.");
    created.onmessageerror = () => drop("The AI Worker sent a message that could not be read.");
    return created;
  };
  const viaWorker: SquadPlanner = (view, heroIds, style, seed) =>
    new Promise<SquadPlan>((resolve, reject) => {
      worker ??= start();
      const id = nextId++;
      const timer = setTimeout(() => drop("The AI Worker did not answer in time."), WORKER_TIMEOUT_MS);
      pending.set(id, { resolve: (plan) => (clearTimeout(timer), resolve(plan)), reject: (error) => (clearTimeout(timer), reject(error)) });
      worker.postMessage({ id, view, heroIds, style, seed } satisfies PlanRequest);
    });
  return (view, heroIds, style, seed) => viaWorker(view, heroIds, style, seed).catch(() => onMainThread(view, heroIds, style, seed));
}
