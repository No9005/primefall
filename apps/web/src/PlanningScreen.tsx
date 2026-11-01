import {
  ActionKind,
  type CardIndex,
  type CardDefinition,
  CardTarget,
  cardInMode,
  CardType,
  type EnemyView,
  HERO_DECKS,
  HeroClass,
  moveDestinations,
  type GridPosition,
  type HeroView,
  type QueuedAction,
  PRIME_ZONE_WIN_RESOLUTIONS,
  ROUND_LIMIT,
  SquadId,
  type SquadPlan,
  type SquadView,
  type SubmitResult,
  validatePlan,
  Visibility,
} from "game-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board, type TokenHero } from "./Board";
import { buildPlaybackFrames, describeEvent, tickCountOf } from "./playback";
import { CARD_USE_LABELS, CardUse, cardUseReasons, coverProtectionLabel, energyReadout, rangeDamageLabel, selectHero } from "./planning-selection";

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
  /** Shield per Hero id gained so far in the playback, less what Attacks absorbed; it expires with the playback. */
  shields: Record<string, number>;
  /** Cards removed from each Hero's Deck so far in the playback (Deck Damage). */
  deckDamage: Record<string, number>;
  exhausted: string[];
  /** Heroes hit in the frame being shown. */
  hit: string[];
  log: string[];
}

function SquadPanel({
  heroes,
  selectedId,
  playback,
  onSelect,
}: {
  heroes: readonly HeroView[];
  selectedId: string;
  playback: PlaybackState | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="hud squad-panel" aria-label="Squad">
      {heroes.map((hero) => {
        const playerControlled = hero.heroClass === PLAYER_HERO_CLASS;
        const shield = playback?.shields[hero.id] ?? 0;
        return (
          <button
            key={hero.id}
            type="button"
            className="hero-row"
            aria-pressed={hero.id === selectedId}
            disabled={!playerControlled || hero.exhausted}
            onClick={() => onSelect(hero.id)}
          >
            <span className="hero-name">{HERO_NAMES[hero.heroClass]}</span>
            <span className="counts">
              Deck {hero.deckCount - (playback?.deckDamage[hero.id] ?? 0)} · Exile {hero.exileCount}
              {shield > 0 && ` · Shield ${shield}`}
            </span>
            {!playerControlled && <span className="tag">AI</span>}
            {hero.slowed && <span className="tag slow-tag">Slowed</span>}
            {hero.hidden && <span className="tag hidden-tag">Hidden · sight +2</span>}
            {(hero.exhausted || playback?.exhausted.includes(hero.id)) && <span className="tag">Exhausted</span>}
          </button>
        );
      })}
    </aside>
  );
}

