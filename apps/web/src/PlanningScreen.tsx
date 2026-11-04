import {
  ActionKind,
  cardRangeArea,
  type RangeTile,
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
  EventKind,
  HERO_DECKS,
  HeroClass,
  MAX_QUEUE_LENGTH,
  withWreck,
  moveDestinations,
  reachableMoveDestinations,
  type GridPosition,
  type HeroView,
  type PlanIssue,
  type QueuedAction,
  REACTOR_DECK,
  PLANNING_TIMER_SECONDS,
  PRIME_ZONE_WIN_RESOLUTIONS,
  ROUND_LIMIT,
  type SquadPlan,
  type SquadView,
  type SubmitResult,
  validatePlan,
  Visibility,
} from "game-core";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { collisionWarnings, type PlannedPath, plannedPaths } from "./ally-paths";
import { Board } from "./Board";
import { CardFace, EnergyPill, FloatingCard, PulledCard } from "./game-parts";
import { cancel as cancelPull, type Face, faceViews, heldCard, IDLE, move as movePull, openCard, press as pressCard, type PullState, release as releasePull, showsFaces, tap as tapPull } from "./card-pull";
import { CardUseStage, hudFocus } from "./hud-focus";
import { drawShots, type ShotDrawing } from "./shot-lines";
import { heroMarks } from "./shield-marks";
import { plannedTargetLines, replayTargetLines, type TargetLine } from "./target-lines";
import { cardAtX, FAN_WIDTH, fanSpacing } from "./hand-fan";
import { drawSchedule, newCards, shownDeckCount } from "./hand-draw";
import { addBurn, type BurnBatch, NO_BURN_PENDING, settleBurn, shownBurnCounts } from "./deck-burn";
import { DeckBurn } from "./DeckBurn";
import { addShuffle, NO_SHUFFLE_PENDING, settleShuffle, shownDeckAfterShuffle, shownDiscardCount, SHUFFLE_MS, type ShuffleStep, shuffledWhileDrawing } from "./deck-shuffle";
import { DeckShuffle } from "./DeckShuffle";
import { exhaustionHud } from "./exhaustion-hud";
import type { BoardPick, Point } from "./card-drag";
import { Callout } from "./Callout";
import { COUNTDOWN_CALLOUT_MS, countdownCallout, formatTimer, timerTone } from "./callout";
import { type PrimeCallout, primeCallouts, type PrimeProgress, primeScore, zoneOccupancy, zoneTint } from "./prime-zone";
import { targetsInReach } from "./target-pick";
import { queueRowState, RESOLUTION_CALLOUT_MS, RESOLUTION_DIM, type ResolutionStage, resolutionCommitLabel } from "./resolution-hud";
import { buildCommentary, type CommentaryEntry, type CommentarySide, MAX_COMMENTARY_ENTRIES } from "./commentary";
import { CLIP_SPEED } from "./clip-player";
import { coverGridOf } from "./terrain";
import { buildPlaybackFrames, enemyTokens, STEP_MS, tickCountOf } from "./playback";
import type { ClipName } from "./hero-clips";
import type { EffectCue } from "./weapon-effects";
import { actionUsesCard, addWaitAction, blockAction,CARD_USE_LABELS, CardUse, cardUseReasons, describeEffects, energyReadout, moveAction, primaryAction, queueRowLabel,removeQueueAction, selectHero, pickInstruction } from "./planning-selection";

/** The Hero the player plans for; the other two are AI planned (offline prototype spec). */
export const PLAYER_HERO_CLASS = HeroClass.Bruiser;

