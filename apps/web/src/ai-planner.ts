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

/** A planner that asks one Worker,started on first use. Plans on the main thread where Workers do not exist. */
export function createWorkerPlanner(): SquadPlanner {
  if (typeof Worker === "undefined") return async (view, heroIds, style, seed) => planSquad(view, heroIds, style, seed);
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<number, { resolve: (plan: SquadPlan) => void; reject: (error: Error) => void }>();
  const start = (): Worker => {
    const created = new Worker(new URL("./ai-worker.ts", import.meta.url), { type: "module" });
    created.onmessage = (event: MessageEvent<PlanResponse>) => {
      const { id, plan, error } = event.data;
      const waiting = pending.get(id);
      pending.delete(id);
      if (plan) waiting?.resolve(plan);
      else waiting?.reject(new Error(error ?? "The AI Worker failed."));
    };
    created.onerror = () => {
      for (const waiting of pending.values()) waiting.reject(new Error("The AI Worker failed."));
      pending.clear();
      created.terminate();
      worker = undefined;
    };
    return created;
  };
  return (view, heroIds, style, seed) =>
    new Promise<SquadPlan>((resolve, reject) => {
      worker ??= start();
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, view, heroIds, style, seed } satisfies PlanRequest);
    });
}