function EnemyPanel({
  enemies,
  playback,
  attackerPosition,
  aimedCard,
}: {
  enemies: readonly EnemyView[];
  playback: PlaybackState | undefined;
  /** Set while the player picks a target: the protection each enemy's tile gives against this attacker is shown. */
  attackerPosition: GridPosition | undefined;
  /** The card being aimed, if any: a distance-dependent damage is shown per enemy. */
  aimedCard: CardDefinition | undefined;
}) {
  return (
    <aside className="hud enemy-panel" aria-label="Enemy Squad">
      {enemies.map((enemy) => {
        if (enemy.visibility === Visibility.Unknown) {
          return (
            <div key={enemy.id} className="hero-row unknown" data-testid={`enemy-${enemy.heroClass}`}>
              <span className="hero-name">{HERO_NAMES[enemy.heroClass]}</span>
              <span className="counts">Unknown</span>
            </div>
          );
        }
        if (enemy.visibility === Visibility.Ghost) {
          return (
            <div key={enemy.id} className="hero-row ghost" data-testid={`enemy-${enemy.heroClass}`}>
              <span className="hero-name">{HERO_NAMES[enemy.heroClass]}</span>
              <span className="tag">last seen</span>
              <span className="counts">
                Deck {enemy.deckCount} · Discard {enemy.discardCount} · Exile {enemy.exileCount}
              </span>
            </div>
          );
        }
        const cover = attackerPosition && coverProtectionLabel(attackerPosition, enemy.position);
        const damage = attackerPosition && aimedCard && rangeDamageLabel(aimedCard, attackerPosition, enemy.position);
        return (
          <div key={enemy.id} className="hero-row" data-testid={`enemy-${enemy.heroClass}`}>
            <span className="hero-name">{HERO_NAMES[enemy.heroClass]}</span>
            {damage && <span className="tag range-tag">{damage}</span>}
            {attackerPosition && !enemy.exhausted && cover && <span className="tag cover-tag">{cover}</span>}
            {enemy.slowed && <span className="tag slow-tag">Slowed</span>}
            <span className="counts">
              Deck {enemy.deckCount - (playback?.deckDamage[enemy.id] ?? 0)} · Discard {enemy.discardCount} · Exile{" "}
              {enemy.exileCount}
              {enemy.shield + (playback?.shields[enemy.id] ?? 0) > 0 &&
                ` · Shield ${enemy.shield + (playback?.shields[enemy.id] ?? 0)}`}
            </span>
            {(enemy.exhausted || playback?.exhausted.includes(enemy.id)) && <span className="tag">Exhausted</span>}
          </div>
        );
      })}
    </aside>
  );
}

interface HandProps {
  hero: HeroView;
  queue: readonly QueuedAction[];
  pitched: readonly CardIndex[];
  /** The card waiting for a tile (Move 2) or a target (Primary effect). */
  armed: CardIndex | undefined;
  armedLabel: string;
  choosing: CardIndex | undefined;
  disabled: boolean;
  onCardTap: (card: CardIndex) => void;
}

const ACTION_USE_LABELS: Record<ActionKind, string> = {
  [ActionKind.Move]: CARD_USE_LABELS[CardUse.Move],
  [ActionKind.Block]: CARD_USE_LABELS[CardUse.Block],
  [ActionKind.Primary]: CARD_USE_LABELS[CardUse.Primary],
};