const NO_TILES: readonly GridPosition[] = [];
const NO_SHOTS: readonly ShotDrawing[] = [];
const NO_RANGE: readonly RangeTile[] = [];
const NO_PATHS: readonly PlannedPath[] = [];
const PIPS = Array.from({ length: PRIME_ZONE_WIN_RESOLUTIONS }, (_, i) => i);
const NO_LABELS: readonly { position: GridPosition; text: string }[] = [];

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
  /** Cards shuffled from the Discard into each Hero's Deck so far in the playback. */
  shuffled: Record<string, number>;
  exhausted: string[];
  /** Heroes hit in the frame being shown. */
  hit: string[];
  /** The clip each Hero plays in the frame being shown (Heroes not listed idle). */
  clips: Record<string, ClipName>;
  /** Milliseconds after the start of the frame at which a Hero's clip starts (a target reacts at the impact beat). */
  clipDelays: Record<string, number>;
  /** The effects of the attacks of the frame being shown. */
  effects: EffectCue[];
  /** Heroes Slowed or Marked so far in the playback: they carry it until the end of the next Resolution. */
  slowed: string[];
  marked: string[];
  /** The commentary of the Tick being shown. */
  commentary: CommentaryEntry[];
  /** The target lines of the actions resolved in the frame being shown. */
  lines: TargetLine[];
}

