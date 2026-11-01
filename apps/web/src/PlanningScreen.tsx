import {
  ActionKind,
  type CardIndex,
  HERO_DECKS,
  HeroClass,
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
import { CARD_USE_LABELS, CardUse, cardUseReasons, energyReadout, selectHero } from "./planning-selection";

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
  /** Shield per Hero id gained so far in the playback; it expires when the playback ends. */
  shields: Record<string, number>;
}

function SquadPanel({
  heroes,
  selectedId,
  shields,
  onSelect,
}: {
  heroes: readonly HeroView[];
  selectedId: string;
  shields: Record<string, number>;
  onSelect: (id: string) => void;
}) {
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
              {(shields[hero.id] ?? 0) > 0 && ` · Shield ${shields[hero.id]}`}
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
  pitched: readonly CardIndex[];
  armed: CardIndex | undefined;
  choosing: CardIndex | undefined;
  disabled: boolean;
  onCardTap: (card: CardIndex) => void;
}

const ACTION_USE_LABELS: Record<ActionKind, string> = {
  [ActionKind.Move]: CARD_USE_LABELS[CardUse.Move],
  [ActionKind.Block]: CARD_USE_LABELS[CardUse.Block],
  [ActionKind.Primary]: CARD_USE_LABELS[CardUse.Primary],
};

function Hand({ hero, queue, pitched, armed, choosing, disabled, onCardTap }: HandProps) {
  const deck = HERO_DECKS[hero.heroClass];
  return (
    <ul className="hud hand" aria-label="Hand">
      {hero.hand.map((cardIndex) => {
        const card = deck[cardIndex]!;
        const queuedAt = queue.findIndex((action) => action.card === cardIndex);
        const isPitched = pitched.includes(cardIndex);
        let use = "";
        if (queuedAt >= 0) use = `${ACTION_USE_LABELS[queue[queuedAt]!.kind]} · #${queuedAt + 1}`;
        else if (isPitched) use = CARD_USE_LABELS[CardUse.Pitch];
        else if (cardIndex === armed) use = "Pick a tile";
        return (
          <li key={cardIndex}>
            <button
              type="button"
              className="card"
              aria-pressed={cardIndex === armed || cardIndex === choosing || queuedAt >= 0 || isPitched}
              disabled={disabled}
              onClick={() => onCardTap(cardIndex)}
            >
              <span className="card-name">{card.name}</span>
              <span className="card-use">{use}</span>
              <span className="card-cost">{card.energyCost}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function UseChooser({ reasons, onChoose }: { reasons: Record<CardUse, string | undefined>; onChoose: (use: CardUse) => void }) {
  return (
    <div className="hud use-chooser" role="group" aria-label="Use card as">
      {Object.values(CardUse).map((use) => (
        <button key={use} type="button" className="use" disabled={reasons[use] !== undefined} onClick={() => onChoose(use)}>
          <span>{CARD_USE_LABELS[use]}</span>
          {reasons[use] && <span className="use-reason">{reasons[use]}</span>}
        </button>
      ))}
    </div>
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
  const [pitched, setPitched] = useState<readonly CardIndex[]>([]);
  const [armed, setArmed] = useState<CardIndex>();
  const [choosing, setChoosing] = useState<CardIndex>();
  const [playback, setPlayback] = useState<PlaybackState>();
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const plan: SquadPlan = useMemo(
    () => ({ squad: view.squad, heroes: [{ heroId: selected.id, queue, pitched }] }),
    [view.squad, selected.id, queue, pitched],
  );
  const issues = useMemo(() => validatePlan(view, plan), [view, plan]);
  const playing = playback !== undefined;
  const energy = energyReadout(selected.heroClass, queue, pitched);

  const lastMove = queue.filter((action) => action.kind === ActionKind.Move).at(-1);
  const planningFrom = lastMove?.kind === ActionKind.Move ? lastMove.destination : selected.position;
  const highlights = useMemo(
    () => (armed !== undefined && !playing ? moveDestinations(planningFrom) : []),
    [armed, playing, planningFrom],
  );
  const markers = useMemo(
    () =>
      queue.flatMap((action, i) =>
        action.kind === ActionKind.Move ? [{ position: action.destination, label: String(i + 1) }] : [],
      ),
    [queue],
  );

  const boardHeroes = useMemo(
    () => view.heroes.map((hero) => ({ ...hero, position: playback?.positions[hero.id] ?? hero.position })),
    [view.heroes, playback],
  );

  function changeSelection(heroId: string) {
    const next = selectHero({ selectedId, queue, pitched, armed }, heroId, playing);
    setSelectedId(next.selectedId);
    setQueue(next.queue);
    setPitched(next.pitched);
    setArmed(next.armed);
    setChoosing(undefined);
  }

  // Tapping a used card frees it again; tapping a free card opens the use chooser.
  function tapCard(card: CardIndex) {
    setArmed(undefined);
    if (queue.some((action) => action.card === card) || pitched.includes(card)) {
      setQueue(queue.filter((action) => action.card !== card));
      setPitched(pitched.filter((pitchedCard) => pitchedCard !== card));
      setChoosing(undefined);
    } else {
      setChoosing(choosing === card ? undefined : card);
    }
  }

  function chooseUse(use: CardUse) {
    if (choosing === undefined) return;
    if (use === CardUse.Pitch) setPitched([...pitched, choosing]);
    if (use === CardUse.Block) setQueue([...queue, { kind: ActionKind.Block, card: choosing }]);
    if (use === CardUse.Move) setArmed(choosing);
    setChoosing(undefined);
  }

  function tapTile(destination: GridPosition) {
    if (armed === undefined) return;
    setQueue([...queue, { kind: ActionKind.Move, card: armed, destination }]);
    setArmed(undefined);
  }

  async function commit() {
    const result = await submitPlan(plan);
    const positions: Record<string, GridPosition> = {};
    const shields: Record<string, number> = {};
    const tickCount = tickCountOf(result.events);
    setPlayback({ tick: 0, tickCount, positions, shields });
    for (const frame of buildPlaybackFrames(result.events)) {
      Object.assign(positions, frame.moves);
      for (const [heroId, amount] of Object.entries(frame.shields)) shields[heroId] = (shields[heroId] ?? 0) + amount;
      setPlayback({ tick: frame.tick, tickCount, positions: { ...positions }, shields: { ...shields } });
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      if (unmounted.current) return;
    }
    setPlayback(undefined);
    setQueue([]);
    setPitched([]);
    setArmed(undefined);
    setChoosing(undefined);
    onResolved(result.view);
  }

  return (
    <div className="planning">
      <Board
        heroes={boardHeroes}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && changeSelection(id)}
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
      <SquadPanel heroes={view.heroes} selectedId={selected.id} shields={playback?.shields ?? {}} onSelect={changeSelection} />
      <div className="hud energy" data-testid="energy" aria-label="Energy">
        Energy · Pitched {energy.pitched} · Spent {energy.spent} · Available {energy.available}
      </div>
      {choosing !== undefined && !playing && (
        <UseChooser reasons={cardUseReasons(selected.heroClass, choosing, queue, pitched)} onChoose={chooseUse} />
      )}
      <Hand
        hero={selected}
        queue={queue}
        pitched={pitched}
        armed={armed}
        choosing={choosing}
        disabled={playing}
        onCardTap={tapCard}
      />
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
