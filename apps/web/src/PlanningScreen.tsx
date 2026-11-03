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
  chebyshevDistance,
  type EnemyView,
  type Grid,
  HERO_DECKS,
  HeroClass,
  MAX_QUEUE_LENGTH,
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
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./Board";
import { BlockChip, CardFace, EnergyOrb, ModeFaceCard } from "./game-parts";
import { drawShots, type ShotDrawing } from "./shot-lines";
import { applyDrop, type BoardPick, type DropPlaces, type DropProbe, type DropUse, type Point, probeDrop, type Rect } from "./card-drag";
import { buildPlaybackFrames, describeEvent, enemyTokens, tickCountOf } from "./playback";
import { blockAction, CARD_USE_LABELS, CardUse, cardUseReasons, coverProtectionLabel, describeEffects, energyReadout, type ModeFace, modeChoiceFaces, moveAction, primaryAction, queueSlotCode, rangeDamageLabel, removeQueueAction, selectHero, targetHint } from "./planning-selection";

/** The Hero the player plans for; the other two are AI planned (offline prototype spec). */
export const PLAYER_HERO_CLASS = HeroClass.Bruiser;

/** How far a pressed card must move before it counts as lifted (a smaller move is still a tap). */
const DRAG_START_DISTANCE = 8;
/** A card without a Range played "here" is dropped within this many tiles of the Hero. */
const PLAY_HERE_RADIUS = 2;

const NO_TILES: readonly GridPosition[] = [];
const NO_SHOTS: readonly ShotDrawing[] = [];
const NO_LABELS: readonly { position: GridPosition; text: string }[] = [];

/** Every tile of the Reactor Deck within `radius` tiles of `center`. */
function areaAround(center: GridPosition, radius: number): GridPosition[] {
  const tiles: GridPosition[] = [];
  for (let row = 0; row < REACTOR_DECK.height; row++)
    for (let col = 0; col < REACTOR_DECK.width; col++) {
      if (chebyshevDistance(center, { col, row }) <= radius) tiles.push({ col, row });
    }
  return tiles;
}

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

