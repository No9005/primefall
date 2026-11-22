import { useEffect, useRef } from "react";
import { browserClock, browserEnvironment, createPixiHost, createStage, pixiAssets, type Scene, type Stage } from "./stage";

/** Scenes a screen may request by name. Empty until the screens migrate (issue #462). */
export const STAGE_SCENES: readonly Scene[] = [];

// One stage for the whole app: remounting the React tree reuses it instead of making a second Application.
let shared: Promise<Stage> | undefined;

export function getStage(parent: HTMLElement): Promise<Stage> {
  shared ??= createPixiHost(parent).then((host) =>
    createStage({ host, assets: pixiAssets, clock: browserClock(), environment: browserEnvironment(), scenes: STAGE_SCENES }),
  );
  return shared;
}

/** Mounts the stage below the UI layer once; render it as the first child of the app shell. */
export function StageLayer({ scene }: { scene?: string }) {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = parent.current;
    if (!element || !scene) return;
    let cancelled = false;
    void getStage(element).then((stage) => {
      if (!cancelled) void stage.showScene(scene);
    });
    return () => {
      cancelled = true;
    };
  }, [scene]);
  return <div ref={parent} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}
