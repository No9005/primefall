import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { PlanningScreen } from "./PlanningScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

export function App() {
  const [view, setView] = useState<SquadView>();

  useEffect(() => {
    let cancelled = false;
    // A fresh seed per page load; the Start screen will show it for bug reports.
    void createLocalHost(Date.now() >>> 0)
      .getSquadView(PLAYER_SQUAD)
      .then((squadView) => {
        if (!cancelled) setView(squadView);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app">
      <div className="rotate-notice">Rotate your device</div>
      {view ? <PlanningScreen view={view} /> : <p className="loading">Loading…</p>}
    </main>
  );
}
