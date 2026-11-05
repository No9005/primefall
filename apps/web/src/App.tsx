import { SquadId, type SquadView } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { EndScreen } from "./EndScreen";
import { clearSavedMatch, loadSavedMatch, loadSavedPlayerHero, parsePlayerHero, saveMatch } from "./match-storage";
import { HeroSelectScreen } from "./HeroSelectScreen";
import { PlanningScreen } from "./PlanningScreen";
import { TutorialScreen } from "./TutorialScreen";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

const newSeed = () => Date.now() >>> 0;

/** A start parameter (?hero=controller) names the Player Hero, so the Hero Select is skipped. */
const startParameters = new URLSearchParams(window.location.search);

interface StartScreenProps {
  seed: number;
  canResume: boolean;
  onPlay: () => void;
  onResume: () => void;
  onTutorial: () => void;
}

function StartScreen({ seed, canResume, onPlay, onResume, onTutorial }: StartScreenProps) {
  return (
    <section className="end-screen" aria-label="Start" data-testid="start-screen">
      <h1>Primefall</h1>
      <button type="button" onClick={onPlay}>
        Play
      </button>
      {canResume && (
        <button type="button" data-testid="resume" onClick={onResume}>
          Resume
        </button>
      )}
      <button type="button" data-testid="tutorial-button" onClick={onTutorial}>
        Tutorial
      </button>
      <p className="seed" data-testid="start-seed">
        Seed {seed}
      </p>
    </section>
  );
}

export function App() {
  // A fresh seed per match; the start and end screens show it for bug reports.
  const [host, setHost] = useState(() => createLocalHost(newSeed()));
  const seed = host.seed;
  const [started, setStarted] = useState(false);
  // Before the match: the start screen, the Hero Select (Play) or the Tutorial, which runs from static data and never touches the host or the saved match.
  const [entry, setEntry] = useState<"start" | "select" | "tutorial">("start");
  // A match saved by an earlier visit, offered for Resume on the start screen.
  const [saved] = useState(loadSavedMatch);
  // The Player Hero: set by the start parameter (?hero=controller); Resume restores the saved match's one.
  const [playerHero, setPlayerHero] = useState(() => parsePlayerHero(startParameters.get("hero")));
  const [view, setView] = useState<SquadView>();

  // The host is at the start of a Round whenever the view changes; save it, or forget a finished match.
  useEffect(() => {
    if (!started || !view) return;
    if (view.result) clearSavedMatch();
    else saveMatch(host, undefined, playerHero);
  }, [host, started, view, playerHero]);

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

  function renderStartOrTutorial() {
    if (entry === "tutorial") return <TutorialScreen onPlay={() => setStarted(true)} onClose={() => setEntry("start")} />;
    if (entry === "select") {
      return (
        <HeroSelectScreen
          mode="classic"
          onBack={() => setEntry("start")}
          onStart={(hero) => {
            setPlayerHero(hero);
            setStarted(true);
          }}
        />
      );
    }
    return (
      <StartScreen
        seed={seed}
        canResume={saved !== undefined}
        onPlay={() => (startParameters.has("hero") ? setStarted(true) : setEntry("select"))}
        onResume={() => {
          if (saved) {
            setHost(saved);
            setPlayerHero(loadSavedPlayerHero());
          }
          setStarted(true);
        }}
        onTutorial={() => setEntry("tutorial")}
      />
    );
  }

  function renderScreen() {
    if (!started) return renderStartOrTutorial();
    if (!view) return <p className="loading">Loading…</p>;
    if (view.result) {
      return <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={seed} onPlayAgain={() => setHost(createLocalHost(newSeed()))} />;
    }
    return (
      <PlanningScreen
        view={view}
        playerHeroClass={playerHero}
        submitPlan={(plan) => host.submitPlan(plan)}
        getAllyPlan={(heroIds) => host.getAllyPlan(PLAYER_SQUAD, heroIds)}
        onResolved={setView}
      />
    );
  }

  return (
    <main className="app">
      <div className="rotate-notice">Rotate your device</div>
      {renderScreen()}
    </main>
  );
}
