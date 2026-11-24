// The playback of one Resolution on the planning screen: after Commit, the frames of the Resolution are shown one by one
// (positions, Shield, Deck Damage, effects, Cover, commentary, sounds), then the callouts and the return to the next Round.
// The screen owns the state; this module only writes it through the `ports` and reads nothing back but what the ports say.

import { coverAt, EventKind, type GridPosition, type HeroClass, type SquadView, type SubmitResult, Visibility, type ZoneView } from "game-core";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { gameAudio } from "./audio";
import { planFrame } from "./audio-cues";
import type { Board } from "./Board";
import { CLIP_SPEED } from "./clip-player";
import { buildCommentary, type CommentaryEntry, type CommentarySide } from "./commentary";
import { addBurn, type BurnBatch, type BurnPending, NO_BURN_PENDING } from "./deck-burn";
import { addShuffle, NO_SHUFFLE_PENDING, type ShufflePending, type ShuffleStep } from "./deck-shuffle";
import type { ClipName } from "./hero-clips";
import { buildPlaybackFrames, enemyIsDrawn, STEP_MS, tickCountOf } from "./playback";
import { matchEndCallouts, type PrimeCallout, type SquadCounts, zoneCallouts } from "./prime-zone";
import type { ResolutionStage } from "./resolution-hud";
import { replayTargetLines, type TargetLine } from "./target-lines";
import { coverGridOf } from "./terrain";
import type { EffectCue } from "./weapon-effects";

/** Two sounds of one callout (a zone taken, then Credits) follow each other this far apart. */
const SOUND_GAP_MS = 450;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the screen shows of the Resolution being played, frame by frame. */
export interface PlaybackState {
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
  /** The tile each walking Hero comes from in the frame being shown (its figure glides to its new tile). */
  walks: Record<string, GridPosition>;
  /** The sight at the end of the Round and the positions of the Squad's Heroes at both ends: the fog follows the walk between them. */
  sightAfter: NonNullable<ComponentProps<typeof Board>["sightAfter"]>;
  aims: Record<string, string>;
  /** The effects of the attacks of the frame being shown. */
  effects: EffectCue[];
  /** Heroes Slowed or Marked so far in the playback: they carry it until the end of the next Resolution. */
  slowed: string[];
  marked: string[];
  /** The commentary of the Tick being shown. */
  commentary: CommentaryEntry[];
  /** The target lines of the actions resolved in the frame being shown. */
  lines: TargetLine[];
  /** Cover destroyed and Cover placed so far in the playback, each from the moment its effect shows it; the board adds them to the view's. */
  coverDestroyed: GridPosition[];
  coverPlaced: GridPosition[];
  /** The Cover placed so far in the playback by the Squad's own Heroes (the rest of `coverPlaced` is the enemy's). */
  coverPlacedOwn: GridPosition[];
  /** The tiles of `coverDestroyed` that leave no scorched outline (Placed Cover that went for a fourth). */
  coverNoScorch: GridPosition[];
}

/** What the playback writes on the screen's state. */
export interface PlaybackSetters {
  playback: Dispatch<SetStateAction<PlaybackState | undefined>>;
  burnQueue: Dispatch<SetStateAction<readonly (BurnBatch | ShuffleStep)[]>>;
  burnPending: Dispatch<SetStateAction<BurnPending>>;
  shufflePending: Dispatch<SetStateAction<ShufflePending>>;
  resolutionStage: Dispatch<SetStateAction<ResolutionStage | undefined>>;
  scoresAfter: Dispatch<SetStateAction<SquadCounts | undefined>>;
  zonesAfter: Dispatch<SetStateAction<readonly ZoneView[] | undefined>>;
  primeCallout: Dispatch<SetStateAction<PrimeCallout | undefined>>;
}

/** What the playback asks of the screen: who it is, how to word a Hero, whether the screen is gone, and the numbers it keeps in refs. */
export interface PlaybackPorts {
  view: SquadView;
  playerHeroClass: HeroClass;
  nameOf: (heroId: string) => string;
  sideOf: (heroId: string) => CommentarySide;
  isUnmounted: () => boolean;
  /** How many pile animations (burns, shuffles) are still queued. */
  queuedAnimations: () => number;
  /** The id for the next pile animation. */
  nextBurnId: () => number;
  set: PlaybackSetters;
}