/** Top left: the Queue window of the selected Hero, with the other Heroes of the Squad as compact chips below it. */
function SquadPanel({
  heroes,
  selected,
  queue,
  playback,
  disabled,
  onSelect,
  onRemove,
  blockChip,
  blockChipRef,
}: {
  /** While a card is dragged: the Block 2 chip next to the Queue window, lit when Block is allowed. */
  blockChip: { allowed: boolean; active: boolean } | undefined;
  blockChipRef: RefObject<HTMLDivElement | null>;
  heroes: readonly HeroView[];
  selected: HeroView;
  queue: readonly QueuedAction[];
  playback: PlaybackState | undefined;
  disabled: boolean;
  onSelect: (id: string) => void;
  onRemove: (index: number) => void;
}) {
  const shield = playback?.shields[selected.id] ?? 0;
  return (
    <aside className="squad-panel" aria-label="Squad">
      <div className="queue-column">
      <section className="hud queue-window" aria-label="Queue">
        <div className="queue-head">
          <span className="hero-name">{HERO_NAMES[selected.heroClass]}</span>
          <span className="counts">
            Deck {selected.deckCount - (playback?.deckDamage[selected.id] ?? 0)} · Exile {selected.exileCount}
            {shield > 0 && ` · Shield ${shield}`}
          </span>
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
        <div className="queue-tags">
          {selected.slowed && <span className="tag slow-tag">Slowed</span>}
          {selected.marked && <span className="tag marked-tag">Marked</span>}
          {selected.hidden && <span className="tag hidden-tag">Hidden · sight +2</span>}
          {(selected.exhausted || playback?.exhausted.includes(selected.id)) && <span className="tag">Exhausted</span>}
        </div>
      </section>
      {blockChip && (
        <BlockChip chipRef={blockChipRef} allowed={blockChip.allowed} active={blockChip.active} />
      )}
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
                  {playerControlled ? "" : "AI · "}Deck {hero.deckCount - (playback?.deckDamage[hero.id] ?? 0)}
                  {exhausted && " · Exhausted"}
                </span>
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
  /** The card being dragged out of the fan: its place shows a dashed outline. */
  dragging: CardIndex | undefined;
  onCardPointerDown: (card: CardIndex, event: ReactPointerEvent) => void;
}

const ACTION_USE_LABELS: Record<ActionKind, string> = {
  [ActionKind.Move]: CARD_USE_LABELS[CardUse.Move],
  [ActionKind.Block]: CARD_USE_LABELS[CardUse.Block],
  [ActionKind.Primary]: CARD_USE_LABELS[CardUse.Primary],
};

function Hand({ hero, queue, pitched, armed, armedLabel, choosing, disabled, onCardTap, dragging, onCardPointerDown }: HandProps) {
  const deck = HERO_DECKS[hero.heroClass];
  const middle = (hero.hand.length - 1) / 2;
  return (
    <ul className="hand" aria-label="Hand">
      {hero.hand.map((cardIndex, position) => {
        const card = deck[cardIndex]!;
        const offset = position - middle;
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
          <li key={cardIndex} style={{ "--offset": offset } as CSSProperties}>
            <button
              type="button"
              className={`card ${card.type}${queued || isPitched ? " used" : ""}${cardIndex === dragging ? " dragging" : ""}`}
              aria-pressed={cardIndex === armed || cardIndex === choosing || queuedAt >= 0 || isPitched}
              disabled={disabled}
              onClick={() => onCardTap(cardIndex)}
              onPointerDown={(event) => onCardPointerDown(cardIndex, event)}
            >
              <CardFace card={card} use={use} />
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
  onClose: () => void;
}

/** The card detail sheet over Planning (UI spec, screen 5): the four uses. Overdrive is chosen after the target. */
function CardDetailSheet({ card, reasons, onChoose, onClose }: CardDetailSheetProps) {
  const useText: Record<CardUse, string | undefined> = {
    [CardUse.Primary]: describeEffects(card.effects),
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
    </section>
  );
}

interface ModeChoiceProps {
  card: CardDefinition;
  faces: [ModeFace, ModeFace];
  onPick: (face: ModeFace) => void;
  onCancel: () => void;
}

/** The two faces of a card with an Overdrive, side by side; tapping a face confirms it, tapping elsewhere cancels. */
function ModeChoice({ card, faces, onPick, onCancel }: ModeChoiceProps) {
  return (
    <div className="mode-choice" role="dialog" aria-label={`${card.name}: choose a version`}>
      <div className="mode-backdrop" data-testid="mode-backdrop" onClick={onCancel} />
      <div className="mode-faces">
        {faces.map((face) => (
          <ModeFaceCard key={String(face.overdrive)} card={card} face={face} onPick={onPick} />
        ))}
      </div>
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
  /** Forward Deploy: the ally already picked, while the player still has to pick its tile. */
  const [deployAlly, setDeployAlly] = useState<string>();
  /** Log of the last Resolution; stays visible until the next one. */
  const [log, setLog] = useState<string[]>([]);
  const [choosing, setChoosing] = useState<CardIndex>();
  /** A card with an Overdrive that was played on a target; the player now picks its Normal or Overdrive face. */
  const [modeChoice, setModeChoice] = useState<{ card: CardIndex; target: string; tile?: GridPosition }>();
  /** An Overdrive that needs a second allied Hero was chosen; the first one is in `deployAlly`. */
  const [pickingSecond, setPickingSecond] = useState(false);
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
  const aimedCard = aiming === undefined ? undefined : cardInMode(HERO_DECKS[selected.heroClass][aiming]!, pickingSecond);
  // A card with an Overdrive can be aimed at what either of its modes targets; the face chosen afterwards must fit.
  const aimedModes = aiming === undefined || aimedCard === undefined ? [] : pickingSecond || !aimedCard.overdrive ? [aimedCard] : [aimedCard, cardInMode(aimedCard, true)];
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
    setChoosing(undefined);
    setPickingSecond(false);
    setModeChoice(undefined);
  }

  // Dragging a card out of the Hand: one gesture per action. Tapping stays as an alternative.
  const [drag, setDrag] = useState<{ card: CardIndex; point: Point; probe: DropProbe }>();
  const planningRef = useRef<HTMLDivElement>(null);
  const blockChipRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef<HTMLDivElement>(null);
  const pickBoard = useRef<((point: Point) => BoardPick) | undefined>(undefined);
  const gesture = useRef<{ card: CardIndex; pointerId: number; start: Point; active: boolean } | undefined>(undefined);
  // The click that follows the release of a drag is not a tap.
  const dragEnded = useRef(false);

  const draggedCard = drag?.card;
  /** Where the dragged card could go; it is only lit and only takes a drop where its use is allowed. */
  function dropPlacesOf(card: CardDefinition): DropPlaces {
    const needsNoTarget = card.target === CardTarget.SelfHero || card.target === CardTarget.EnemiesInRange;
    const modes = card.overdrive ? [card, cardInMode(card, true)] : [card];
    const enemyIds = modes.flatMap((mode) =>
      [CardTarget.VisibleEnemy, CardTarget.EnemyInSight, CardTarget.GhostEnemy].includes(mode.target) ? enemyTargetsOf(mode) : [],
    );
    return {
      selfId: selected.id,
      heroIds: [...new Set(enemyIds)],
      primaryTiles: tileTargetsOf(card),
      moveTiles: reachableMoveDestinations(planningFrom),
      here: needsNoTarget ? { center: selected.position, radius: card.range ?? PLAY_HERE_RADIUS } : undefined,
    };
  }
  // What lights up while a card is dragged: only the places whose use is allowed right now.
  const dragLit = useMemo(() => {
    if (draggedCard === undefined) return undefined;
    const card = HERO_DECKS[selected.heroClass][draggedCard]!;
    const places = dropPlacesOf(card);
    const reasons = cardUseReasons(selected.heroClass, draggedCard, queue, pitched);
    const primary = reasons[CardUse.Primary] === undefined;
    const move = reasons[CardUse.Move] === undefined;
    const verb = card.type === CardType.Attack ? "ATTACK" : "USE";
    const here = primary ? places.here : undefined;
    const heroIds = primary ? places.heroIds : [];
    const labels = [
      ...heroIds.flatMap((id) => view.enemies.flatMap((enemy) => (enemy.id === id && enemy.visibility !== Visibility.Unknown ? [{ position: enemy.position, text: verb }] : []))),
      ...(here ? [{ position: here.center, text: "PLAY HERE" }] : []),
    ];
    return {
      heroIds,
      tiles: [...(primary ? places.primaryTiles : []), ...(move ? places.moveTiles : [])],
      labels,
      // A card with a Range shows it as a tinted area around the Hero.
      area: here && card.range !== undefined ? areaAround(here.center, here.radius) : [],
      blockAllowed: reasons[CardUse.Block] === undefined,
    };
  }, [draggedCard, selected, queue, pitched, planningFrom, view.enemies, view.heroes, view.placedCover, knownGrid]);

  // The line of fire: to the enemy under a dragged Attack card, or to every enemy the tapped Attack card can be aimed at.
  const shotCard = draggedCard !== undefined ? HERO_DECKS[selected.heroClass][draggedCard] : aimedCard;
  const droppedOn = drag?.probe.drop?.use === CardUse.Primary ? drag.probe.drop.heroId : undefined;
  const shotTargets = draggedCard !== undefined ? (droppedOn === undefined ? [] : [droppedOn]) : targetableIds;
  const shotLines = useMemo(
    () =>
      shotCard?.type === CardType.Attack && shotCard.range !== undefined && !playing
        ? drawShots(knownGrid, planningFrom, shotCard.range, view.enemies, shotTargets)
        : NO_SHOTS,
    [shotCard, playing, knownGrid, planningFrom, view.enemies, shotTargets],
  );

  function probeAt(card: CardIndex, point: Point): DropProbe {
    const definition = HERO_DECKS[selected.heroClass][card]!;
    const rectOf = (element: HTMLElement | null): Rect => element?.getBoundingClientRect() ?? { left: 0, top: 0, right: 0, bottom: 0 };
    const hud = [...(planningRef.current?.querySelectorAll<HTMLElement>(".hud, .squad-panel, .commit-panel") ?? [])].map((element) => rectOf(element));
    return probeDrop(
      point,
      { board: rectOf(planningRef.current), hud, blockChip: rectOf(blockChipRef.current), energyOrb: rectOf(energyRef.current), pickBoard: (at) => pickBoard.current?.(at) ?? { target: { kind: "none" }, ground: undefined } },
      dropPlacesOf(definition),
      cardUseReasons(selected.heroClass, card, queue, pitched),
      definition.type === CardType.Attack ? "ATTACK" : "USE",
    );
  }
  function dropCard(card: CardIndex, drop: DropUse) {
    setArmed(undefined);
    setAiming(undefined);
    setDeployAlly(undefined);
    setChoosing(undefined);
    setPickingSecond(false);
    // A card with an Overdrive waits for the choice of its face before it reaches the Queue.
    if (drop.use === CardUse.Primary && HERO_DECKS[selected.heroClass][card]!.overdrive) {
      setModeChoice({ card, target: drop.heroId!, tile: drop.tile });
      return;
    }
    const next = applyDrop(card, drop, queue, pitched);
    setQueue(next.queue);
    setPitched(next.pitched);
  }

  /** Whether the target of a pending choice is a valid target for the card in the given mode. */
  function modeAccepts(choice: { card: CardIndex; target: string; tile?: GridPosition }, overdrive: boolean): boolean {
    const mode = cardInMode(HERO_DECKS[selected.heroClass][choice.card]!, overdrive);
    if (choice.tile) return tileTargetsOf(mode).some((tile) => tile.col === choice.tile!.col && tile.row === choice.tile!.row);
    return heroTargetsOf(mode).includes(choice.target);
  }
  const modeFaces = modeChoice && modeChoiceFaces(selected.heroClass, modeChoice.card, queue, pitched, (overdrive) => modeAccepts(modeChoice, overdrive));
  function pickFace(face: ModeFace) {
    if (!modeChoice || face.reason) return;
    const { card, target, tile } = modeChoice;
    setModeChoice(undefined);
    const definition = cardInMode(HERO_DECKS[selected.heroClass][card]!, face.overdrive);
    if (face.overdrive && definition.effects.some(({ recipient }) => recipient === EffectRecipient.SecondTarget)) {
      // Continue with the second-target step.
      setAiming(card);
      setDeployAlly(target);
      setPickingSecond(true);
      return;
    }
    setQueue([...queue, primaryAction(card, target, { tile, overdrive: face.overdrive })]);
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
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!current.active && Math.hypot(point.x - current.start.x, point.y - current.start.y) > DRAG_START_DISTANCE) current.active = true;
    if (current.active) setDrag({ card: current.card, point, probe: probeAt(current.card, point) });
  };
  dragHandlers.current.end = (event) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    gesture.current = undefined;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    if (!current.active) return;
    dragEnded.current = true;
    setTimeout(() => (dragEnded.current = false), 0);
    setDrag(undefined);
    if (event.type === "pointercancel") return;
    const { drop } = probeAt(current.card, { x: event.clientX, y: event.clientY });
    if (drop) dropCard(current.card, drop);
  };
  function startCardPress(card: CardIndex, event: ReactPointerEvent) {
    if (playing || gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (queue.some((action) => action.card === card) || pitched.includes(card)) return;
    gesture.current = { card, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, active: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  // Tapping a used card frees it again; tapping a free card opens the use chooser.
  function tapCard(card: CardIndex) {
    if (dragEnded.current) return;
    setModeChoice(undefined);
    setArmed(undefined);
    setAiming(undefined);
    setPickingSecond(false);
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
    if (use === CardUse.Block) setQueue([...queue, blockAction(choosing)]);
    if (use === CardUse.Move) setArmed(choosing);
    if (use === CardUse.Primary) {
      setAiming(choosing);
      setDeployAlly(undefined);
    }
    else setPickingSecond(false);
    setChoosing(undefined);
  }

  function tapTarget(targetId: string) {
    if (aiming === undefined || playing || !targetableIds.includes(targetId)) return;
    if (aimedCard?.effects.some(({ kind }) => kind === EffectKind.GrantExtraMove)) {
      setDeployAlly(targetId);
      return;
    }
    if (pickingSecond) {
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly!, secondTarget: targetId, overdrive: true }]);
      setAiming(undefined);
      setDeployAlly(undefined);
      setPickingSecond(false);
      return;
    }
    if (HERO_DECKS[selected.heroClass][aiming]!.overdrive) setModeChoice({ card: aiming, target: targetId });
    else setQueue([...queue, primaryAction(aiming, targetId)]);
    setAiming(undefined);
  }

  function tapTile(destination: GridPosition) {
    if (aiming !== undefined && aimsAtDeployTile) {
      setQueue([...queue, { kind: ActionKind.Primary, card: aiming, target: deployAlly!, tile: destination }]);
      setAiming(undefined);
      setDeployAlly(undefined);
      return;
    }
    if (aiming !== undefined && aimsAtTile) {
      if (HERO_DECKS[selected.heroClass][aiming]!.overdrive) setModeChoice({ card: aiming, target: selected.id, tile: destination });
      else setQueue([...queue, primaryAction(aiming, selected.id, { tile: destination })]);
      setAiming(undefined);
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
    <div className="planning" ref={planningRef}>
      <Board
        destroyedCover={view.destroyedCover}
        placedCover={view.placedCover}
        revealedAreas={view.revealedAreas}
        visibleTiles={view.visibleTiles}
        heroes={boardHeroes}
        enemies={boardEnemies}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && changeSelection(id)}
        targetableIds={dragLit?.heroIds ?? targetableIds}
        onTargetTap={tapTarget}
        hitIds={playback?.hit ?? []}
        highlights={dragLit?.tiles ?? highlights}
        zoneLabels={dragLit?.labels ?? NO_LABELS}
        areaTiles={dragLit?.area ?? NO_TILES}
        shotLines={shotLines}
        pickRef={pickBoard}
        markers={markers}
        onTileTap={tapTile}
        moveFrameHero={armed !== undefined && !playing ? planningFrom : undefined}
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
        selected={selected}
        queue={queue}
        playback={playback}
        disabled={playing}
        onSelect={changeSelection}
        blockChip={dragLit ? { allowed: dragLit.blockAllowed, active: drag?.probe.drop?.use === CardUse.Block } : undefined}
        blockChipRef={blockChipRef}
        onRemove={(index) => {
          setQueue(removeQueueAction(queue, index));
          setArmed(undefined);
          setAiming(undefined);
          setChoosing(undefined);
        }}
      />
      <EnemyPanel
        knownGrid={knownGrid}
        enemies={view.enemies}
        playback={playback}
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
      {choosing !== undefined && !playing && (
        <CardDetailSheet
          card={HERO_DECKS[selected.heroClass][choosing]!}
          reasons={cardUseReasons(selected.heroClass, choosing, queue, pitched)}
          onChoose={chooseUse}
          onClose={() => setChoosing(undefined)}
        />
      )}
      {modeChoice && modeFaces && !playing && (
        <ModeChoice card={HERO_DECKS[selected.heroClass][modeChoice.card]!} faces={modeFaces} onPick={pickFace} onCancel={() => setModeChoice(undefined)} />
      )}
      <div className="hud hand-bar">
        <EnergyOrb
          orbRef={energyRef}
          available={energy.available}
          lit={drag !== undefined}
          active={drag?.probe.drop?.use === CardUse.Pitch}
          title={`Pitched ${energy.pitched} · Spent ${energy.spent}`}
        />
        <Hand
          hero={selected}
          queue={queue}
          pitched={pitched}
          armed={armed ?? aiming}
          armedLabel={aiming !== undefined ? "Pick a target" : "Pick a tile"}
          choosing={choosing}
          disabled={playing}
          onCardTap={tapCard}
          dragging={drag?.card}
          onCardPointerDown={startCardPress}
        />
      </div>
      {drag && (
        <>
          <div className="drag-ghost" style={{ left: drag.point.x, top: drag.point.y }}>
            {HERO_DECKS[selected.heroClass][drag.card]!.name}
          </div>
          {(drag.probe.label ?? drag.probe.blockedReason) && (
            <div className={`drag-label${drag.probe.blockedReason ? " blocked" : ""}`} style={{ left: drag.point.x, top: drag.point.y }}>
              {drag.probe.label ?? drag.probe.blockedReason}
            </div>
          )}
        </>
      )}
      <section className="commit-panel" aria-label="Commit">
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
