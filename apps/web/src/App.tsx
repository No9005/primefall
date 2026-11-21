import { type HeroClass, SquadId, type SquadView } from "game-core";
import { createLocalHost, type LocalMatchHost } from "game-core/local-host";
import { useEffect, useState } from "react";
import { modeForRole, parseRole, type Role, roleOf } from "./attack-defend";
import { aiPlanner } from "./ai-planner";
import { EndScreen } from "./EndScreen";
import { SideScreen } from "./SideScreen";
import { TitleScreen } from "./TitleScreen";
import { IntroFlash, NotstromIntro } from "./NotstromIntro";
import { introPlays } from "./intro-film";
import { clearSavedMatch, loadSavedMatch, loadSavedPlayerHero, parsePlayerHero, saveMatch } from "./match-storage";
import { HeroSelectScreen } from "./HeroSelectScreen";
import { PlanningScreen } from "./PlanningScreen";
import { GlossaryScreen } from "./GlossaryScreen";
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
  onPlayAgain: (side: Role | undefined) => void;
}

/** The running match (planning and Resolution) or, once it has a result, the end screen. */
function MatchScreen({ view, host, playerHero, onResolved, onPlayAgain }: MatchScreenProps) {
  if (view.result) {
    const side = roleOf(view);
    const unit = view.heroes.find((candidate) => candidate.heroClass === playerHero);
    const hero = unit && { heroId: unit.id, heroClass: unit.heroClass, tile: unit.position };
    return <EndScreen result={view.result} squad={PLAYER_SQUAD} seed={host.seed} role={side} roundLimit={view.roundLimit} hero={hero} onPlayAgain={() => onPlayAgain(side)} />;
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
  // Before the match: the start screen, the Hero Select (Play) or the Glossary, which run from static data and never touch the host or the saved match.
  const [entry, setEntry] = useState<"start" | "intro" | "side" | "select" | "replay" | "glossary">("start");
  const [flash, setFlash] = useState(false);
  const [role, setRole] = useState<Role>(); // The side chosen in Attack and Defend; none in the classic mode.
  // A match saved by an earlier visit, offered for Resume on the start screen.
  const [saved, setSaved] = useState(loadSavedMatch);
  // The Player Hero: set by the start parameter (?hero=controller); Resume restores the saved match's one.
  const [playerHero, setPlayerHero] = useState(() => parsePlayerHero(startParameters.get("hero")));
  const [view, setView] = useMatchView(host, started, playerHero);
  // A browser plays sound only after a tap: the first one arms it.
  useEffect(() => gameAudio.armUnlock(), []);
  /** Starts a match of the mode: the host of the start screen is replaced by one with the same seed in the mode of the role. */
  function beginMatch(side: Role | undefined) {
    setHost(createLocalHost(seed, side && modeForRole(side), aiPlanner));
    setStarted(true);
  }

  /** Back to the Hero Select of the same mode ("replay": its Back leads to the start screen, the role stays chosen); the next match starts there with a new seed and the Hero picked then. */
  function playAgain(side: Role | undefined) {
    setHost(createLocalHost(newSeed(), side && modeForRole(side), aiPlanner));
    setView(undefined);
    setSaved(undefined);
    setRole(side);
    setEntry("replay");
    setStarted(false);
  }

  const film = !startParameters.has("hero") && introPlays(startParameters);
  function renderStart() {
    if (entry === "intro") return <NotstromIntro onDone={(playedToEnd) => { setFlash(playedToEnd); setEntry("select"); }} />;
    if (entry === "glossary") return <GlossaryScreen onClose={() => setEntry("start")} />;
    if (entry === "side") return <SideScreen onBack={() => setEntry("start")} onNext={(side) => { setRole(side); setEntry("select"); }} />;
    if (entry === "select" || entry === "replay") {
      return (
        <HeroSelectScreen
          mode={role ?? "classic"}
          onBack={() => setEntry(role && entry === "select" ? "side" : "start")}
          onStart={(hero) => {
            setPlayerHero(hero);
            beginMatch(role);
          }}
        />
      );
    }
    return (
      <TitleScreen
        seed={seed}
        canResume={saved !== undefined}
        film={film}
        onPlay={() => {
          setRole(undefined);
          if (startParameters.has("hero")) beginMatch(undefined);
          else setEntry(film ? "intro" : "select");
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
        onGlossary={() => setEntry("glossary")}
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
      {flash && <IntroFlash onGone={() => setFlash(false)} />}
    </main>
  );
}