/** What is the same in every frame of one Resolution. */
interface ResolutionContext {
  view: SquadView;
  result: SubmitResult;
  playerHeroId: string;
  playerDeckCount: number;
  startPositions: Record<string, GridPosition>;
  /** The enemies the Squad sees at the start or at the end of the Resolution may be heard; the rest stay silent (Fog of War). */
  heardEnemies: ReadonlySet<string>;
  classes: ReadonlyMap<string, HeroClass>;
  ownHeroIds: ReadonlySet<string>;
  tickCount: number;
  sightAfter: PlaybackState["sightAfter"];
  /** Reduced motion plays no clips, so a frame lasts one step; otherwise until the slowest clip is back at rest. */
  reducedMotion: boolean;
}

/** What the frames add up to so far; the playback state is a copy of it at each frame. */
interface Accumulated {
  positions: Record<string, GridPosition>;
  shields: Record<string, number>;
  deckDamage: Record<string, number>;
  shuffled: Record<string, number>;
  exhausted: string[];
  slowed: string[];
  marked: string[];
  commentary: CommentaryEntry[];
  commentaryTick: number;
  coverDestroyed: GridPosition[];
  coverPlaced: GridPosition[];
  coverPlacedOwn: GridPosition[];
  coverNoScorch: GridPosition[];
}

type Frame = ReturnType<typeof buildPlaybackFrames>[number];

