import {
  ActionKind,
  type CardIndex,
  HERO_DECKS,
  HeroClass,
  MAX_QUEUE_LENGTH,
  moveDestinations,
  type GridPosition,
  type HeroView,
  type QueuedAction,
  ROUND_LIMIT,
  type SquadPlan,
  type SquadView,
  type SubmitResult,
  validatePlan,
} from "game-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./Board";
import { buildPlaybackFrames, tickCountOf } from "./playback";

/** The Hero the player plans for; the other two are AI planned (offline prototype spec). */
export const PLAYER_HERO_CLASS = HeroClass.Bruiser;

/** Time one tile of movement takes in the playback. */
const STEP_MS = 450;

const HERO_NAMES: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "Bruiser",
  [HeroClass.Controller]: "Controller",
  [HeroClass.Assassin]: "Assassin",
};

interface PlaybackState {
  tick: number;
  tickCount: number;
  positions: Record<string, GridPosition>;
}

function SquadPanel({ heroes, selectedId, onSelect }: { heroes: readonly HeroView[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="hud squad-panel" aria-label="Squad">
      {heroes.map((hero) => {
        const playerControlled = hero.heroClass === PLAYER_HERO_CLASS;
        return (
          <button
            key={hero.id}
            type="button"
            className="hero-row"
            aria-pressed={hero.id === selectedId}
            disabled={!playerControlled}
            onClick={() => onSelect(hero.id)}
          >
            <span className="hero-name">{HERO_NAMES[hero.heroClass]}</span>
            <span className="counts">
              Deck {hero.deckCount} · Exile {hero.exileCount}
            </span>
            {!playerControlled && <span className="tag">AI</span>}
          </button>
        );
      })}
    </aside>
  );
}

interface HandProps {
  hero: HeroView;
  queue: readonly QueuedAction[];
  armed: CardIndex | undefined;
  disabled: boolean;
  onCardTap: (card: CardIndex) => void;
}

function Hand({ hero, queue, armed, disabled, onCardTap }: HandProps) {
  const deck = HERO_DECKS[hero.heroClass];
  return (
    <ul className="hud hand" aria-label="Hand">
      {hero.hand.map((cardIndex) => {
        const card = deck[cardIndex]!;
        const queuedAt = queue.findIndex((action) => action.card === cardIndex);
        return (
          <li key={cardIndex}>
            <button
              type="button"
              className="card"
              aria-pressed={cardIndex === armed || queuedAt >= 0}
              disabled={disabled}
              onClick={() => onCardTap(cardIndex)}
            >
              <span className="card-name">{card.name}</span>
              <span className="card-use">{queuedAt >= 0 ? `Move 2 · #${queuedAt + 1}` : cardIndex === armed ? "Pick a tile" : ""}</span>
              <span className="card-cost">{card.energyCost}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface PlanningScreenProps {
  view: SquadView;
  submitPlan: (plan: SquadPlan) => Promise<SubmitResult>;
  /** Called with the view of the next Round once the playback has finished. */
  onResolved: (view: SquadView) => void;
}

export function PlanningScreen({ view, submitPlan, onResolved }: PlanningScreenProps) {
  const initial = view.heroes.find((hero) => hero.heroClass === PLAYER_HERO_CLASS)!;
  const [selectedId, setSelectedId] = useState(initial.id);
  const selected = view.heroes.find((hero) => hero.id === selectedId) ?? initial;
  const [queue, setQueue] = useState<readonly QueuedAction[]>([]);
  const [armed, setArmed] = useState<CardIndex>();
  const [playback, setPlayback] = useState<PlaybackState>();
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const plan: SquadPlan = useMemo(
    () => ({ squad: view.squad, heroes: [{ heroId: selected.id, queue }] }),
    [view.squad, selected.id, queue],
  );
  const issues = useMemo(() => validatePlan(view, plan), [view, plan]);
  const playing = playback !== undefined;

  const planningFrom = queue.at(-1)?.destination ?? selected.position;
  const highlights = useMemo(
    () => (armed !== undefined && !playing ? moveDestinations(planningFrom) : []),
    [armed, playing, planningFrom],
  );
  const markers = useMemo(() => queue.map((action, i) => ({ position: action.destination, label: String(i + 1) })), [queue]);

  const boardHeroes = useMemo(
    () => view.heroes.map((hero) => ({ ...hero, position: playback?.positions[hero.id] ?? hero.position })),
    [view.heroes, playback],
  );

  function tapCard(card: CardIndex) {
    if (queue.some((action) => action.card === card)) {
      setQueue(queue.filter((action) => action.card !== card));
      setArmed(undefined);
    } else if (queue.length < MAX_QUEUE_LENGTH) {
      setArmed(armed === card ? undefined : card);
    }
  }

  function tapTile(destination: GridPosition) {
    if (armed === undefined) return;
    setQueue([...queue, { kind: ActionKind.Move, card: armed, destination }]);
    setArmed(undefined);
  }

  async function commit() {
    const result = await submitPlan(plan);
    const positions: Record<string, GridPosition> = {};
    const tickCount = tickCountOf(result.events);
    setPlayback({ tick: 0, tickCount, positions });
    for (const frame of buildPlaybackFrames(result.events)) {
      Object.assign(positions, frame.moves);
      setPlayback({ tick: frame.tick, tickCount, positions: { ...positions } });
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      if (unmounted.current) return;
    }
    setPlayback(undefined);
    setQueue([]);
    setArmed(undefined);
    onResolved(result.view);
  }

  return (
    <div className="planning">
      <Board
        heroes={boardHeroes}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && setSelectedId(id)}
        highlights={highlights}
        markers={markers}
        onTileTap={tapTile}
      />
      <header className="hud top-bar">
        <span data-testid="round">
          Round {view.round} / {ROUND_LIMIT}
        </span>
        {playing && (
          <span data-testid="tick" className="tick">
            Tick {Math.max(playback.tick, 1)} / {Math.max(playback.tickCount, 1)}
          </span>
        )}
      </header>
      <SquadPanel heroes={view.heroes} selectedId={selected.id} onSelect={setSelectedId} />
      <Hand hero={selected} queue={queue} armed={armed} disabled={playing} onCardTap={tapCard} />
      <section className="hud commit-panel" aria-label="Commit">
        {issues.length > 0 && (
          <ul className="issues" role="alert">
            {issues.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        )}
        <button type="button" className="commit" disabled={issues.length > 0 || playing} onClick={() => void commit()}>
          Commit
        </button>
      </section>
    </div>
  );
}
