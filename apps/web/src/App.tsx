import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { PlanningScreen } from "./PlanningScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

export function App() {
  // A fresh seed per page load; the Start screen will show it for bug reports.
  const [host] = useState(() => createLocalHost(Date.now() >>> 0));
  const [view, setView] = useState<SquadView>();

  useEffect(() => {
    let cancelled = false;
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
      {view ? <PlanningScreen view={view} submitPlan={(plan) => host.submitPlan(plan)} onResolved={setView} /> : <p className="loading">Loading…</p>}
    </main>
  );
}
