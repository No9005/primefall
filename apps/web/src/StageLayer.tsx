import { useEffect, useRef } from "react";
import { hangarScene } from "./hangar-scene";
import { browserClock, browserEnvironment, createPixiHost, createStage, pixiAssets, type Scene, type Stage, type StageHost } from "./stage";

/** Scenes a screen may request by name. */
export const STAGE_SCENES: readonly Scene[] = [hangarScene];

// One stage for the whole app: remounting a screen reuses it instead of making a second Application.
let shared: Promise<{ stage: Stage; host: StageHost }> | undefined;

/** The one stage, with its root put into `parent` (the screen that shows a scene). */
export async function getStage(parent: HTMLElement): Promise<Stage> {
  shared ??= createPixiHost().then((host) => ({
    host,
    stage: createStage({ host, assets: pixiAssets, clock: browserClock(), environment: browserEnvironment(), scenes: STAGE_SCENES }),
  }));
  const { stage, host } = await shared;
  host.mount?.(parent);
  return stage;
}

/** Mounts the stage below the UI layer and shows a scene; leaving the screen leaves the scene. Render it before the screen's UI. */
export function StageLayer({ scene }: { scene?: string }) {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = parent.current;
    if (!element || !scene) return;
    let cancelled = false;
    let shown: Stage | undefined;
    void getStage(element).then((stage) => {
      if (cancelled) return;
      shown = stage;
      void stage.showScene(scene);
    });
    return () => {
      cancelled = true;
      void shown?.leaveScene();
    };
  }, [scene]);
  return <div ref={parent} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}
