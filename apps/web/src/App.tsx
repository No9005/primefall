import { type HeroClass, SquadId, type SquadView } from "game-core";
import { createLocalHost, type LocalMatchHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { aiPlanner } from "./ai-planner";
import { EndScreen } from "./EndScreen";
import { TitleScreen } from "./TitleScreen";
import { NotstromIntroFlash, NotstromIntro } from "./NotstromIntro";
import { notstromIntroPlays } from "./notstrom-intro";
import { clearSavedMatch, loadSavedMatch, loadSavedPlayerHero, parsePlayerHero, saveMatch } from "./match-storage";
import { HeroSelectScreen } from "./HeroSelectScreen";
import { PlanningScreen } from "./PlanningScreen";
import { gameAudio } from "./audio";

/** The player's Squad in the offline prototype. */
const PLAYER_SQUAD = SquadId.Left;

const newSeed = () => Date.now() >>> 0;

/** A start parameter (?hero=controller) names the Player Hero, so the Hero Select is skipped. */
const startParameters = new URLSearchParams(window.location.search);

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

interface MatchScreenProps {
  view: SquadView;
  host: LocalMatchHost;
  playerHero: HeroClass;
  onResolved: (view: SquadView) => void;
  onPlayAgain: () => void;
}

/** The running match (planning and Resolution) or, once it has a result, the end screen. */
function MatchScreen({ view, host, playerHero, onResolved, onPlayAgain }: MatchScreenProps) {
  if (view.result) {
    const unit = view.heroes.find((candidate) => candidate.heroClass === playerHero);
    const hero = unit && { heroId: unit.id, heroClass: unit.heroClass, tile: unit.position };
    return <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={host.seed} hero={hero} onPlayAgain={onPlayAgain} />;
  }
  return (
    <PlanningScreen
      view={view}
      playerHeroClass={playerHero}
      submitPlan={(plan) => host.submitPlan(plan)}
      getAllyPlan={(heroIds) => host.getAllyPlan(PLAYER_SQUAD, heroIds)}
      onResolved={onResolved}
    />
  );
}

export function App() {
  // A fresh seed per match; the start and end screens show it for bug reports.
  const [host, setHost] = useState(() => createLocalHost(newSeed(), undefined, aiPlanner));
  const seed = host.seed;
  const [started, setStarted] = useState(false);
  // Before the match: the start screen, the Hero Select (Play), which run from static data and never touch the host or the saved match.
  const [entry, setEntry] = useState<"start" | "notstrom-intro" | "select" | "replay">("start");
  const [flash, setFlash] = useState(false);
  // A match saved by an earlier visit, offered for Resume on the start screen.
  const [saved, setSaved] = useState(loadSavedMatch);
  // The Player Hero: set by the start parameter (?hero=controller); Resume restores the saved match's one.
  const [playerHero, setPlayerHero] = useState(() => parsePlayerHero(startParameters.get("hero")));
  const [view, setView] = useMatchView(host, started, playerHero);
  // A browser plays sound only after a tap: the first one arms it.
  useEffect(() => gameAudio.armUnlock(), []);
  /** Starts the match: the host of the start screen is replaced by a fresh one with the same seed. */
  function beginMatch() {
    setHost(createLocalHost(seed, undefined, aiPlanner));
    setStarted(true);
  }

  /** Back to the Hero Select ("replay": its Back leads to the start screen); the next match starts there with a new seed and the Hero picked then. */
  function playAgain() {
    setHost(createLocalHost(newSeed(), undefined, aiPlanner));
    setView(undefined);
    setSaved(undefined);
    setEntry("replay");
    setStarted(false);
  }

  const notstromIntro = !startParameters.has("hero") && notstromIntroPlays(startParameters);
  function renderStart() {
    if (entry === "notstrom-intro") return <NotstromIntro onDone={(playedToEnd) => { setFlash(playedToEnd); setEntry("select"); }} />;
    if (entry === "select" || entry === "replay") {
      return (
        <HeroSelectScreen
          onBack={() => setEntry("start")}
          onStart={(hero) => {
            setPlayerHero(hero);
            beginMatch();
          }}
        />
      );
    }
    return (
      <TitleScreen
        seed={seed}
        canResume={saved !== undefined}
        notstromIntro={notstromIntro}
        onPlay={() => { if (startParameters.has("hero")) beginMatch(); else setEntry(notstromIntro ? "notstrom-intro" : "select"); }}
        onResume={() => {
          if (saved) {
            setHost(saved);
            setPlayerHero(loadSavedPlayerHero());
          }
          setStarted(true);
        }}
      />
    );
  }

  function renderScreen() {
    if (!started) return renderStart();
    if (!view) return <p className="loading">Loading…</p>;
    return <MatchScreen view={view} host={host} playerHero={playerHero} onResolved={setView} onPlayAgain={playAgain} />;
  }

  return (
    <main className="app">
      <div className="rotate-notice">Rotate your device</div>
      {renderScreen()}
      {flash && <NotstromIntroFlash onGone={() => setFlash(false)} />}
    </main>
  );
}
