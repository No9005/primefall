import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useMemo, useState } from "react";
import { EndScreen } from "./EndScreen";
import { PlanningScreen } from "./PlanningScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

const newSeed = () => Date.now() >>> 0;

export function App() {
  // A fresh seed per match; the end screen shows it for bug reports.
  const [seed, setSeed] = useState(newSeed);
  const host = useMemo(() => createLocalHost(seed), [seed]);
  const [view, setView] = useState<SquadView>();

  useEffect(() => {
    let cancelled = false;
    setView(undefined);
    void host.getSquadView(PLAYER_SQUAD).then((squadView) => {
      if (!cancelled) setView(squadView);
    });
    return () => {
      cancelled = true;
    };
  }, [host]);

  return (
    <main className="app">
      <div className="rotate-notice">Rotate your device</div>
      {!view ? (
        <p className="loading">Loading…</p>
      ) : view.result ? (
        <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={seed} onPlayAgain={() => setSeed(newSeed())} />
      ) : (
        <PlanningScreen view={view} submitPlan={(plan) => host.submitPlan(plan)} onResolved={setView} />
      )}
    </main>
  );
}
