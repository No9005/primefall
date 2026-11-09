import { type HeroClass, SquadId, type SquadView } from "game-core";
import { createLocalHost, type LocalMatchHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { modeForRole, parseRole, type Role, roleOf } from "./attack-defend";
import { aiPlanner } from "./ai-planner";
import { EndScreen } from "./EndScreen";
import { SideScreen } from "./SideScreen";
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
  onPlayAttackAndDefend: () => void;
  onResume: () => void;
  onTutorial: () => void;
}

function StartScreen({ seed, canResume, onPlay, onPlayAttackAndDefend, onResume, onTutorial }: StartScreenProps) {
  return (
    <section className="start-screen" aria-label="Start" data-testid="start-screen">
      <h1>PRIMEFALL</h1>
      <p className="start-sub">REACTOR DECK · 3V3 VS AI</p>
      <div className="start-modes">
        <button type="button" className="start-mode classic" data-testid="play-classic" onClick={onPlay}>
          <span className="start-tag">DEFAULT</span>
          <b>CLASSIC</b>
          <span className="start-text">Both Squads fight for the Prime Zone. Hold it for 3 Resolutions.</span>
        </button>
        <button type="button" className="start-mode attack-defend" data-testid="play-attack-defend" onClick={onPlayAttackAndDefend}>
          <span className="start-tag">NEW · TWO ROLES</span>
          <b>ATTACK AND DEFEND</b>
          <span className="start-text">One Squad storms the Prime Zone, the other holds out. Pick your side next.</span>
        </button>
      </div>
      <div className="start-more">
        {canResume && (
          <button type="button" data-testid="resume" onClick={onResume}>
            Resume match
          </button>
        )}
        <button type="button" data-testid="tutorial-button" onClick={onTutorial}>
          Tutorial
        </button>
        <p className="seed" data-testid="start-seed">
          seed {seed}
        </p>
      </div>
    </section>
  );
}

/** The player's Squad View of the running match; it is saved (or, for a finished match, forgotten) whenever it changes. */
function useMatchView(host: LocalMatchHost, started: boolean, playerHero: HeroClass) {
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
  return [view, setView] as const;
}

export function App() {
  // A fresh seed per match; the start and end screens show it for bug reports.
  const [host, setHost] = useState(() => createLocalHost(newSeed(), undefined, aiPlanner));
  const seed = host.seed;
  const [started, setStarted] = useState(false);
  // Before the match: the start screen, the Hero Select (Play) or the Tutorial, which runs from static data and never touches the host or the saved match.
  const [entry, setEntry] = useState<"start" | "side" | "select" | "tutorial">("start");
  // The side chosen in Attack and Defend; none in the classic mode.
  const [role, setRole] = useState<Role>();
  // A match saved by an earlier visit, offered for Resume on the start screen.
  const [saved] = useState(loadSavedMatch);
  // The Player Hero: set by the start parameter (?hero=controller); Resume restores the saved match's one.
  const [playerHero, setPlayerHero] = useState(() => parsePlayerHero(startParameters.get("hero")));
  const [view, setView] = useMatchView(host, started, playerHero);

  /** Starts a match of the mode: the host of the start screen is replaced by one with the same seed in the mode of the role. */
  function beginMatch(side: Role | undefined) {
    setHost(createLocalHost(seed, side && modeForRole(side), aiPlanner));
    setStarted(true);
  }

  function renderStartOrTutorial() {
    if (entry === "tutorial") return <TutorialScreen onPlay={() => setStarted(true)} onClose={() => setEntry("start")} />;
    if (entry === "side") return <SideScreen onBack={() => setEntry("start")} onNext={(side) => { setRole(side); setEntry("select"); }} />;
    if (entry === "select") {
      return (
        <HeroSelectScreen
          mode={role ?? "classic"}
          onBack={() => setEntry(role ? "side" : "start")}
          onStart={(hero) => {
            setPlayerHero(hero);
            beginMatch(role);
          }}
        />
      );
    }
    return (
      <StartScreen
        seed={seed}
        canResume={saved !== undefined}
        onPlay={() => {
          setRole(undefined);
          if (startParameters.has("hero")) beginMatch(undefined);
          else setEntry("select");
        }}
        onPlayAttackAndDefend={() => {
          const side = parseRole(startParameters.get("role"));
          if (side && startParameters.has("hero")) {
            setRole(side);
            beginMatch(side);
          } else setEntry("side");
        }}
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
      const side = roleOf(view);
      return <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={seed} role={side} roundLimit={view.roundLimit} onPlayAgain={() => setHost(createLocalHost(newSeed(), side && modeForRole(side), aiPlanner))} />;
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
