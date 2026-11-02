import {
  ActionKind,
  type CardIndex,
  type CardDefinition,
  CardTarget,
  cardInMode,
  CardType,
  CoverKind,
  coverAt,
  destroyCover,
  EffectKind,
  EffectRecipient,
  type EnemyView,
  type Grid,
  HERO_DECKS,
  HeroClass,
  moveDestinations,
  type GridPosition,
  type HeroView,
  type QueuedAction,
  REACTOR_DECK,
  PLANNING_TIMER_SECONDS,
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
import { CARD_USE_LABELS, CardUse, cardUseReasons, coverProtectionLabel, describeEffects, energyReadout, rangeDamageLabel, selectHero } from "./planning-selection";

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
            {hero.marked && <span className="tag marked-tag">Marked</span>}
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
  knownGrid,
}: {
  /** The Reactor Deck as the Squad knows it: Cover it has seen destroyed is gone. */
  knownGrid: Grid;
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
        const cover = attackerPosition && coverProtectionLabel(attackerPosition, enemy.position, knownGrid);
        const damage = attackerPosition && aimedCard && rangeDamageLabel(aimedCard, attackerPosition, enemy.position);
        return (
          <div key={enemy.id} className="hero-row" data-testid={`enemy-${enemy.heroClass}`}>
            <span className="hero-name">{HERO_NAMES[enemy.heroClass]}</span>
            {damage && <span className="tag range-tag">{damage}</span>}
            {attackerPosition && !enemy.exhausted && cover && <span className="tag cover-tag">{cover}</span>}
            {enemy.slowed && <span className="tag slow-tag">Slowed</span>}
            {enemy.marked && <span className="tag marked-tag">Marked</span>}
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

interface CardDetailSheetProps {
  card: CardDefinition;
  reasons: Record<CardUse, string | undefined>;
  onChoose: (use: CardUse) => void;
  /** Only for cards that have an Overdrive: the switch applies to the Primary effect. */
  overdrive: boolean;
  onToggleOverdrive: () => void;
  onClose: () => void;
}

/** The card detail sheet over Planning (UI spec, screen 5): the four uses, Overdrive where the card has one. */
function CardDetailSheet({ card, reasons, onChoose, overdrive, onToggleOverdrive, onClose }: CardDetailSheetProps) {
  const overdriveText = describeEffects(card.overdrive);
  const useText: Record<CardUse, string | undefined> = {
    [CardUse.Primary]: describeEffects(overdrive ? card.overdrive : card.effects),
    [CardUse.Pitch]: "Adds 1 Energy",
    [CardUse.Move]: "Move up to 2 tiles",
    [CardUse.Block]: "Shield 2",
  };
  return (
    <section className="hud card-sheet" role="dialog" aria-label={`${card.name} details`}>
      <header className="sheet-header">
        <span className="card-name">{card.name}</span>
        <span className="card-cost">Cost {card.energyCost}</span>
        <button type="button" className="sheet-close" aria-label="Close card details" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sheet-uses" role="group" aria-label="Use card as">
        {Object.values(CardUse).map((use) => (
          <button key={use} type="button" className="use" disabled={reasons[use] !== undefined} onClick={() => onChoose(use)}>
            <span>{CARD_USE_LABELS[use]}</span>
            {useText[use] && <span className="use-text">{useText[use]}</span>}
            {reasons[use] && <span className="use-reason">{reasons[use]}</span>}
          </button>
        ))}
      </div>
      {overdriveText && (
        <button type="button" className="use overdrive-switch" aria-pressed={overdrive} onClick={onToggleOverdrive}>
          <span>Overdrive {overdrive ? "on" : "off"}: {overdriveText}</span>
          <span className="use-reason">{overdrive ? "replaces the effect; the card is Exiled" : "tap to Exile this card for a stronger effect"}</span>
        </button>
      )}
    </section>
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
  /** Forward Deploy: the ally already picked, while the player still has to pick its tile. */
  const [deployAlly, setDeployAlly] = useState<string>();
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
  const knownGrid = useMemo(() => view.destroyedCover.reduce(destroyCover, REACTOR_DECK), [view.destroyedCover]);
  const aimedCard = aiming === undefined ? undefined : cardInMode(HERO_DECKS[selected.heroClass][aiming]!, overdrive);
  // Tile cards (Breach Charge), area cards (Scout Drone) and Deploy Cover are confirmed by tapping a tile.
  const aimsAtTile =
    aimedCard?.target === CardTarget.Tile ||
    aimedCard?.target === CardTarget.Area ||
    aimedCard?.target === CardTarget.EmptyTile;
  // Forward Deploy first picks the ally, then the tile it moves towards.
  const deployAllyHero = view.heroes.find((hero) => hero.id === deployAlly);
  const aimsAtDeployTile =
    aimedCard?.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove) === true && deployAllyHero !== undefined;
  // Aegis Protocol's Overdrive first picks one ally, then a second one.
  const needsSecondAlly = aimedCard?.effects.some(({ recipient }) => recipient === EffectRecipient.SecondTarget) === true;
  const highlights = useMemo(() => {
    if (playing) return [];
    if (armed !== undefined) return moveDestinations(planningFrom);
    if (aimsAtDeployTile) return moveDestinations(deployAllyHero.position);
    if (!aimsAtTile) return [];
    // Any tile within the Range can be aimed at; Line of Sight is checked in the Resolution. Deploy Cover needs an
    // empty tile, so Cover and Heroes known to the Squad are left out.
    const reachable = moveDestinations(planningFrom, REACTOR_DECK, aimedCard?.range ?? Math.max(REACTOR_DECK.width, REACTOR_DECK.height));
    if (aimedCard?.target !== CardTarget.EmptyTile) return reachable;
    const occupied = [...view.heroes, ...view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible)].map((unit) => unit.position);
    return reachable.filter(
      (tile) =>
        coverAt(knownGrid, tile) === CoverKind.None &&
        !view.placedCover.some((cover) => cover.col === tile.col && cover.row === tile.row) &&
        !occupied.some((position) => position.col === tile.col && position.row === tile.row),
    );
  }, [armed, aimsAtTile, aimsAtDeployTile, deployAllyHero, aimedCard, playing, planningFrom, knownGrid, view.heroes, view.enemies, view.placedCover]);
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
  const aimsAtAlly =
    aimedCard?.type === CardType.Utility &&
    (aimedCard.target === CardTarget.AllyHero || aimedCard.target === CardTarget.AllyHeroTile);
  const targetableIds = useMemo(() => {
    if (aiming === undefined || playing) return [];
    if (aimedCard?.target === CardTarget.SelfHero || aimedCard?.target === CardTarget.EnemiesInRange) return [selected.id];
    // Ghost Shot aims at the last known position of a Ghost.
    if (aimedCard?.target === CardTarget.GhostEnemy) {
      return view.enemies.filter((enemy) => enemy.visibility === Visibility.Ghost).map((enemy) => enemy.id);
    }
    if (aimsAtAlly) {
      return view.heroes.filter((hero) => hero.id !== selected.id && !(needsSecondAlly && hero.id === deployAlly) && !hero.exhausted).map((hero) => hero.id);
    }
    return view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible && !enemy.exhausted).map((enemy) => enemy.id);
  }, [aiming, aimedCard, aimsAtAlly, needsSecondAlly, playing, selected.id, deployAlly, view.heroes, view.enemies]);
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
    if (use === CardUse.Primary) {
      setAiming(choosing);
      setDeployAlly(undefined);
    }
    else setOverdrive(false);
    setChoosing(undefined);
  }

  function tapTarget(targetId: string) {
    if (aiming === undefined || playing || !targetableIds.includes(targetId)) return;
    if (aimedCard?.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove)) {
      setDeployAlly(targetId);
      return;
    }
    if (needsSecondAlly) {
      if (deployAlly === undefined) {
        setDeployAlly(targetId);
        return;
      }
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly, secondTarget: targetId, overdrive: true }]);
      setAiming(undefined);
      setDeployAlly(undefined);
      setOverdrive(false);
      return;
    }
    setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: targetId, ...(overdrive ? { overdrive } : {}) }]);
    setAiming(undefined);
    setOverdrive(false);
  }

  function tapTile(destination: GridPosition) {
    if (aiming !== undefined && aimsAtDeployTile) {
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly!, tile: destination }]);
      setAiming(undefined);
      setDeployAlly(undefined);
      return;
    }
    if (aiming !== undefined && aimsAtTile) {
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: selected.id, tile: destination, ...(overdrive ? { overdrive } : {}) }]);
      setAiming(undefined);
      setOverdrive(false);
      return;
    }
    if (armed === undefined) return;
    setQueue([...queue, { kind: ActionKind.Move, card: armed, destination }]);
    setArmed(undefined);
  }

  // Planning ends early on Commit, or when the timer runs out; a timeout leaves the player's Queues empty.
  const [secondsLeft, setSecondsLeft] = useState(PLANNING_TIMER_SECONDS);
  const commitRef = useRef<((toSubmit: SquadPlan) => Promise<void>) | undefined>(undefined);
  commitRef.current = commit;
  useEffect(() => {
    setSecondsLeft(PLANNING_TIMER_SECONDS);
    const deadline = Date.now() + PLANNING_TIMER_SECONDS * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(interval);
        const emptyPlan: SquadPlan = {
          squad: view.squad,
          heroes: view.heroes.filter((hero) => hero.heroClass === PLAYER_HERO_CLASS).map((hero) => ({ heroId: hero.id, queue: [], pitched: [] })),
        };
        void commitRef.current?.(emptyPlan);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [view]);

  async function commit(toSubmit: SquadPlan) {
    if (playback !== undefined) return;
    const result = await submitPlan(toSubmit);
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
        destroyedCover={view.destroyedCover}
        placedCover={view.placedCover}
        revealedAreas={view.revealedAreas}
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
        {!playing && (
          <span data-testid="timer" aria-label="Planning time left">
            {secondsLeft}s
          </span>
        )}
        {playing && (
          <span data-testid="tick" className="tick">
            Tick {Math.max(playback.tick, 1)} / {Math.max(playback.tickCount, 1)}
          </span>
        )}
      </header>
      <SquadPanel heroes={view.heroes} selectedId={selected.id} playback={playback} onSelect={changeSelection} />
      <EnemyPanel
        knownGrid={knownGrid}
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
          {aimedCard?.target === CardTarget.Area
            ? "Tap a highlighted tile: the area around it is revealed"
            : aimedCard?.target === CardTarget.EmptyTile
              ? "Tap a highlighted empty tile to place Half Cover"
              : aimsAtTile
            ? "Tap a highlighted tile: it hurts the enemy Hero there and destroys Half Cover"
            : needsSecondAlly
              ? deployAlly === undefined ? "Tap the first allied Hero" : "Tap the second allied Hero"
            : aimedCard?.target === CardTarget.SelfHero
            ? "Tap this Hero to confirm"
            : aimedCard?.target === CardTarget.EnemiesInRange
              ? "Tap this Hero to hit every enemy Hero in Range"
              : aimedCard?.target === CardTarget.GhostEnemy
                ? "Tap a Ghost to shoot its last known position; it hits only if an enemy stands there"
                : aimsAtDeployTile
                  ? "Tap the tile the ally moves towards"
                  : aimsAtAlly
                  ? "Tap an allied Hero"
                  : "Tap an enemy Hero to attack"}
        </div>
      )}
      <div className="hud energy" data-testid="energy" aria-label="Energy">
        Energy · Pitched {energy.pitched} · Spent {energy.spent} · Available {energy.available}
      </div>
      {choosing !== undefined && !playing && (
        <CardDetailSheet
          card={HERO_DECKS[selected.heroClass][choosing]!}
          reasons={cardUseReasons(selected.heroClass, choosing, queue, pitched, overdrive)}
          onChoose={chooseUse}
          overdrive={overdrive}
          onToggleOverdrive={() => setOverdrive(!overdrive)}
          onClose={() => {
            setChoosing(undefined);
            setOverdrive(false);
          }}
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
        <button type="button" className="commit" disabled={issues.length > 0 || playing} onClick={() => void commit(plan)}>
          Commit
        </button>
      </section>
    </div>
  );
}
