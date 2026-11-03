import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { EndScreen } from "./EndScreen";
import { clearSavedMatch, loadSavedMatch, saveMatch } from "./match-storage";
import { PlanningScreen } from "./PlanningScreen";
import { TutorialScreen } from "./TutorialScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

const newSeed = () => Date.now() >>> 0;

export function App() {
  // A fresh seed per match; the start and end screens show it for bug reports.
  const [host, setHost] = useState(() => createLocalHost(newSeed()));
  const seed = host.seed;
  const [started, setStarted] = useState(false);
  // The Tutorial runs from static data; it never touches the host or the saved match.
  const [tutorial, setTutorial] = useState(false);
  // A match saved by an earlier visit, offered for Resume on the start screen.
  const [saved] = useState(loadSavedMatch);
  const [view, setView] = useState<SquadView>();

  // The host is at the start of a Round whenever the view changes; save it, or forget a finished match.
  useEffect(() => {
    if (!started || !view) return;
    if (view.result) clearSavedMatch();
    else saveMatch(host);
  }, [host, started, view]);

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
      {!started && tutorial ? (
        <TutorialScreen
          onPlay={() => {
            setTutorial(false);
            setStarted(true);
          }}
          onClose={() => setTutorial(false)}
        />
      ) : !started ? (
        <section className="end-screen" aria-label="Start" data-testid="start-screen">
          <h1>Primefall</h1>
          <button type="button" onClick={() => setStarted(true)}>
            Play
          </button>
          {saved && (
            <button
              type="button"
              data-testid="resume"
              onClick={() => {
                setHost(saved);
                setStarted(true);
              }}
            >
              Resume
            </button>
          )}
          <button type="button" data-testid="tutorial-button" onClick={() => setTutorial(true)}>
            Tutorial
          </button>
          <p className="seed" data-testid="start-seed">
            Seed {seed}
          </p>
        </section>
      ) : !view ? (
        <p className="loading">Loading…</p>
      ) : view.result ? (
        <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={seed} onPlayAgain={() => setHost(createLocalHost(newSeed()))} />
      ) : (
        <PlanningScreen view={view} submitPlan={(plan) => host.submitPlan(plan)} onResolved={setView} />
      )}
    </main>
  );
}