/** Bottom right, above Commit: the Queue of the selected Hero, tick 1 on top. Each row shows the action, its target and why it is invalid. */
function QueueColumn({
  queue,
  heroClass,
  heroId,
  issues,
  disabled,
  resolutionTick,
  nameOf,
  onRemove,
}: {
  queue: readonly QueuedAction[];
  heroClass: HeroClass;
  heroId: string;
  issues: readonly PlanIssue[];
  disabled: boolean;
  /** Set during the Resolution (0 before the first Tick): the Queue is read-only and the row of the current Tick is lit. */
  resolutionTick: number | undefined;
  nameOf: (heroId: string) => string;
  onRemove: (index: number) => void;
}) {
  // An issue without a slot of its own (a whole-Queue rule) is shown on the last row.
  const reasonsAt = (slot: number) =>
    issues.filter((issue) => (issue.slot ?? queue.length - 1) === slot).map((issue) => issue.message);
  return (
    <section className="queue" aria-label="Queue">
      <ol className="queue-rows">
        {Array.from({ length: Math.max(MAX_QUEUE_LENGTH, queue.length) }, (_, slot) => {
          const action = queue[slot];
          if (!action) return <li key={slot} className="queue-row empty" aria-label={`Empty slot ${slot + 1}`} />;
          const { name, target } = queueRowLabel(heroClass, heroId, action, nameOf);
          const reasons = reasonsAt(slot);
          return (
            <li
              key={slot}
              className={`queue-row${reasons.length > 0 ? " invalid" : ""}${resolutionTick === undefined ? "" : ` ${queueRowState(slot, resolutionTick)}`}`}
              title={reasons.join(" ")}
            >
              <span className="queue-number">{slot + 1}</span>
              <span className="queue-text">
                <span className="queue-name">
                  {name}
                  {action.kind === ActionKind.Primary && action.overdrive && <span className="od-marker">OD</span>}
                </span>
                {target && <span className="queue-target">{target}</span>}
                {reasons.length > 0 && (
                  <span className="queue-reason" role="alert">
                    {reasons.join(" ")}
                  </span>
                )}
              </span>
              {resolutionTick === undefined && (
                <button type="button" className="queue-remove" disabled={disabled} aria-label={`Remove action ${slot + 1}`} onClick={() => onRemove(slot)}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Right of the Hand: the Wait action as a card. */
function WaitCard({ dimmed, disabled, onWait }: { dimmed: boolean; disabled: boolean; onWait: () => void }) {
  return (
    <button type="button" className="card wait-card" style={{ opacity: dimmed ? 0.35 : undefined }} disabled={disabled || dimmed} onClick={onWait}>
      Wait
    </button>
  );
}

/** The piles of the selected Hero: the Deck as a stack with its count on top, Discard and Exile as a tiny grey row. */
/** Exhaustion (issue 205): a red skull replaces the Deck count; it drops in and shakes once. */
function Skull() {
  return (
    <svg className="deck-skull" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Exhausted" data-testid="deck-skull">
      <path
        fill="currentColor"
        d="M16 2C8.8 2 4 7 4 13.5c0 4 1.9 6.6 4.5 8.2V27h4v-3h2v3h3v-3h2v3h4v-5.3c2.6-1.6 4.5-4.2 4.5-8.2C28 7 23.2 2 16 2Zm-5.5 17a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm11 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

export function PilePanel({
  deck,
  discard,
  exile,
  opacity,
  burn,
  skull,
  greyed,
  resolving,
}: {
  /** The Resolution runs: the Deck group is dimmed, but not the pile animations inside it. */
  resolving?: boolean;
  deck: number;
  discard: number;
  exile: number;
  opacity: number;
  burn?: ReactNode;
  skull: boolean;
  greyed: boolean;
}) {
  return (
    <div className={`piles${resolving ? " resolving" : ""}`} style={greyed ? undefined : { opacity }}>
      <div className={`pile-minor${greyed ? " exhausted-hud" : ""}`}>
        <span data-testid="discard-count">Discard {discard}</span>
        <span data-testid="exile-count">Exile {exile}</span>
      </div>
      {/* The skull is a sibling of the greyed Deck pile, so the greying never touches it. */}
      <div className="deck-group">
        <div className={`deck-pile${greyed ? " exhausted-hud" : ""}`} data-testid="deck-pile" aria-label={`Deck: ${deck} cards`}>
          {skull ? null : <span className="deck-count">{deck}</span>}
          {burn}
        </div>
        {skull ? <Skull /> : null}
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
const noop = () => {};

interface DrawState {
  view: SquadView;
  heroId: string;
  /** The player's Hand in `view`, to find the new cards of the next Round. */
  hand: readonly CardIndex[];
  /** The cards that fly in, in Hand order. */
  cards: readonly CardIndex[];
  /** How many of them have left the Deck pile. */
  departed: number;
  /** Cards the draw shuffled from the Discard into the Deck before it went on (0 for none), with the Deck count before. */
  shuffled: number;
  deckBefore: number;
  /** The shuffle has ended; the cards fly only after it. */
  shuffleDone: boolean;
  done: boolean;
}

/**
 * The draw of a Round: nothing flies with reduced motion, or when no card is new. `deckBefore` is the Deck count the
 * Resolution left; when the draw needed more cards than that, the Discard was shuffled in first.
 */
function startDraw(view: SquadView, previousHand: readonly CardIndex[] | undefined, deckBefore: number | undefined): DrawState {
  const hero = view.heroes.find((candidate) => candidate.heroClass === PLAYER_HERO_CLASS)!;
  const cards = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? [] : newCards(previousHand, hero.hand);
  const shuffled = deckBefore === undefined ? 0 : shuffledWhileDrawing(deckBefore, cards.length, hero.deckCount);
  return { view, heroId: hero.id, hand: hero.hand, cards, departed: 0, shuffled, deckBefore: deckBefore ?? 0, shuffleDone: shuffled === 0, done: cards.length === 0 };
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
  /** The card in the Hand that is pressed or pulled out (card-pull.ts); the faces of its uses are shown. */
  const [pull, setPullState] = useState<PullState>(IDLE);
  /** The aimed card is used in its Overdrive mode (the Overdrive face was chosen). */
  const [overdriveAim, setOverdriveAim] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>();
  // The Deck Damage animation (issue 203): hits on the player's Heroes wait in a queue and burn one batch at a time.
  // The shuffle animation (issue 204) waits in the same line, so it plays after the cards burned before it.
  const [burnQueue, setBurnQueue] = useState<readonly (BurnBatch | ShuffleStep)[]>([]);
  const burnQueueRef = useRef(burnQueue);
  burnQueueRef.current = burnQueue;
  const [burnPending, setBurnPending] = useState(NO_BURN_PENDING);
  const [shufflePending, setShufflePending] = useState(NO_SHUFFLE_PENDING);
  const burnId = useRef(0);
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
  /** Set from Commit until the next Round: Waiting..., the RESOLUTION callout, the Ticks, Done. */
  const [resolutionStage, setResolutionStage] = useState<ResolutionStage>();
  /** The counts after the Resolution and the callout being shown, from the end of the Ticks until the next view arrives. */
  const [primeAfter, setPrimeAfter] = useState<PrimeProgress>();
  const [primeCallout, setPrimeCallout] = useState<PrimeCallout>();
  const playing = resolutionStage !== undefined;

  // The draw animation: the cards new in the player's Hand fly in one after the other (hand-draw.ts). The state is
  // derived while rendering the first time a view is seen, so no card shows face up before it has flown.
  // The Deck count the last Resolution left for the player's Hero, to see whether the draw shuffled the Discard in.
  const deckAfterResolution = useRef<number | undefined>(undefined);
  const [draw, setDraw] = useState(() => startDraw(view, undefined, undefined));
  if (draw.view !== view) setDraw(startDraw(view, draw.hand, deckAfterResolution.current));
  const drawing = !draw.done && selected.id === draw.heroId;
  useEffect(() => {
    if (draw.done || draw.view !== view) return;
    const forThisView = (change: (state: DrawState) => DrawState) => (state: DrawState) => (state.view === view ? change(state) : state);
    // The cards fly only after a shuffle that the draw needed has ended.
    const wait = draw.shuffled > 0 ? SHUFFLE_MS : 0;
    const timers = draw.cards.map((_, order) =>
      setTimeout(() => setDraw(forThisView((state) => ({ ...state, departed: Math.max(state.departed, order + 1) }))), wait + drawSchedule(order).start),
    );
    timers.push(setTimeout(() => setDraw(forThisView((state) => ({ ...state, shuffleDone: true }))), wait));
    timers.push(setTimeout(() => setDraw(forThisView((state) => ({ ...state, done: true }))), wait + drawSchedule(draw.cards.length - 1).landed));
    // A tap anywhere finishes the animation at once.
    const skip = () => setDraw(forThisView((state) => ({ ...state, departed: state.cards.length, shuffleDone: true, done: true })));
    window.addEventListener("pointerdown", skip, true);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointerdown", skip, true);
    };
  }, [draw.view, draw.done, view]);

  const burning = burnQueue[0];
  const burnCounts = shownBurnCounts(
    selected.deckCount - (playback?.deckDamage[selected.id] ?? 0) + (playback?.shuffled[selected.id] ?? 0),
    selected.exileCount + (playback?.deckDamage[selected.id] ?? 0),
    burnPending,
    selected.id,
  );
  const shownDeck = shownDeckAfterShuffle(burnCounts.deck, shufflePending, selected.id);
  const shownDiscard = shownDiscardCount(selected.discardCount, playback?.shuffled[selected.id] ?? 0, shufflePending, selected.id);
  const shuffleWhileDrawing = drawing && draw.shuffled > 0 && !draw.shuffleDone;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exhaustion = exhaustionHud({
    exhausted: selected.exhausted,
    exhaustedInPlayback: playback?.exhausted.includes(selected.id) ?? false,
    animationsQueued: burnQueue.length > 0,
  });

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
      playing
        ? (playback?.lines ?? [])
        : plannedTargetLines(knownGrid, view.heroes, view.enemies, squadPlans).map((line) => ({ ...line, faint: line.heroId !== playerHeroId })),
    [playing, playback, knownGrid, view.heroes, view.enemies, squadPlans, playerHeroId],
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
        // Only the player's own plan gets marks; allied plans are drawn as faint lines only.
        queue: hero.id === playerHeroId ? squadPlans.flatMap((squadPlan) => squadPlan.heroes).find((planned) => planned.heroId === hero.id)?.queue : undefined,
        resolving: playing,
      }),
    ]);
    const enemies = view.enemies.map((enemy) => [
      enemy.id,
      heroMarks({
        own: false,
        heroClass: enemy.heroClass,
        visibility: enemy.visibility,
        shield: enemy.visibility === Visibility.Visible ? held(enemy.id, enemy.shield) : 0,
        resolving: playing,
      }),
    ]);
    return Object.fromEntries([...own, ...enemies]);
  }, [view.heroes, view.enemies, squadPlans, playback, playing, playerHeroId]);
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
      ...(playback?.slowed.includes(unit.id) && { slowed: true }),
      ...(playback?.marked.includes(unit.id) && { marked: true }),
      position: playback?.positions[unit.id] ?? unit.position,
      exhausted: unit.exhausted || (playback?.exhausted.includes(unit.id) ?? false),
    }));
  const boardHeroes = useMemo(() => onBoard(view.heroes), [view.heroes, playback]);
  // Unknown enemies have no marker; Ghosts stay where they were last seen, faded.
  const boardEnemies = useMemo(() => enemyTokens(view.enemies, onBoard), [view.enemies, playback]);
  const zone = zoneOccupancy(boardHeroes, boardEnemies);
  const score = primeScore(primeAfter ?? view.primeProgress, view.squad, zone.occupied, zone.contested);
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
  const candidateIds = useMemo(() => {
    if (aiming === undefined || playing) return [];
    return [...new Set(aimedModes.flatMap(heroTargetsOf))];
  }, [aiming, aimedModes, needsSecondAlly, playing, selected.id, deployAlly, view.heroes, view.enemies]);
  const sideOf = (heroId: string): CommentarySide => {
    const ownSquadHero = view.heroes.find((hero) => hero.id === heroId);
    if (ownSquadHero === undefined) return "enemy";
    return ownSquadHero.heroClass === PLAYER_HERO_CLASS ? "own" : "ally";
  };
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
        ? drawShots(knownGrid, planningFrom, aimedCard.range, view.enemies, candidateIds)
        : NO_SHOTS,
    [aimedCard, playing, knownGrid, planningFrom, view.enemies, candidateIds],
  );
  // A card that aims at another Hero reaches it only inside its Range area, and a shot must be able to hit (issue 209).
  const aimsAtOtherHero =
    aimedCard !== undefined && !aimsAtTile && !aimsAtDeployTile && aimedCard.target !== CardTarget.SelfHero && aimedCard.target !== CardTarget.EnemiesInRange;
  const targetableIds = useMemo(() => {
    if (!aimsAtOtherHero || !aimedCard) return candidateIds;
    const candidates = [...view.heroes, ...view.enemies].flatMap((unit) =>
      candidateIds.includes(unit.id) && "position" in unit ? [{ id: unit.id, position: unit.position }] : [],
    );
    return targetsInReach(candidates, planningFrom, aimedCard, (id) => shotLines.find((shot) => shot.targetId === id)?.ringed ?? true);
  }, [aimsAtOtherHero, candidateIds, view.heroes, view.enemies, planningFrom, aimedCard, shotLines]);
  const rangeArea = useMemo(
    () => (aimsAtOtherHero && !playing && aimedCard ? cardRangeArea(knownGrid, planningFrom, aimedCard) : NO_RANGE),
    [aimsAtOtherHero, playing, knownGrid, planningFrom, aimedCard],
  );
  const noEnemyInRange = aimsAtOtherHero && !aimsAtAlly && targetableIds.length === 0;

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
        setQueue([]);
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
    setResolutionStage("waiting");
    let result;
    try {
      result = await submitPlan(toSubmit);
    } catch (error) {
      committingRef.current = false;
      setResolutionStage(undefined);
      throw error;
    }
    setResolutionStage("callout");
    await new Promise((resolve) => setTimeout(resolve, RESOLUTION_CALLOUT_MS));
    if (unmounted.current) return;
    setResolutionStage("ticks");
    const positions: Record<string, GridPosition> = {};
    const startPositions: Record<string, GridPosition> = Object.fromEntries(
      [...view.heroes, ...view.enemies].flatMap((unit) => ("position" in unit ? [[unit.id, unit.position]] : [])),
    );
    const shields: Record<string, number> = {};
    const deckDamage: Record<string, number> = {};
    const shuffled: Record<string, number> = {};
    const playerHero = view.heroes.find((hero) => hero.heroClass === PLAYER_HERO_CLASS)!;
    const exhausted: string[] = [];
    const tickCount = tickCountOf(result.events);
    let commentary: CommentaryEntry[] = [];
    let commentaryTick = 0;
    setPlayback({ tick: 0, tickCount, positions, shields, deckDamage, shuffled, exhausted, hit: [], clips: {}, clipDelays: {}, effects: [], slowed: [], marked: [], commentary, lines: [] });
    const slowed: string[] = [];
    const marked: string[] = [];
    const classes = new Map([...view.heroes, ...view.enemies].map((unit) => [unit.id, unit.heroClass]));
    // Reduced motion plays no clips, so a frame lasts one step; otherwise until the slowest clip is back at rest.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grid = coverGridOf(view.destroyedCover, view.placedCover, view.wreckCover);
    for (const frame of buildPlaybackFrames(result.events, (heroId) => classes.get(heroId), (tile) => coverAt(grid, tile))) {
      Object.assign(positions, frame.moves);
      for (const [heroId, amount] of Object.entries(frame.shields)) shields[heroId] = (shields[heroId] ?? 0) + amount;
      for (const { targetId, damage, absorbed } of frame.hits) {
        shields[targetId] = Math.max(0, (shields[targetId] ?? 0) - absorbed);
        deckDamage[targetId] = (deckDamage[targetId] ?? 0) + damage;
      }
      // Burns and shuffles queue in the order of the events, so a shuffle in the middle of a hit plays after the cards
      // burned before it and before the cards that burn after it.
      for (const event of frame.events) {
        const isOwn = view.heroes.some((hero) => hero.id === (event.targetId ?? event.heroId));
        if (event.kind === EventKind.AttackHit && (event.damage ?? 0) > 0 && isOwn) {
          const heroId = event.targetId!;
          setBurnPending((pending) => addBurn(pending, heroId, event.damage!));
          setBurnQueue((queued) => [...queued, { kind: "burn", id: burnId.current++, heroId, cards: event.damage! }]);
        }
        if (event.kind === EventKind.DeckShuffled) {
          shuffled[event.heroId] = (shuffled[event.heroId] ?? 0) + (event.amount ?? 0);
          if (event.heroId === playerHero.id) {
            const cards = event.amount ?? 0;
            setShufflePending((pending) => addShuffle(pending, event.heroId, cards));
            setBurnQueue((queued) => [...queued, { kind: "shuffle", id: burnId.current++, heroId: event.heroId, cards }]);
          }
        }
      }
      exhausted.push(...frame.exhausted);
      for (const cue of frame.effects) {
        if (cue.kind === "slow") slowed.push(cue.toId);
        if (cue.kind === "marked") marked.push(cue.toId);
      }
      if (frame.tick !== commentaryTick) {
        commentaryTick = frame.tick;
        commentary = buildCommentary(
          result.events.filter((event) => event.tick === frame.tick),
          { nameOf, sideOf },
        );
      }
      setPlayback({
        tick: frame.tick,
        tickCount,
        positions: { ...positions },
        shields: { ...shields },
        deckDamage: { ...deckDamage },
        shuffled: { ...shuffled },
        exhausted: [...exhausted],
        hit: frame.hits.map((hit) => hit.targetId),
        clips: frame.clips,
        clipDelays: frame.delays,
        effects: frame.effects,
        slowed: [...slowed],
        marked: [...marked],
        commentary,
        lines: replayTargetLines(frame.events, view.heroes, view.enemies, (heroId) => positions[heroId] ?? startPositions[heroId]),
      });
      await new Promise((resolve) => setTimeout(resolve, reducedMotion ? STEP_MS : Math.max(STEP_MS, frame.holdMs / CLIP_SPEED)));
      if (unmounted.current) return;
    }
    setResolutionStage("done");
    // The Prime Zone counts after the Resolution: pips fill and the callouts play one after the other.
    for (const callout of primeCallouts(view.primeProgress, result.view.primeProgress, view.squad)) {
      setPrimeAfter(result.view.primeProgress);
      setPrimeCallout(callout);
      await new Promise((resolve) => setTimeout(resolve, callout.durationMs));
      if (unmounted.current) return;
    }
    // Let the pile animations that are still queued (a shuffle at the very end of the Resolution) play out.
    const patience = Date.now() + 10_000;
    while (burnQueueRef.current.length > 0 && Date.now() < patience) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (unmounted.current) return;
    }
    deckAfterResolution.current = playerHero.deckCount - (deckDamage[playerHero.id] ?? 0) + (shuffled[playerHero.id] ?? 0);
    setBurnQueue([]);
    setBurnPending(NO_BURN_PENDING);
    setShufflePending(NO_SHUFFLE_PENDING);
    setPlayback(undefined);
    setResolutionStage(undefined);
    setPrimeAfter(undefined);
    setPrimeCallout(undefined);
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
        clips={playback?.clips}
        clipDelays={playback?.clipDelays}
        effects={playback?.effects}
        highlights={highlights}
        zoneTint={zoneTint(score)}
        zoneLabels={NO_LABELS}
        areaTiles={NO_TILES}
        rangeArea={rangeArea}
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
      {score !== undefined && (
        <div className={`prime-pill prime-${score.state}`} data-testid="prime-progress" aria-label={`${score.label}, ${score.filled} of ${PIPS.length}`}>
          <span className="prime-label">{score.label}</span>
          <span className="prime-pips">
            {PIPS.map((pip) => (
              // The key carries the filled state, so a pip that fills mounts again and plays its pop.
              <span key={`${pip}-${pip < score.filled}`} className={pip < score.filled ? "prime-pip prime-pip-filled" : "prime-pip"} />
            ))}
          </span>
        </div>
      )}
      <div
        className={`timer-pill timer-${timerTone(secondsLeft)}`}
        title={`Round ${view.round} / ${ROUND_LIMIT}`}
        aria-label={`Round ${view.round} of ${ROUND_LIMIT}`}
      >
        <span data-testid="round" className="timer-round">
          ROUND {view.round}
        </span>
        <span data-testid="timer" className="timer-time" aria-label="Planning time left">
          {secondsLeft === 0 || playing ? "LOCKED" : formatTimer(secondsLeft)}
        </span>
      </div>
      {!playing && countdownCallout(secondsLeft) !== undefined && (
        <Callout kind="number" text={countdownCallout(secondsLeft)!.text} tone={countdownCallout(secondsLeft)!.tone} durationMs={COUNTDOWN_CALLOUT_MS} />
      )}
      {resolutionStage === "callout" && <Callout kind="word" text="RESOLUTION" tone="teal" durationMs={RESOLUTION_CALLOUT_MS} />}
      {playing && (
        <div className="resolution-bar" data-testid="resolution-bar" aria-hidden="true">
          RESOLUTION
        </div>
      )}
      {primeCallout !== undefined && <Callout kind="word" text={primeCallout.text} tone={primeCallout.tone} durationMs={primeCallout.durationMs} />}
      {playback !== undefined && playback.commentary.length > 0 && (
        // A new key per Tick: the entries of the previous Tick are replaced and slide in again.
        <ol className="commentary" aria-label="Resolution commentary" data-testid="commentary" key={playback.tick}>
          {playback.commentary.slice(0, MAX_COMMENTARY_ENTRIES).map((entry, i) => (
            <li key={i} className={`commentary-entry ${entry.side} slide-in`} style={{ "--i": i } as CSSProperties}>
              <b>{entry.title}</b>
              <span>{entry.detail}</span>
            </li>
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
          deck={shuffleWhileDrawing ? draw.deckBefore : shownDeckCount(shownDeck, drawing ? draw.cards.length : 0, draw.departed)}
          discard={shownDiscard}
          exile={burnCounts.exile}
          opacity={focus.deck}
          resolving={playing}
          skull={exhaustion.skull}
          greyed={exhaustion.greyed}
          burn={
            <>
              {burning?.kind === "burn" && (
                <DeckBurn
                  key={burning.id}
                  cards={burning.cards}
                  visible={burning.heroId === selected.id}
                  reducedMotion={reducedMotion}
                  onLifted={() => setBurnPending((pending) => settleBurn(pending, burning.heroId, "lifted"))}
                  onBurned={() => setBurnPending((pending) => settleBurn(pending, burning.heroId, "burned"))}
                  onDone={() => setBurnQueue((queued) => queued.filter((batch) => batch.id !== burning.id))}
                />
              )}
              {burning?.kind === "shuffle" && (
                <DeckShuffle
                  key={burning.id}
                  cards={burning.cards}
                  visible={burning.heroId === selected.id}
                  reducedMotion={reducedMotion}
                  onStart={() => setShufflePending((pending) => settleShuffle(pending, burning.heroId, "started", burning.cards))}
                  onDone={() => {
                    setShufflePending((pending) => settleShuffle(pending, burning.heroId, "ended", burning.cards));
                    setBurnQueue((queued) => queued.filter((step) => step.id !== burning.id));
                  }}
                />
              )}
              {shuffleWhileDrawing && <DeckShuffle cards={draw.shuffled} visible reducedMotion={false} onStart={noop} onDone={noop} />}
            </>
          }
        />
        <div className={`hand-column${exhaustion.greyed ? " exhausted-hud" : ""}`} style={playing ? { opacity: RESOLUTION_DIM } : undefined}>
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
            disabled={playing || drawing || exhaustion.greyed}
            arriving={drawing ? draw.cards : NO_CARDS}
            onCardClick={clickCard}
            onCardPointerDown={startCardPress}
            collapsed={picking}
          />
        </div>
        {!picking && (
          <WaitCard
            dimmed={queue.length >= MAX_QUEUE_LENGTH}
            disabled={playing || drawing || exhaustion.greyed}
            onWait={() => {
              setQueue(addWaitAction(queue));
              setArmed(undefined);
              setAiming(undefined);
              setPull(IDLE);
            }}
          />
        )}
      </div>
      {picking && (armed ?? aiming) !== undefined && (
        <FloatingCard
          card={HERO_DECKS[selected.heroClass][(armed ?? aiming)!]!}
          instruction={
            aimedCard === undefined
              ? "Tap a lit tile"
              : pickInstruction({ card: aimedCard, aimsAtTile, aimsAtAlly, aimsAtDeployTile, needsSecondAlly, allyPicked: deployAlly !== undefined, noEnemyInRange })
          }
          onCancel={cancelUse}
        />
      )}
      <section className="commit-panel" aria-label="Commit" style={{ opacity: focus.commit }}>

        <QueueColumn
          queue={queue}
          heroClass={selected.heroClass}
          heroId={selected.id}
          issues={issues}
          disabled={playing}
          resolutionTick={playing ? (playback?.tick ?? 0) : undefined}
          nameOf={nameOf}
          onRemove={(index) => {
            setQueue(removeQueueAction(queue, index));
            setArmed(undefined);
            setAiming(undefined);
            setPull(IDLE);
          }}
        />
        <button
          type="button"
          className={`commit${resolutionStage ? " resolving" : ""}`}
          disabled={queue.length === 0 || issues.length > 0 || playing || exhaustion.greyed}
          onClick={() => void commit(plan)}
        >
          {resolutionStage ? resolutionCommitLabel(resolutionStage,playback?.tick ?? 0) : "Commit"}
        </button>
      </section>
    </div>
  );
}
