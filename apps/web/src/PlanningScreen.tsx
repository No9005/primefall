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
  MAX_QUEUE_LENGTH,
  withWreck,
  moveDestinations,
  reachableMoveDestinations,
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
import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { collisionWarnings, type PlannedPath, plannedPaths } from "./ally-paths";
import { Board } from "./Board";
import { CardFace, EnergyPill, PulledCard } from "./game-parts";
import { cancel as cancelPull, type Face, faceViews, heldCard, IDLE, move as movePull, openCard, press as pressCard, type PullState, release as releasePull, showsFaces, tap as tapPull } from "./card-pull";
import { CardUseStage, hudFocus } from "./hud-focus";
import { drawShots, type ShotDrawing } from "./shot-lines";
import { heroMarks } from "./shield-marks";
import { plannedTargetLines, replayTargetLines, type TargetLine } from "./target-lines";
import { cardAtX, FAN_WIDTH, fanSpacing } from "./hand-fan";
import { drawSchedule, newCards, shownDeckCount } from "./hand-draw";
import type { BoardPick, Point } from "./card-drag";
import { buildPlaybackFrames, describeEvent, enemyTokens, tickCountOf } from "./playback";
import { actionUsesCard, addWaitAction, blockAction,CARD_USE_LABELS, CardUse, cardUseReasons, coverProtectionLabel, describeEffects, energyReadout, moveAction, primaryAction, queueSlotCode, rangeDamageLabel, removeQueueAction, selectHero, targetHint } from "./planning-selection";

/** The Hero the player plans for; the other two are AI planned (offline prototype spec). */
export const PLAYER_HERO_CLASS = HeroClass.Bruiser;

const NO_TILES: readonly GridPosition[] = [];
const NO_SHOTS: readonly ShotDrawing[] = [];
const NO_PATHS: readonly PlannedPath[] = [];
const NO_LABELS: readonly { position: GridPosition; text: string }[] = [];

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
  /** The target lines of the actions resolved in the frame being shown. */
  lines: TargetLine[];
}