function contextOf(view: SquadView, result: SubmitResult, playerHeroClass: HeroClass): ResolutionContext {
  const playerHero = view.heroes.find((hero) => hero.heroClass === playerHeroClass)!;
  const heroPositions = (heroes: typeof view.heroes) => Object.fromEntries(heroes.map((hero) => [hero.id, hero.position]));
  return {
    view,
    result,
    playerHeroId: playerHero.id,
    playerDeckCount: playerHero.deckCount,
    startPositions: Object.fromEntries([...view.heroes, ...view.enemies].flatMap((unit) => ("position" in unit ? [[unit.id, unit.position]] : []))),
    heardEnemies: new Set([...view.enemies, ...result.view.enemies].filter((enemy) => enemy.visibility === Visibility.Visible).map((enemy) => enemy.id)),
    classes: new Map([...view.heroes, ...view.enemies].map((unit) => [unit.id, unit.heroClass])),
    ownHeroIds: new Set(view.heroes.map((hero) => hero.id)),
    tickCount: tickCountOf(result.events),
    sightAfter: { visibleTiles: result.view.visibleTiles, startPositions: heroPositions(view.heroes), endPositions: heroPositions(result.view.heroes) },
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function emptyAccumulated(): Accumulated {
  return {
    positions: {},
    shields: {},
    deckDamage: {},
    shuffled: {},
    exhausted: [],
    slowed: [],
    marked: [],
    commentary: [],
    commentaryTick: 0,
    coverDestroyed: [],
    coverPlaced: [],
    coverPlacedOwn: [],
    coverNoScorch: [],
  };
}

/** The playback state before the first frame: Tick 0, nothing moved. */
function startState(context: ResolutionContext, acc: Accumulated): PlaybackState {
  return {
    tick: 0,
    tickCount: context.tickCount,
    positions: acc.positions,
    shields: acc.shields,
    deckDamage: acc.deckDamage,
    shuffled: acc.shuffled,
    exhausted: acc.exhausted,
    hit: [],
    clips: {},
    clipDelays: {},
    walks: {},
    sightAfter: context.sightAfter,
    aims: {},
    effects: [],
    slowed: [],
    marked: [],
    commentary: [],
    lines: [],
    coverDestroyed: [],
    coverPlaced: [],
    coverPlacedOwn: [],
    coverNoScorch: [],
  };
}

/** Adds what one frame changes to the sums: moves, Shield, Deck Damage (hits) and the Heroes that were Exhausted or Slowed or Marked. */
function accumulateFrame(acc: Accumulated, frame: Frame): void {
  Object.assign(acc.positions, frame.moves);
  for (const [heroId, amount] of Object.entries(frame.shields)) acc.shields[heroId] = (acc.shields[heroId] ?? 0) + amount;
  for (const { targetId, damage, absorbed } of frame.hits) {
    acc.shields[targetId] = Math.max(0, (acc.shields[targetId] ?? 0) - absorbed);
    acc.deckDamage[targetId] = (acc.deckDamage[targetId] ?? 0) + damage;
  }
  acc.exhausted.push(...frame.exhausted);
  for (const cue of frame.effects) {
    if (cue.kind === "slow") acc.slowed.push(cue.toId);
    if (cue.kind === "marked") acc.marked.push(cue.toId);
  }
}

/**
 * Burns and shuffles queue in the order of the events, so a shuffle in the middle of a hit plays after the cards
 * burned before it and before the cards that burn after it.
 */
function queuePileAnimations(ports: PlaybackPorts, context: ResolutionContext, acc: Accumulated, frame: Frame): void {
  const { set } = ports;
  for (const event of frame.events) {
    const isOwn = context.view.heroes.some((hero) => hero.id === (event.targetId ?? event.heroId));
    if (event.kind === EventKind.AttackHit && (event.damage ?? 0) > 0 && isOwn) {
      const heroId = event.targetId!;
      set.burnPending((pending) => addBurn(pending, heroId, event.damage!));
      set.burnQueue((queued) => [...queued, { kind: "burn", id: ports.nextBurnId(), heroId, cards: event.damage! }]);
    }
    if (event.kind === EventKind.DeckShuffled) {
      acc.shuffled[event.heroId] = (acc.shuffled[event.heroId] ?? 0) + (event.amount ?? 0);
      if (event.heroId === context.playerHeroId) {
        const cards = event.amount ?? 0;
        set.shufflePending((pending) => addShuffle(pending, event.heroId, cards));
        set.burnQueue((queued) => [...queued, { kind: "shuffle", id: ports.nextBurnId(), heroId: event.heroId, cards }]);
      }
    }
  }
}

/** The commentary of the Tick of a frame, rebuilt only when the Tick changes. */
function updateCommentary(ports: PlaybackPorts, context: ResolutionContext, acc: Accumulated, frame: Frame): void {
  if (frame.tick === acc.commentaryTick) return;
  acc.commentaryTick = frame.tick;
  acc.commentary = buildCommentary(
    context.result.events.filter((event) => event.tick === frame.tick),
    { nameOf: ports.nameOf, sideOf: ports.sideOf },
  );
}

/** Shows the state of a frame: the playback state, the listener and the sounds of the frame. */
function showFrame(ports: PlaybackPorts, context: ResolutionContext, acc: Accumulated, frame: Frame): void {
  const { view } = context;
  const positionOf = (heroId: string) => acc.positions[heroId] ?? context.startPositions[heroId];
  ports.set.playback({
    tick: frame.tick,
    tickCount: context.tickCount,
    positions: { ...acc.positions },
    shields: { ...acc.shields },
    deckDamage: { ...acc.deckDamage },
    shuffled: { ...acc.shuffled },
    exhausted: [...acc.exhausted],
    hit: frame.hits.map((hit) => hit.targetId),
    clips: frame.clips,
    clipDelays: frame.delays,
    walks: frame.walks,
    sightAfter: context.sightAfter,
    aims: frame.aims,
    effects: frame.effects,
    slowed: [...acc.slowed],
    marked: [...acc.marked],
    commentary: acc.commentary,
    lines: replayTargetLines(frame.events, view.heroes, view.enemies, positionOf),
    coverDestroyed: acc.coverDestroyed,
    coverPlaced: acc.coverPlaced,
    coverPlacedOwn: acc.coverPlacedOwn,
    coverNoScorch: acc.coverNoScorch,
  });
  gameAudio.setListener(positionOf(context.playerHeroId)!);
  gameAudio.play(
    planFrame(
      frame,
      gameAudio.contextFor({
        classOf: (heroId) => context.classes.get(heroId),
        isOwn: (heroId) => context.ownHeroIds.has(heroId),
        isHeard: (heroId) => context.ownHeroIds.has(heroId) || (context.heardEnemies.has(heroId) && enemyIsDrawn(frame.clips[heroId])),
        tileOf: positionOf,
        immediate: context.reducedMotion,
      }),
    ),
    positionOf(context.playerHeroId),
  );
}

/** Puts one Cover edit of a frame into the sums: Cover destroyed (and its scorch) or Cover placed (and whose it is). */
function applyCoverEdit(acc: Accumulated, edit: Frame["coverEdits"][number], ownHeroIds: ReadonlySet<string>): void {
  const isTile = (tile: GridPosition) => tile.col === edit.tile.col && tile.row === edit.tile.row;
  if (edit.kind === "destroyed") {
    acc.coverPlaced = acc.coverPlaced.filter((tile) => !isTile(tile));
    acc.coverPlacedOwn = acc.coverPlacedOwn.filter((tile) => !isTile(tile));
    acc.coverDestroyed = [...acc.coverDestroyed, edit.tile];
    // Placed Cover that goes because a fourth was placed leaves no scorched outline.
    if (edit.scorch === false) acc.coverNoScorch = [...acc.coverNoScorch, edit.tile];
  } else {
    acc.coverPlaced = [...acc.coverPlaced, edit.tile];
    if (edit.casterId !== undefined && ownHeroIds.has(edit.casterId)) acc.coverPlacedOwn = [...acc.coverPlacedOwn, edit.tile];
  }
}

/**
 * Waits through the hold of a frame; Cover that is placed or destroyed changes the board at the moment its effect shows it (at once with
 * reduced motion). Returns false when the screen was left meanwhile.
 */
async function holdFrame(ports: PlaybackPorts, context: ResolutionContext, acc: Accumulated, frame: Frame): Promise<boolean> {
  const hold = context.reducedMotion ? STEP_MS : Math.max(STEP_MS, frame.holdMs / CLIP_SPEED);
  let waited = 0;
  for (const edit of [...frame.coverEdits].sort((a, b) => a.atMs - b.atMs)) {
    const at = context.reducedMotion ? 0 : Math.min(hold, edit.atMs / CLIP_SPEED);
    await wait(at - waited);
    if (ports.isUnmounted()) return false;
    waited = at;
    applyCoverEdit(acc, edit, context.ownHeroIds);
    const [destroyedNow, placedNow, ownNow, noScorchNow] = [acc.coverDestroyed, acc.coverPlaced, acc.coverPlacedOwn, acc.coverNoScorch];
    ports.set.playback((current) => current && { ...current, coverDestroyed: destroyedNow, coverPlaced: placedNow, coverPlacedOwn: ownNow, coverNoScorch: noScorchNow });
  }
  await wait(hold - waited);
  return !ports.isUnmounted();
}

/** The callouts after the Resolution (zones taken, the end of the match), one after the other. Returns false when the screen was left meanwhile. */
async function playCallouts(ports: PlaybackPorts, context: ResolutionContext): Promise<boolean> {
  const { view, result } = context;
  const callouts = [...zoneCallouts(view.zones, result.view.zones, view.squad), ...matchEndCallouts(result.view.result, view.squad)];
  for (const callout of callouts) {
    // Unmount between two callouts so that two with the same text both play.
    ports.set.primeCallout(undefined);
    await wait(0);
    ports.set.primeCallout(callout);
    callout.sounds?.forEach((sound, index) => gameAudio.playUi(sound, index * SOUND_GAP_MS));
    await wait(callout.durationMs);
    if (ports.isUnmounted()) return false;
  }
  return true;
}

/** Lets the pile animations that are still queued (a shuffle at the very end of the Resolution) play out. Returns false when the screen was left meanwhile. */
async function waitForPileAnimations(ports: PlaybackPorts): Promise<boolean> {
  const patience = Date.now() + 10_000;
  while (ports.queuedAnimations() > 0 && Date.now() < patience) {
    await wait(100);
    if (ports.isUnmounted()) return false;
  }
  return true;
}

/** The Deck count the Resolution left for the player's Hero, to see whether the next draw shuffles the Discard in. */
export const deckLeftAfter = (playerDeckCount: number, deckDamage: number, shuffled: number): number => playerDeckCount - deckDamage + shuffled;

/**
 * Plays the frames of a Resolution on the screen, then its callouts, and clears the playback state. Returns the Deck count the
 * Resolution left for the player's Hero, or `undefined` when the screen was left before the playback ended. The caller clears the
 * rest of the screen (Queue, Hand state) and tells the app about the next Round.
 */
export async function playResolution(ports: PlaybackPorts, result: SubmitResult): Promise<number | undefined> {
  const { set } = ports;
  const context = contextOf(ports.view, result, ports.playerHeroClass);
  const acc = emptyAccumulated();
  set.resolutionStage("ticks");
  set.playback(startState(context, acc));
  const grid = coverGridOf(context.view.destroyedCover, context.view.placedCover, context.view.wreckCover);
  for (const frame of buildPlaybackFrames(result.events, (heroId) => context.classes.get(heroId), (tile) => coverAt(grid, tile))) {
    accumulateFrame(acc, frame);
    queuePileAnimations(ports, context, acc, frame);
    updateCommentary(ports, context, acc, frame);
    showFrame(ports, context, acc, frame);
    if (!(await holdFrame(ports, context, acc, frame))) return undefined;
  }
  set.resolutionStage("done");
  set.scoresAfter(result.view.scores);
  // The zones after the Resolution: the callouts play one after the other.
  set.zonesAfter(result.view.zones);
  if (!(await playCallouts(ports, context))) return undefined;
  if (!(await waitForPileAnimations(ports))) return undefined;
  const left = deckLeftAfter(context.playerDeckCount, acc.deckDamage[context.playerHeroId] ?? 0, acc.shuffled[context.playerHeroId] ?? 0);
  set.burnQueue([]);
  set.burnPending(NO_BURN_PENDING);
  set.shufflePending(NO_SHUFFLE_PENDING);
  set.playback(undefined);
  set.resolutionStage(undefined);
  set.scoresAfter(undefined);
  set.zonesAfter(undefined);
  set.primeCallout(undefined);
  return left;
}
