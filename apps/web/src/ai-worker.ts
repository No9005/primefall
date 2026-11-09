// Web Worker entry: plans the AI Squad off the main thread (see ai-planner.ts).

import { answerPlanRequest, type PlanRequest } from "./ai-planner";

self.onmessage = (event: MessageEvent<PlanRequest>) => {
  self.postMessage(answerPlanRequest(event.data));
};