function Hand({ hero, queue, pitched, armed, armedLabel, choosing, disabled, onCardTap }: HandProps) {
  const deck = HERO_DECKS[hero.heroClass];
  return (
    <ul className="hud hand" aria-label="Hand">
      {hero.hand.map((cardIndex) => {
        const card = deck[cardIndex]!;
        const queuedAt = queue.findIndex((action) => action.card === cardIndex);
        const isPitched = pitched.includes(cardIndex);
        let use = "";
        const queued = queue[queuedAt];
        if (queued) {
          const overdriven = queued.kind === ActionKind.Primary && queued.overdrive;
          use = `${overdriven ? "Overdrive" : ACTION_USE_LABELS[queued.kind]} · #${queuedAt + 1}`;
        } else if (isPitched) use = CARD_USE_LABELS[CardUse.Pitch];
        else if (cardIndex === armed) use = armedLabel;
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

interface UseChooserProps {
  reasons: Record<CardUse, string | undefined>;
  onChoose: (use: CardUse) => void;
  /** Only for cards that have an Overdrive: the switch applies to the Primary effect. */
  hasOverdrive: boolean;
  overdrive: boolean;
  onToggleOverdrive: () => void;
}

function UseChooser({ reasons, onChoose, hasOverdrive, overdrive, onToggleOverdrive }: UseChooserProps) {
  return (
    <div className="hud use-chooser" role="group" aria-label="Use card as">
      {hasOverdrive && (
        <button type="button" className="use overdrive-switch" aria-pressed={overdrive} onClick={onToggleOverdrive}>
          <span>Overdrive {overdrive ? "on" : "off"}</span>
          <span className="use-reason">{overdrive ? "replaces the effect; the card is Exiled" : "tap to Exile this card for a stronger effect"}</span>
        </button>
      )}
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
  /** The card of a Primary effect that waits for the player to tap its target. */
  const [aiming, setAiming] = useState<CardIndex>();
  /** Log of the last Resolution; stays visible until the next one. */
  const [log, setLog] = useState<string[]>([]);
  const [choosing, setChoosing] = useState<CardIndex>();
  /** Whether the card being chosen is used in Overdrive when its Primary effect is picked. */
  const [overdrive, setOverdrive] = useState(false);
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

  const onBoard = <T extends { id: string; position: GridPosition; exhausted: boolean }>(units: readonly T[]) =>
    units.map((unit) => ({
      ...unit,
      position: playback?.positions[unit.id] ?? unit.position,
      exhausted: unit.exhausted || (playback?.exhausted.includes(unit.id) ?? false),
    }));
  const boardHeroes = useMemo(() => onBoard(view.heroes), [view.heroes, playback]);
  // Unknown enemies have no marker; Ghosts stay where they were last seen, faded.
  const boardEnemies = useMemo(
    () =>
      view.enemies.flatMap((enemy): TokenHero[] => {
        if (enemy.visibility === Visibility.Unknown) return [];
        if (enemy.visibility === Visibility.Ghost) return [{ ...enemy, exhausted: false, ghost: true }];
        return onBoard([enemy]);
      }),
    [view.enemies, playback],
  );
  const aimedCard = aiming === undefined ? undefined : cardInMode(HERO_DECKS[selected.heroClass][aiming]!, overdrive);
  const aimsAtAlly = aimedCard?.type === CardType.Utility && aimedCard.target === CardTarget.AllyHero;
  const targetableIds = useMemo(() => {
    if (aiming === undefined || playing) return [];
    if (aimedCard?.target === CardTarget.SelfHero || aimedCard?.target === CardTarget.EnemiesInRange) return [selected.id];
    // Ghost Shot aims at the last known position of a Ghost.
    if (aimedCard?.target === CardTarget.GhostEnemy) {
      return view.enemies.filter((enemy) => enemy.visibility === Visibility.Ghost).map((enemy) => enemy.id);
    }
    if (aimsAtAlly) return view.heroes.filter((hero) => hero.id !== selected.id && !hero.exhausted).map((hero) => hero.id);
    return view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible && !enemy.exhausted).map((enemy) => enemy.id);
  }, [aiming, aimedCard, aimsAtAlly, playing, selected.id, view.heroes, view.enemies]);
  const nameOf = (heroId: string) => {
    const unit = [...view.heroes, ...view.enemies].find((candidate) => candidate.id === heroId);
    return unit ? `${heroId.startsWith(view.squad) ? "" : "Enemy "}${HERO_NAMES[unit.heroClass]}` : heroId;
  };

  function changeSelection(heroId: string) {
    const next = selectHero({ selectedId, queue, pitched, armed }, heroId, playing);
    setSelectedId(next.selectedId);
    setQueue(next.queue);
    setPitched(next.pitched);
    setArmed(next.armed);
    setAiming(undefined);
    setChoosing(undefined);
    setOverdrive(false);
  }

  // Tapping a used card frees it again; tapping a free card opens the use chooser.
  function tapCard(card: CardIndex) {
    setArmed(undefined);
    setAiming(undefined);
    setOverdrive(false);
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
    if (use === CardUse.Primary) setAiming(choosing);
    else setOverdrive(false);
    setChoosing(undefined);
  }

  function tapTarget(targetId: string) {
    if (aiming === undefined || playing || !targetableIds.includes(targetId)) return;
    setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: targetId, ...(overdrive ? { overdrive } : {}) }]);
    setAiming(undefined);
    setOverdrive(false);
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
    const deckDamage: Record<string, number> = {};
    const exhausted: string[] = [];
    const lines: string[] = [];
    const tickCount = tickCountOf(result.events);
    setLog([]);
    setPlayback({ tick: 0, tickCount, positions, shields, deckDamage, exhausted, hit: [], log: lines });
    for (const frame of buildPlaybackFrames(result.events)) {
      Object.assign(positions, frame.moves);
      for (const [heroId, amount] of Object.entries(frame.shields)) shields[heroId] = (shields[heroId] ?? 0) + amount;
      for (const { targetId, damage, absorbed } of frame.hits) {
        shields[targetId] = Math.max(0, (shields[targetId] ?? 0) - absorbed);
        deckDamage[targetId] = (deckDamage[targetId] ?? 0) + damage;
      }
      exhausted.push(...frame.exhausted);
      lines.push(...frame.events.flatMap((event) => describeEvent(event, nameOf) ?? []));
      setPlayback({
        tick: frame.tick,
        tickCount,
        positions: { ...positions },
        shields: { ...shields },
        deckDamage: { ...deckDamage },
        exhausted: [...exhausted],
        hit: frame.hits.map((hit) => hit.targetId),
        log: [...lines],
      });
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      if (unmounted.current) return;
    }
    setLog(lines);
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
        enemies={boardEnemies}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && changeSelection(id)}
        targetableIds={targetableIds}
        onTargetTap={tapTarget}
        hitIds={playback?.hit ?? []}
        highlights={highlights}
        markers={markers}
        onTileTap={tapTile}
      />
      <header className="hud top-bar">
        <span data-testid="round">
          Round {view.round} / {ROUND_LIMIT}
        </span>
        <span data-testid="prime-progress" aria-label="Prime Zone control">
          Prime Zone · You {view.primeProgress[view.squad]} / {PRIME_ZONE_WIN_RESOLUTIONS} · Enemy{" "}
          {view.primeProgress[view.squad === SquadId.Left ? SquadId.Right : SquadId.Left]} / {PRIME_ZONE_WIN_RESOLUTIONS}
        </span>
        {playing && (
          <span data-testid="tick" className="tick">
            Tick {Math.max(playback.tick, 1)} / {Math.max(playback.tickCount, 1)}
          </span>
        )}
      </header>
      <SquadPanel heroes={view.heroes} selectedId={selected.id} playback={playback} onSelect={changeSelection} />
      <EnemyPanel
        enemies={view.enemies}
        playback={playback}
        attackerPosition={aiming !== undefined && !aimsAtAlly && !playing ? planningFrom : undefined}
        aimedCard={aimedCard}
      />
      {(playback?.log ?? log).length > 0 && (
        <ol className="hud log" aria-label="Resolution log" data-testid="log">
          {(playback?.log ?? log).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
      {aiming !== undefined && !playing && (
        <div className="hud target-hint">
          {aimedCard?.target === CardTarget.SelfHero
            ? "Tap this Hero to confirm"
            : aimedCard?.target === CardTarget.EnemiesInRange
              ? "Tap this Hero to hit every enemy Hero in Range"
              : aimedCard?.target === CardTarget.GhostEnemy
                ? "Tap a Ghost to shoot its last known position; it hits only if an enemy stands there"
                : aimsAtAlly
                  ? "Tap an allied Hero"
                  : "Tap an enemy Hero to attack"}
        </div>
      )}
      <div className="hud energy" data-testid="energy" aria-label="Energy">
        Energy · Pitched {energy.pitched} · Spent {energy.spent} · Available {energy.available}
      </div>
      {choosing !== undefined && !playing && (
        <UseChooser
          reasons={cardUseReasons(selected.heroClass, choosing, queue, pitched, overdrive)}
          onChoose={chooseUse}
          hasOverdrive={HERO_DECKS[selected.heroClass][choosing]!.overdrive !== undefined}
          overdrive={overdrive}
          onToggleOverdrive={() => setOverdrive(!overdrive)}
        />
      )}
      <Hand
        hero={selected}
        queue={queue}
        pitched={pitched}
        armed={armed ?? aiming}
        armedLabel={aiming !== undefined ? "Pick a target" : "Pick a tile"}
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
