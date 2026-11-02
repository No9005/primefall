import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useMemo, useState } from "react";
import { EndScreen } from "./EndScreen";
import { PlanningScreen } from "./PlanningScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

const newSeed = () => Date.now() >>> 0;

export function App() {
  // A fresh seed per match; the start and end screens show it for bug reports.
  const [seed, setSeed] = useState(newSeed);
  const [started, setStarted] = useState(false);
  const host = useMemo(() => createLocalHost(seed), [seed]);
  const [view, setView] = useState<SquadView>();

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setView(undefined);
    void host.getSquadView(PLAYER_SQUAD).then((squadView) => {
      if (!cancelled) setView(squadView);
    });
    return () => {
      cancelled = true;
    };
  }, [host, started]);

  return (
    <main className="app">
      <div className="rotate-notice">Rotate your device</div>
      {!started ? (
        <section className="end-screen" aria-label="Start" data-testid="start-screen">
          <h1>Primefall</h1>
          <button type="button" onClick={() => setStarted(true)}>
            Play
          </button>
          <p className="seed" data-testid="start-seed">
            Seed {seed}
          </p>
        </section>
      ) : !view ? (
        <p className="loading">Loading…</p>
      ) : view.result ? (
        <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={seed} onPlayAgain={() => setSeed(newSeed())} />
      ) : (
        <PlanningScreen view={view} submitPlan={(plan) => host.submitPlan(plan)} onResolved={setView} />
      )}
    </main>
  );
}