/** Top left: the Queue window of the selected Hero, with the other Heroes of the Squad as compact chips below it. */
function SquadPanel({
  heroes,
  selected,
  queue,
  playback,
  disabled,
  onSelect,
  onRemove,
  onWait,
  warningsOf,
  collapsed,
}: {
  /** A target is being picked: only the Queue slots and thin name pills stay, so the board is free. */
  collapsed: boolean;
  /** The collision warnings of a Hero's planned Moves, e.g. "Collides with Controller at Tick 2". */
  warningsOf: (heroId: string) => string[];
  heroes: readonly HeroView[];
  selected: HeroView;
  queue: readonly QueuedAction[];
  playback: PlaybackState | undefined;
  disabled: boolean;
  onSelect: (id: string) => void;
  onRemove: (index: number) => void;
  onWait: () => void;
}) {
  const shield = playback?.shields[selected.id] ?? 0;
  return (
    <aside className={`squad-panel${collapsed ? " collapsed" : ""}`} aria-label="Squad">
      <div className="queue-column">
      <section className="hud queue-window" aria-label="Queue">
        <div className="queue-head">
          <span className="hero-name">{HERO_NAMES[selected.heroClass]}</span>
          {shield > 0 && <span className="counts">Shield {shield}</span>}
        </div>
        <ol className="queue-slots">
          {Array.from({ length: MAX_QUEUE_LENGTH }, (_, i) => {
            const action = queue[i];
            return (
              <li key={i}>
                {action ? (
                  <button
                    type="button"
                    className="queue-slot filled"
                    disabled={disabled}
                    aria-label={`Remove action ${i + 1}`}
                    onClick={() => onRemove(i)}
                  >
                    {action.kind === ActionKind.Wait && <span aria-hidden="true">⌛ </span>}
                    {queueSlotCode(selected.heroClass, action)}
                    {action.kind === ActionKind.Primary && action.overdrive && <span className="od-marker">OD</span>}
                  </button>
                ) : (
                  <span className="queue-slot empty">{i + 1}</span>
                )}
              </li>
            );
          })}
        </ol>
        <button type="button" className="wait-button" disabled={disabled || queue.length >= MAX_QUEUE_LENGTH} onClick={onWait}>
          ⌛ Wait
        </button>
        <div className="queue-tags">
          {warningsOf(selected.id).map((text) => (
            <span key={text} className="tag collision-tag" role="alert">
              ⚠ {text}
            </span>
          ))}
          {selected.slowed && <span className="tag slow-tag">Slowed</span>}
          {selected.marked && <span className="tag marked-tag">Marked</span>}
          {selected.hidden && <span className="tag hidden-tag">Hidden · sight +2</span>}
          {(selected.exhausted || playback?.exhausted.includes(selected.id)) && <span className="tag">Exhausted</span>}
        </div>
      </section>
      </div>
      <div className="chips">
        {heroes
          .filter((hero) => hero.id !== selected.id)
          .map((hero) => {
            const playerControlled = hero.heroClass === PLAYER_HERO_CLASS;
            const exhausted = hero.exhausted || playback?.exhausted.includes(hero.id);
            return (
              <button
                key={hero.id}
                type="button"
                className="hud chip"
                disabled={!playerControlled || hero.exhausted}
                onClick={() => onSelect(hero.id)}
              >
                <span className="hero-name">{HERO_NAMES[hero.heroClass]}</span>
                <span className="counts">
                  {playerControlled ? "" : "AI"}
                  {exhausted && `${playerControlled ? "" : " · "}Exhausted`}
                </span>
                {warningsOf(hero.id).length > 0 && (
                  <span className="collision-tag" title={warningsOf(hero.id).join(" ")}>
                    ⚠ {warningsOf(hero.id).join(" ")}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </aside>
  );
}

function EnemyPanel({
  enemies,
  playback,
  attackerPosition,
  aimedCard,
  knownGrid,
  collapsed,
}: {
  /** A target is being picked: thin pills with the names (and the tags that help aiming). */
  collapsed: boolean;
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
    <aside className={`hud enemy-panel${collapsed ? " collapsed" : ""}`} aria-label="Enemy Squad">
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

/** The piles of the selected Hero: the Deck as a stack with its count on top, Discard and Exile as a tiny grey row. */
function PilePanel({ deck, discard, exile, opacity }: { deck: number; discard: number; exile: number; opacity: number }) {
  return (
    <div className="piles" style={{ opacity }}>
      <div className="pile-minor">
        <span data-testid="discard-count">Discard {discard}</span>
        <span data-testid="exile-count">Exile {exile}</span>
      </div>
      <div className="deck-pile" data-testid="deck-pile" aria-label={`Deck: ${deck} cards`}>
        <span className="deck-count">{deck}</span>
      </div>
    </div>
  );
}

interface HandProps {
  hero: HeroView;
  queue: readonly QueuedAction[];
  pitched: readonly CardIndex[];
  /** The card waiting for a tile (Move 2) or a target (Primary effect). */
  armed: CardIndex | undefined;
  armedLabel: string;
  /** The card pressed or pulled out: it is lifted out of the fan (shown big in the middle of the board). */
  held: CardIndex | undefined;
  /** The card whose use is in progress keeps full opacity; the others get `otherOpacity`. */
  inUse: CardIndex | undefined;
  otherOpacity: number;
  disabled: boolean;
  onCardClick: (card: CardIndex, event: ReactMouseEvent) => void;
  onCardPointerDown: (card: CardIndex, event: ReactPointerEvent) => void;
  /** A target is being picked: the fan slides away (the selected card is shown as a chip beside it). */
  collapsed: boolean;
  /** Cards still flying in from the Deck pile (the draw animation): they start face down at the pile. */
  arriving: readonly CardIndex[];
}

/** Where the centre of the Deck pile lies relative to the left edge of the fan and to the centre of a card (CSS pixels). */
const PILE_CENTRE_X = -39;
const PILE_TO_CARD_Y = 22;

/** The selected card while its target is picked: name, cost and a button that cancels the use. */
function SelectedCardChip({ card, hint, onCancel }: { card: CardDefinition; hint: string; onCancel: () => void }) {
  return (
    <div className="selected-card-chip" aria-label={`${card.name} selected`}>
      <span className="chip-name">{card.name}</span>
      <span className="chip-cost">Cost {card.energyCost}</span>
      <span className="chip-hint">{hint}</span>
      <button type="button" className="chip-cancel" aria-label={`Cancel ${card.name}`} onClick={onCancel}>
        ×
      </button>
    </div>
  );
}

const ACTION_USE_LABELS: Record<Exclude<ActionKind, ActionKind.Wait>, string> = {
  [ActionKind.Move]: CARD_USE_LABELS[CardUse.Move],
  [ActionKind.Block]: CARD_USE_LABELS[CardUse.Block],
  [ActionKind.Primary]: CARD_USE_LABELS[CardUse.Primary],
};

function Hand({ hero, queue, pitched, armed, armedLabel, held, inUse, otherOpacity, disabled, onCardClick, onCardPointerDown, collapsed, arriving }: HandProps) {
  const deck = HERO_DECKS[hero.heroClass];
  const middle = (hero.hand.length - 1) / 2;
  const spacing = fanSpacing(FAN_WIDTH, hero.hand.length);
  // The card under the finger is the one whose strip it is on, however the rotated card boxes overlap.
  const pressedCard = (event: ReactPointerEvent<HTMLElement>, fallback: CardIndex): CardIndex => {
    const fan = event.currentTarget.closest("ul");
    if (!fan) return fallback;
    const position = cardAtX(spacing, hero.hand.length, event.clientX - fan.getBoundingClientRect().left);
    return hero.hand[position] ?? fallback;
  };
  return (
    <ul
      className={`hand${collapsed ? " collapsed" : ""}${arriving.length > 0 ? " drawing" : ""}`}
      aria-label="Hand"
      style={{ "--card-w": `${spacing.cardWidth}px`, "--step": `${spacing.step}px`, width: spacing.width } as CSSProperties}
    >
      {hero.hand.map((cardIndex, position) => {
        const card = deck[cardIndex]!;
        const offset = position - middle;
        const queuedAt = queue.findIndex((action) => actionUsesCard(action, cardIndex));
        const isPitched = pitched.includes(cardIndex);
        let use = "";
        const queued = queue[queuedAt];
        if (queued && queued.kind !== ActionKind.Wait) {
          const overdriven = queued.kind === ActionKind.Primary && queued.overdrive;
          use = `${overdriven ? "Overdrive" : ACTION_USE_LABELS[queued.kind]} · #${queuedAt + 1}`;
        } else if (isPitched) use = CARD_USE_LABELS[CardUse.Pitch];
        else if (cardIndex === armed) use = armedLabel;
        const arrivalOrder = arriving.indexOf(cardIndex);
        const arrival =
          arrivalOrder < 0
            ? ({} as CSSProperties)
            : ({
                "--from-x": `${PILE_CENTRE_X - (position * spacing.step + spacing.cardWidth / 2)}px`,
                "--from-y": `${PILE_TO_CARD_Y}px`,
                "--draw-delay": `${drawSchedule(arrivalOrder).start}ms`,
              } as CSSProperties);
        return (
          <li
            key={cardIndex}
            className={arrivalOrder >= 0 ? "arriving" : undefined}
            style={{ "--offset": offset, "--position": position, "--dim": inUse !== undefined && cardIndex !== inUse ? otherOpacity : 1, ...arrival } as CSSProperties}
          >
            <button
              type="button"
              className={`card ${card.type}${queued || isPitched ? " used" : ""}${cardIndex === held ? " lifted" : ""}`}
              aria-pressed={cardIndex === armed || cardIndex === held || queuedAt >= 0 || isPitched}
              disabled={disabled}
              onClick={(event) => onCardClick(cardIndex, event)}
              onPointerDown={(event) => onCardPointerDown(pressedCard(event, cardIndex), event)}
            >
              <CardFace card={card} use={use} />
              {arrivalOrder >= 0 && <span className="card-back" aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const NO_CARDS: readonly CardIndex[] = [];

interface DrawState {
  view: SquadView;
  heroId: string;
  /** The player's Hand in `view`, to find the new cards of the next Round. */
  hand: readonly CardIndex[];
  /** The cards that fly in, in Hand order. */
  cards: readonly CardIndex[];
  /** How many of them have left the Deck pile. */
  departed: number;
  done: boolean;
}

/** The draw of a Round: nothing flies with reduced motion, or when no card is new. */
function startDraw(view: SquadView, previousHand: readonly CardIndex[] | undefined): DrawState {
  const hero = view.heroes.find((candidate) => candidate.heroClass === PLAYER_HERO_CLASS)!;
  const cards = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? [] : newCards(previousHand, hero.hand);
  return { view, heroId: hero.id, hand: hero.hand, cards, departed: 0, done: cards.length === 0 };
}

interface PlanningScreenProps {
  view: SquadView;
  submitPlan: (plan: SquadPlan) => Promise<SubmitResult>;
  /** What the AI plans for the given allied Heroes this Round, to draw their paths. */
  getAllyPlan: (heroIds: readonly string[]) => Promise<SquadPlan>;
  /** Called with the view of the next Round once the playback has finished. */
  onResolved: (view: SquadView) => void;
}

export function PlanningScreen({ view, submitPlan, getAllyPlan, onResolved }: PlanningScreenProps) {
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
  /** The card in the Hand that is pressed or pulled out (card-pull.ts); the faces of its uses are shown. */
  const [pull, setPullState] = useState<PullState>(IDLE);
  /** The aimed card is used in its Overdrive mode (the Overdrive face was chosen). */
  const [overdriveAim, setOverdriveAim] = useState(false);
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

  // The draw animation: the cards new in the player's Hand fly in one after the other (hand-draw.ts). The state is
  // derived while rendering the first time a view is seen, so no card shows face up before it has flown.
  const [draw, setDraw] = useState(() => startDraw(view, undefined));
  if (draw.view !== view) setDraw(startDraw(view, draw.hand));
  const drawing = !draw.done && selected.id === draw.heroId;
  useEffect(() => {
    if (draw.done || draw.view !== view) return;
    const forThisView = (change: (state: DrawState) => DrawState) => (state: DrawState) => (state.view === view ? change(state) : state);
    const timers = draw.cards.map((_, order) =>
      setTimeout(() => setDraw(forThisView((state) => ({ ...state, departed: Math.max(state.departed, order + 1) }))), drawSchedule(order).start),
    );
    timers.push(setTimeout(() => setDraw(forThisView((state) => ({ ...state, done: true }))), drawSchedule(draw.cards.length - 1).landed));
    // A tap anywhere finishes the animation at once.
    const skip = () => setDraw(forThisView((state) => ({ ...state, departed: state.cards.length, done: true })));
    window.addEventListener("pointerdown", skip, true);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointerdown", skip, true);
    };
  }, [draw.view, draw.done, view]);

  // The AI allies plan from the same view, so their plan is known before Commit and does not change with ours.
  const [allyPlan, setAllyPlan] = useState<SquadPlan>();
  const getAllyPlanRef = useRef(getAllyPlan);
  getAllyPlanRef.current = getAllyPlan;
  useEffect(() => {
    let cancelled = false;
    setAllyPlan(undefined);
    const allyIds = view.heroes.filter((hero) => hero.heroClass !== PLAYER_HERO_CLASS).map((hero) => hero.id);
    void getAllyPlanRef.current(allyIds).then((planned) => {
      if (!cancelled) setAllyPlan(planned);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);
  const playerHeroId = view.heroes.find((hero) => hero.heroClass === PLAYER_HERO_CLASS)!.id;
  const squadPlans = useMemo(
    () => [{ ...plan, heroes: plan.heroes.filter((planned) => planned.heroId === playerHeroId) }, ...(allyPlan ? [allyPlan] : [])],
    [plan, allyPlan, playerHeroId],
  );
  const paths = useMemo(() => (playing ? NO_PATHS : plannedPaths(view.heroes, squadPlans, playerHeroId)), [playing, view.heroes, squadPlans, playerHeroId]);
  const warnings = useMemo(
    () => collisionWarnings(view.heroes, squadPlans, Object.fromEntries(view.heroes.map((hero) => [hero.id, HERO_NAMES[hero.heroClass]]))),
    [view.heroes, squadPlans],
  );
  const collisionTiles = useMemo(() => (playing ? NO_TILES : warnings.collisions.map(({ destination }) => destination)), [playing, warnings]);
  const warningsOf = (heroId: string) =>
    warnings.collisions.filter((collision) => collision.heroId === heroId).flatMap(({ tick }) => warnings.textFor(heroId, tick) ?? []);
  const energy = energyReadout(selected.heroClass, queue, pitched);

  const lastMove = queue.filter((action) => action.kind === ActionKind.Move).at(-1);
  const planningFrom = lastMove?.kind === ActionKind.Move ? lastMove.destination : selected.position;
  const knownGrid = useMemo(
    () => view.wreckCover.reduce(withWreck, view.destroyedCover.reduce(destroyCover, REACTOR_DECK)),
    [view.destroyedCover, view.wreckCover],
  );
  // Who targets whom: the queued actions of the Squad while planning, the actions of the current Tick in the replay.
  const targetLines = useMemo(
    () =>
      playback
        ? playback.lines
        : plannedTargetLines(knownGrid, view.heroes, view.enemies, squadPlans).map((line) => ({ ...line, faint: line.heroId !== selected.id })),
    [playback, knownGrid, view.heroes, view.enemies, squadPlans, selected.id],
  );
  // Shield rubies, bubble and planned icons above the Heroes the Squad may see (own Heroes and Visible enemies).
  const marks = useMemo(() => {
    const held = (id: string, base: number) => base + (playback?.shields[id] ?? 0);
    const own = view.heroes.map((hero) => [
      hero.id,
      heroMarks({
        own: true,
        heroClass: hero.heroClass,
        // Shield lasts only for the Round (ADR 0002): an own Hero holds none outside the Resolution.
        shield: held(hero.id, 0),
        queue: squadPlans.flatMap((squadPlan) => squadPlan.heroes).find((planned) => planned.heroId === hero.id)?.queue,
        resolving: playback !== undefined,
      }),
    ]);
    const enemies = view.enemies.map((enemy) => [
      enemy.id,
      heroMarks({
        own: false,
        heroClass: enemy.heroClass,
        visibility: enemy.visibility,
        shield: enemy.visibility === Visibility.Visible ? held(enemy.id, enemy.shield) : 0,
        resolving: playback !== undefined,
      }),
    ]);
    return Object.fromEntries([...own, ...enemies]);
  }, [view.heroes, view.enemies, squadPlans, playback]);
  const aimedCard = aiming === undefined ? undefined : cardInMode(HERO_DECKS[selected.heroClass][aiming]!, overdriveAim);
  const aimedModes = aimedCard === undefined ? [] : [aimedCard];
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
  /** The tiles a card with a tile target (Breach Charge, Scout Drone, Deploy Cover) can be aimed at. */
  function tileTargetsOf(card: CardDefinition | undefined): GridPosition[] {
    if (card?.target !== CardTarget.Tile && card?.target !== CardTarget.Area && card?.target !== CardTarget.EmptyTile) return [];
    // Any tile within the Range can be aimed at; Line of Sight is checked in the Resolution. Deploy Cover needs an
    // empty tile, so Cover and Heroes known to the Squad are left out.
    const reachable = moveDestinations(planningFrom, REACTOR_DECK, card.range ?? Math.max(REACTOR_DECK.width, REACTOR_DECK.height));
    if (card.target !== CardTarget.EmptyTile) return reachable;
    const occupied = [...view.heroes, ...view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible)].map((unit) => unit.position);
    return reachable.filter(
      (tile) =>
        coverAt(knownGrid, tile) === CoverKind.None &&
        !view.placedCover.some((cover) => cover.col === tile.col && cover.row === tile.row) &&
        !occupied.some((position) => position.col === tile.col && position.row === tile.row),
    );
  }
  /** The Heroes a single-target card can be aimed at: Ghosts for a Ghost shot, otherwise Visible enemies that are not Exhausted. */
  function enemyTargetsOf(card: CardDefinition | undefined): string[] {
    if (card?.target === CardTarget.GhostEnemy) {
      return view.enemies.filter((enemy) => enemy.visibility === Visibility.Ghost).map((enemy) => enemy.id);
    }
    return view.enemies.filter((enemy) => enemy.visibility === Visibility.Visible && !enemy.exhausted).map((enemy) => enemy.id);
  }
  const highlights = useMemo(() => {
    if (playing) return [];
    if (armed !== undefined) return reachableMoveDestinations(planningFrom);
    if (aimsAtDeployTile) return moveDestinations(deployAllyHero.position);
    return aimedModes.flatMap(tileTargetsOf).filter((tile, i, all) => all.findIndex((other) => other.col === tile.col && other.row === tile.row) === i);
  }, [armed, aimsAtDeployTile, deployAllyHero, aimedCard, playing, planningFrom, knownGrid, view.heroes, view.enemies, view.placedCover]);
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
  const boardEnemies = useMemo(() => enemyTokens(view.enemies, onBoard), [view.enemies, playback]);
  const aimsAtAlly =
    aimedCard?.type === CardType.Utility &&
    (aimedCard.target === CardTarget.AllyHero || aimedCard.target === CardTarget.AllyHeroTile);
  /** The Heroes a card in one mode can be aimed at. */
  function heroTargetsOf(mode: CardDefinition): string[] {
    if (mode.target === CardTarget.SelfHero || mode.target === CardTarget.EnemiesInRange) return [selected.id];
    const modeAimsAtAlly = mode.type === CardType.Utility && (mode.target === CardTarget.AllyHero || mode.target === CardTarget.AllyHeroTile);
    if (modeAimsAtAlly) {
      return view.heroes.filter((hero) => hero.id !== selected.id && !(needsSecondAlly && hero.id === deployAlly) && !hero.exhausted).map((hero) => hero.id);
    }
    return enemyTargetsOf(mode);
  }
  const targetableIds = useMemo(() => {
    if (aiming === undefined || playing) return [];
    return [...new Set(aimedModes.flatMap(heroTargetsOf))];
  }, [aiming, aimedModes, needsSecondAlly, playing, selected.id, deployAlly, view.heroes, view.enemies]);
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
    setPullState(IDLE);
    setOverdriveAim(false);
  }

  const planningRef = useRef<HTMLDivElement>(null);
  // The card whose use is in progress: pressed or pulled out, or selected for a tile or target.
  const heldInHand = playing ? undefined : heldCard(pull);
  const cardInUse = playing ? undefined : (heldInHand ?? armed ?? aiming);
  let stage = CardUseStage.Idle;
  if (cardInUse !== undefined) stage = showsFaces(pull) ? CardUseStage.UseChosen : CardUseStage.Selected;
  const focus = hudFocus({ energy: energy.available, stage });
  const pickBoard = useRef<((point: Point) => BoardPick) | undefined>(undefined);

  const picking = (armed !== undefined || aiming !== undefined) && !playing;
  const heroScreenRef = useRef<((heroId: string) => Point | undefined) | undefined>(undefined);
  /** The hero whose surroundings the camera frames while a tile is picked. */
  const frameHero = !picking ? undefined : armed !== undefined ? planningFrom : aimsAtDeployTile ? deployAllyHero.position : aimsAtTile ? planningFrom : undefined;

  // The line of fire to every enemy the aimed Attack card can be aimed at.
  const shotLines = useMemo(
    () =>
      aimedCard?.type === CardType.Attack && aimedCard.range !== undefined && !playing
        ? drawShots(knownGrid, planningFrom, aimedCard.range, view.enemies, targetableIds)
        : NO_SHOTS,
    [aimedCard, playing, knownGrid, planningFrom, view.enemies, targetableIds],
  );

  // The state of the pull is kept in a ref as well, because the window listeners of a gesture read it between renders.
  const pullRef = useRef<PullState>(IDLE);
  function setPull(next: PullState) {
    pullRef.current = next;
    setPullState(next);
  }
  const gesture = useRef<{ pointerId: number } | undefined>(undefined);
  /** The enabled face under a point, if any. */
  function faceAt(point: Point): Face | undefined {
    const element = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-face]");
    return element && element.getAttribute("aria-disabled") !== "true" ? (element.dataset.face as Face) : undefined;
  }
  const pulledCard = heldInHand === undefined ? undefined : HERO_DECKS[selected.heroClass][heldInHand]!;
  const pulledFaces =
    heldInHand === undefined || pulledCard === undefined
      ? []
      : faceViews(
          pulledCard,
          cardUseReasons(selected.heroClass, heldInHand, queue, pitched),
          cardUseReasons(selected.heroClass, heldInHand, queue, pitched, true)[CardUse.Primary],
          { primary: describeEffects(pulledCard.effects) ?? "", overdrive: describeEffects(pulledCard.overdrive) },
        );

  /** Puts a chosen use of a card on its way: straight into the Queue when it needs no target, otherwise to the picking. */
  function useCard(card: CardIndex, face: Face) {
    setArmed(undefined);
    setAiming(undefined);
    setDeployAlly(undefined);
    setOverdriveAim(false);
    if (face === CardUse.Pitch) setPitched([...pitched, card]);
    else if (face === CardUse.Block) setQueue([...queue, blockAction(card)]);
    else if (face === CardUse.Move) setArmed(card);
    else {
      const overdrive = face === "overdrive";
      const { target } = cardInMode(HERO_DECKS[selected.heroClass][card]!, overdrive);
      if (target === CardTarget.SelfHero || target === CardTarget.EnemiesInRange) setQueue([...queue, primaryAction(card, selected.id, { overdrive })]);
      else {
        setAiming(card);
        setOverdriveAim(overdrive);
      }
    }
  }
  function applyPull({ state, chosen }: { state: PullState; chosen?: { card: CardIndex; face: Face } }) {
    setPull(state);
    if (chosen) useCard(chosen.card, chosen.face);
  }
  // The window listeners must be the same functions when added and removed, so they call the latest handlers.
  const dragHandlers = useRef<{ move: (event: PointerEvent) => void; end: (event: PointerEvent) => void }>({ move: () => {}, end: () => {} });
  const [{ onDragMove, onDragEnd }] = useState(() => ({
    onDragMove: (event: PointerEvent) => dragHandlers.current.move(event),
    onDragEnd: (event: PointerEvent) => dragHandlers.current.end(event),
  }));
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
    },
    [onDragMove, onDragEnd],
  );
  dragHandlers.current.move = (event) => {
    if (event.pointerId !== gesture.current?.pointerId) return;
    const handTop = document.querySelector(".hand")?.getBoundingClientRect().top ?? Infinity;
    setPull(movePull(pullRef.current, { x: event.clientX, y: event.clientY }, handTop));
  };
  dragHandlers.current.end = (event) => {
    if (event.pointerId !== gesture.current?.pointerId) return;
    gesture.current = undefined;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    if (event.type === "pointercancel") setPull(cancelPull());
    else applyPull(releasePull(pullRef.current, faceAt({ x: event.clientX, y: event.clientY })));
  };
  function startCardPress(card: CardIndex, event: ReactPointerEvent) {
    if (playing || gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (queue.some((action) => actionUsesCard(action, card)) || pitched.includes(card)) return;
    gesture.current = { pointerId: event.pointerId };
    setPull(pressCard(card, { x: event.clientX, y: event.clientY }));
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  // Tapping a used card frees it again. A free card is opened by pressing it; a click without a pointer (keyboard) opens it too.
  function clickCard(card: CardIndex, event: ReactMouseEvent) {
    setArmed(undefined);
    setAiming(undefined);
    setOverdriveAim(false);
    if (queue.some((action) => actionUsesCard(action, card)) || pitched.includes(card)) {
      setQueue(queue.filter((action) => !actionUsesCard(action, card)));
      setPitched(pitched.filter((pitchedCard) => pitchedCard !== card));
      setPull(IDLE);
    } else if (event.detail === 0) setPull(openCard(card));
  }

  function cancelUse() {
    setArmed(undefined);
    setAiming(undefined);
    setDeployAlly(undefined);
    setOverdriveAim(false);
  }

  function tapTarget(targetId: string) {
    if (aiming === undefined || playing || !targetableIds.includes(targetId)) return;
    if (aimedCard?.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove)) {
      setDeployAlly(targetId);
      return;
    }
    // Aegis Protocol's Overdrive picks one ally, then a second one.
    if (needsSecondAlly && deployAlly === undefined) {
      setDeployAlly(targetId);
      return;
    }
    if (needsSecondAlly) setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly!, secondTarget: targetId, overdrive: true }]);
    else setQueue([...queue, primaryAction(aiming, targetId, { overdrive: overdriveAim })]);
    setAiming(undefined);
    setDeployAlly(undefined);
    setOverdriveAim(false);
  }

  function tapTile(destination: GridPosition) {
    if (aiming !== undefined && aimsAtDeployTile) {
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly!, tile: destination, ...(overdriveAim ? { overdrive: true } : {}) }]);
      setAiming(undefined);
      setDeployAlly(undefined);
      setOverdriveAim(false);
      return;
    }
    if (aiming !== undefined && aimsAtTile) {
      setQueue([...queue, primaryAction(aiming, selected.id, { tile: destination, overdrive: overdriveAim })]);
      setAiming(undefined);
      setOverdriveAim(false);
      return;
    }
    if (armed === undefined) return;
    setQueue([...queue, moveAction(armed, destination)]);
    setArmed(undefined);
  }

  // Planning ends early on Commit, or when the timer runs out; a timeout leaves the player's Queues empty.
  const [secondsLeft, setSecondsLeft] = useState(PLANNING_TIMER_SECONDS);
  const commitRef = useRef<((toSubmit: SquadPlan) => Promise<void>) | undefined>(undefined);
  commitRef.current = commit;
  const committingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    committingRef.current = false;
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
    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [view]);

  async function commit(toSubmit: SquadPlan) {
    // Set synchronously so a timeout during a manual Commit's submitPlan cannot submit a second plan.
    if (playback !== undefined || committingRef.current) return;
    committingRef.current = true;
    clearInterval(timerRef.current);
    let result;
    try {
      result = await submitPlan(toSubmit);
    } catch (error) {
      committingRef.current = false;
      throw error;
    }
    const positions: Record<string, GridPosition> = {};
    const startPositions: Record<string, GridPosition> = Object.fromEntries(
      [...view.heroes, ...view.enemies].flatMap((unit) => ("position" in unit ? [[unit.id, unit.position]] : [])),
    );
    const shields: Record<string, number> = {};
    const deckDamage: Record<string, number> = {};
    const exhausted: string[] = [];
    const lines: string[] = [];
    const tickCount = tickCountOf(result.events);
    setLog([]);
    setPlayback({ tick: 0, tickCount, positions, shields, deckDamage, exhausted, hit: [], log: lines, lines: [] });
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
        lines: replayTargetLines(frame.events, view.heroes, view.enemies, (heroId) => positions[heroId] ?? startPositions[heroId]),
      });
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      if (unmounted.current) return;
    }
    setLog(lines);
    setPlayback(undefined);
    setQueue([]);
    setPitched([]);
    setArmed(undefined);
    setPull(IDLE);
    onResolved(result.view);
  }

  return (
    <div className="planning" ref={planningRef}>
      <Board
        destroyedCover={view.destroyedCover}
        placedCover={view.placedCover}
        wreckCover={view.wreckCover}
        revealedAreas={view.revealedAreas}
        visibleTiles={view.visibleTiles}
        heroes={boardHeroes}
        enemies={boardEnemies}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && changeSelection(id)}
        targetableIds={targetableIds}
        onTargetTap={tapTarget}
        hitIds={playback?.hit ?? []}
        highlights={highlights}
        zoneLabels={NO_LABELS}
        areaTiles={NO_TILES}
        shotLines={shotLines}
        targetLines={targetLines}
        marks={marks}
        paths={paths}
        collisionTiles={collisionTiles}
        pickRef={pickBoard}
        markers={markers}
        onTileTap={tapTile}
        moveFrameHero={frameHero}
        heroScreenRef={heroScreenRef}
      />
      <header className="hud top-bar">
        <span data-testid="round">
          Round {view.round}/{ROUND_LIMIT}
        </span>
        <span data-testid="prime-progress" aria-label="Prime Zone control">
          Zone · You {view.primeProgress[view.squad]}/{PRIME_ZONE_WIN_RESOLUTIONS} · Enemy{" "}
          {view.primeProgress[view.squad === SquadId.Left ? SquadId.Right : SquadId.Left]}/{PRIME_ZONE_WIN_RESOLUTIONS}
        </span>
        {!playing && (
          <span data-testid="timer" aria-label="Planning time left">
            {secondsLeft}s
          </span>
        )}
        {playing && (
          <span data-testid="tick" className="tick">
            Tick {Math.max(playback.tick, 1)}/{Math.max(playback.tickCount, 1)}
          </span>
        )}
      </header>
      <SquadPanel
        heroes={view.heroes}
        warningsOf={warningsOf}
        selected={selected}
        queue={queue}
        playback={playback}
        collapsed={picking}
        disabled={playing}
        onSelect={changeSelection}
        onWait={() => {
          setQueue(addWaitAction(queue));
          setArmed(undefined);
          setAiming(undefined);
          setPull(IDLE);
        }}
        onRemove={(index) => {
          setQueue(removeQueueAction(queue, index));
          setArmed(undefined);
          setAiming(undefined);
          setPull(IDLE);
        }}
      />
      <EnemyPanel
        knownGrid={knownGrid}
        enemies={view.enemies}
        playback={playback}
        collapsed={picking}
        attackerPosition={aiming !== undefined && !aimsAtAlly && !playing ? planningFrom : undefined}
        aimedCard={aimedCard}
      />
      {(playback?.log ?? log).length > 0 && (
        // Newest line stays in view; older ones scroll up.
        <ol className="hud log" aria-label="Resolution log" data-testid="log" ref={(el) => el?.scrollTo(0, el.scrollHeight)}>
          {(playback?.log ?? log).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
      {pulledCard && (
        <PulledCard
          card={pulledCard}
          faces={showsFaces(pull) ? pulledFaces : undefined}
          onFace={(face) => applyPull(tapPull(pullRef.current, face))}
          onOutside={() => applyPull(tapPull(pullRef.current, undefined))}
        />
      )}
      <div className={`hud hand-bar${picking ? " collapsed" : ""}`}>
        <PilePanel
          deck={shownDeckCount(selected.deckCount - (playback?.deckDamage[selected.id] ?? 0), drawing ? draw.cards.length : 0, draw.departed)}
          discard={selected.discardCount}
          exile={selected.exileCount}
          opacity={focus.deck}
        />
        <div className="hand-column">
          <EnergyPill
            available={energy.available}
            lit={false}
            active={false}
            title={`Pitched ${energy.pitched} · Spent ${energy.spent}`}
            opacity={focus.energyPill}
          />
          <Hand
            hero={selected}
            queue={queue}
            pitched={pitched}
            armed={armed ?? aiming}
            armedLabel={aiming !== undefined ? "Pick a target" : "Pick a tile"}
            held={heldInHand}
            inUse={cardInUse}
            otherOpacity={focus.otherCards}
            disabled={playing || drawing}
            arriving={drawing ? draw.cards : NO_CARDS}
            onCardClick={clickCard}
            onCardPointerDown={startCardPress}
            collapsed={picking}
          />
        </div>
        {picking && (armed ?? aiming) !== undefined && (
          <SelectedCardChip
            card={HERO_DECKS[selected.heroClass][(armed ?? aiming)!]!}
            hint={aiming !== undefined ? "Pick a target" : "Pick a tile"}
            onCancel={cancelUse}
          />
        )}
      </div>
      <section className="commit-panel" aria-label="Commit" style={{ opacity: focus.commit }}>
        {((aiming !== undefined && !playing) || issues.length > 0) && (
          <div className="commit-info">
            {aiming !== undefined && !playing && aimedCard && (
              <p className="target-hint">
                {targetHint({ card: aimedCard, aimsAtTile, aimsAtAlly, aimsAtDeployTile, needsSecondAlly, allyPicked: deployAlly !== undefined })}
              </p>
            )}
            {issues.length > 0 && (
              <ul className="issues" role="alert">
                {issues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button type="button" className="commit" disabled={issues.length > 0 || playing} onClick={() => void commit(plan)}>
          Commit
        </button>
      </section>
    </div>
  );
}
