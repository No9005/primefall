import {
  CoverKind,
  coverAt,
  type Grid,
  type GridPosition,
  type HeroClass,
  type RangeTile,
  type RevealedArea,
  type ScrapFieldView,
  findTiles,
  NOTSTROM_MAP,
  TileKind,
  tileAt,
} from "game-core";
import { Container, Graphics, Text } from "pixi.js";
import { BOARD_SCENE_NAME, type BoardClock, type BoardLayers, boardScene } from "./board-scene";
import { attachBoardInput, BoardGestures } from "./board-gestures";
import { StageLayer } from "./StageLayer";
import { LASER_FLICKER_MS, laserWallAlpha } from "./prime-zone";
import { areaColorOf, COVER_OWN, coverTag, dashedTileOutline, drawLaserWalls, drawOutposts, drawScoutArea, drawScrapField, drawTerrain, drawZone, ghostMark, scannedMark, scoutDroneMark } from "./board-drawing";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import type { BoardPick, Point } from "./card-drag";
import {
  beginMoveFraming,
  type Camera,
  type CameraView,
  endMoveFraming,
  fitCamera,
  frameMoveCamera,
  frameSquadCamera,
  type MoveFraming,
  takeOverFraming,
  gridToWorld,
  isZoomed,
  pickTileAt,
  resolveTap,
  TILE_HEIGHT,
  TILE_WIDTH,
  viewToWorld,
  zoomOnPoint,
} from "./board-layout";
import { freeBoardArea } from "./hud-layout";
import { FogClouds, type FogWalker, fogDuringWalk, fogShape } from "./fog-clouds";
import { coverLook, depthOf, floorOutline, footOffset, coverGridOf, lineScale, litTiles, withoutCover } from "./terrain";
import { CLIP_SPEED, ClipPlayer } from "./clip-player";
import { EffectsLayer, type EffectsWorld, hiddenSeenMark, markedMark, shieldMark, slowMark, STATUS_AT_REST_MS, type StatusMark } from "./effects-layer";
import { type EffectCue, slideProgress } from "./weapon-effects";
import { baseFacing, type Facing, turnHeroes } from "./facing";
import { walkProgress } from "./playback";
import { areaContains, areaLift, areaRing, canMove, enemyFade, finished, GHOST_ALPHA, GHOST_FADE_MS, TRANSITION_MS, type ZoneLook, zoneBorderAlpha, zoneRingAt } from "./vision-effects";
import { type ClipName, restClipName } from "./hero-clips";
import { enemyIsDrawn } from "./playback";
import { type HeroPose, marksFigure, shieldBubble } from "./hero-figure";
import { type PixelHero, styledHeroFigure } from "./heroes";
import { HERO_STYLE } from "./hero-style";
import type { HeroMarks } from "./shield-marks";
import { chestOf, dashRuns, SegmentStyle, type ShotDrawing, shotInWorld, type ShotInWorld } from "./shot-lines";
import { finalTile, PathOwner, type PlannedPath } from "./ally-paths";
import { type CoverPlan, type CrossfireRing, type EffectPath, LineKind, NO_COVER_PLAN, LineTone, RingSegment, type TargetLine } from "./target-lines";
import { PLAN_STYLE, SHOT_STYLE, TERRAIN_STYLE } from "./terrain-style";
import { pulseAlpha } from "./target-pick";
import { type PixelAtlas, PixelScenery } from "./pixel-terrain";

/** Every animation of the board follows this clock, which the stage ticker moves (ADR 0026, rule 4). */
const clock = boardScene.clock;

/** Strokes `segment` as a run of dashes: long for a clear shot, dots for the stopped part, grey after a block. */
/** The still pose of a Hero's figure: Exhausted wins, then a hit (shown for reduced motion), else idle. */
function heroPose({ exhausted, hit }: { exhausted: boolean; hit: boolean }): HeroPose {
  if (exhausted) return "exhausted";
  return hit ? "hit" : "idle";
}

/** Whether the enemy was shown as a Ghost or as seen in the last frame, so the fade between the two can play. */
function previousSighting(heroId: string, ghosts: ReadonlySet<string>, seen: ReadonlySet<string>): "ghost" | "seen" | undefined {
  if (ghosts.has(heroId)) return "ghost";
  return seen.has(heroId) ? "seen" : undefined;
}

function strokeShotSegment(graphics: Graphics, { from, to, style }: ShotInWorld["segments"][number]): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) return;
  const dash = style === SegmentStyle.Stopped ? SHOT_STYLE.dot : SHOT_STYLE.dash;
  const color = SHOT_STYLE[style];
  for (let start = 0; start < length; start += dash + SHOT_STYLE.gap) {
    const end = Math.min(start + dash, length);
    graphics.moveTo(from.x + ((to.x - from.x) * start) / length, from.y + ((to.y - from.y) * start) / length);
    graphics.lineTo(from.x + ((to.x - from.x) * end) / length, from.y + ((to.y - from.y) * end) / length);
  }
  graphics.stroke({ width: SHOT_STYLE.width, color, alpha: style === SegmentStyle.Beyond ? 0.6 : 1, cap: "round" });
}

const COLLISION_COLOR = 0xe5484d;

/** A small round badge (a pill for longer text) with the Queue slot number, centred on (x, y). */
function slotBadge(text: string, x: number, y: number, color: number): Container {
  const badge = new Container();
  badge.position.set(x, y);
  const label = new Text({ text, style: { fill: PLAN_STYLE.badgeText, fontSize: 14, fontWeight: "700" } });
  label.anchor.set(0.5);
  const width = Math.max(20, label.width + 10);
  badge.addChild(new Graphics().roundRect(-width / 2, -10, width, 20, 10).fill(color), label);
  return badge;
}

/** A flat ring on a tile's floor. */
function tileRing(tile: GridPosition, color: number, fillAlpha = 0): Graphics {
  const { x, y } = gridToWorld(tile);
  const ring = new Graphics().ellipse(x, y, TILE_WIDTH * 0.3, TILE_HEIGHT * 0.3);
  if (fillAlpha > 0) ring.fill({ color, alpha: fillAlpha });
  return ring.stroke({ width: PLAN_STYLE.width, color });
}

/**
 * A planned path: a line from the Hero through its Move destinations. The player's has a ring and a numbered badge at each
 * destination and a ghost copy of the Hero on the final tile; an ally's is the bare line, very faint.
 * The line and the rings lie on the floor (`ground`); the ghost and the numbers are drawn above the props (`top`), so a
 * wall in front of the final tile never hides what the player planned.
 */
function pathGraphics(path: PlannedPath, scale: number): { ground: Container; top: Container } {
  const { owner, from, stops } = path;
  const own = owner === PathOwner.Player;
  const color = own ? PLAN_STYLE.own : PLAN_STYLE.ally;
  const container = new Container();
  const top = new Container();
  const line = new Graphics();
  const start = chestOf(from);
  line.moveTo(start.x, start.y);
  for (const { tile } of stops) {
    const point = chestOf(tile);
    line.lineTo(point.x, point.y);
  }
  line.stroke({ width: PLAN_STYLE.width, color, cap: "round", join: "round" });
  container.addChild(line);
  if (!own) {
    container.alpha = PLAN_STYLE.allyAlpha;
    return { ground: container, top };
  }
  const ghost = styledHeroFigure(path.heroClass, false, "idle", scale).figure;
  const foot = gridToWorld(finalTile(path));
  ghost.position.set(foot.x, foot.y + footOffset());
  ghost.alpha = PLAN_STYLE.ghostAlpha;
  top.addChild(ghost);
  for (const { tile, tick } of stops) {
    const { x, y } = gridToWorld(tile);
    container.addChild(tileRing(tile, color, PLAN_STYLE.ringFillAlpha));
    top.addChild(slotBadge(String(tick), x + TILE_WIDTH * 0.42, y, color));
  }
  return { ground: container, top };
}

const EFFECT_PATH_COLOR = 0x2ec4b6;
const COVER_AMBER = 0xffb347;
const F = HERO_STYLE.figureScale;

/**
 * The path of a queued Pull or Charge (docs/design/role-visuals/380/pull.png and charge.png): every tile teal with a
 * chevron that points the way it is travelled, and the tag over the Bruiser or the target. Pulls point to the Bruiser.
 */
function effectPathGraphics(path: EffectPath, scale: number): { ground: Container; top: Container } {
  const ground = new Container();
  const top = new Container();
  const diamond = floorOutline();
  for (const { tile, direction } of path.tiles) {
    const { x, y } = gridToWorld(tile);
    const floor = new Graphics().poly(diamond).fill({ color: EFFECT_PATH_COLOR, alpha: 0.22 }).stroke({ width: 1.5 / scale, color: EFFECT_PATH_COLOR, alpha: 0.8 });
    floor.position.set(x, y);
    ground.addChild(floor);
    // The chevron points along the screen direction of the step.
    const next = gridToWorld({ col: tile.col + direction.col, row: tile.row + direction.row });
    const dx = next.x - x;
    const dy = next.y - y;
    const length = Math.hypot(dx, dy) || 1;
    const along = { x: dx / length, y: dy / length };
    const across = { x: -along.y, y: along.x };
    const at = (forward: number, side: number) => ({ x: x + along.x * forward + across.x * side, y: y + along.y * forward + across.y * side });
    const chevron = new Graphics();
    const [a, b, c] = [at(-5 * F, 5.5 * F), at(3 * F, 0), at(-5 * F, -5.5 * F)];
    chevron.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).stroke({ width: 2.5 / scale, color: EFFECT_PATH_COLOR, cap: "round", join: "round" });
    ground.addChild(chevron);
  }
  const { x, y } = gridToWorld(path.tagTile);
  const tag = new Text({ text: path.tag, style: { fontFamily: "IBM Plex Mono", fontSize: 9 * F, fontWeight: "700", fill: EFFECT_PATH_COLOR, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 1);
  tag.position.set(x, y - TILE_HEIGHT * 1.9);
  top.addChild(tag);
  return { ground, top };
}

/** The red cross on the destination of a Move that will fail through another Hero of the Squad. */
function collisionCross(tile: GridPosition): Graphics {
  const { x, y } = chestOf(tile);
  const size = 12;
  return new Graphics()
    .moveTo(x - size, y - size)
    .lineTo(x + size, y + size)
    .moveTo(x + size, y - size)
    .lineTo(x - size, y + size)
    .stroke({ width: 6, color: COLLISION_COLOR, cap: "round" });
}

const RING_GAP = 0.12;

/** A badge scaled about its own centre: the planning camera is zoomed out, so the ring's numbers must stay readable. */
function enlarged(badge: Container): Container {
  badge.scale.set(1.8);
  return badge;
}
const NO_RINGS: readonly CrossfireRing[] = [];
const NO_EFFECT_PATHS: readonly EffectPath[] = [];


/**
 * The Tick ring under an enemy a plan attacks: four 90° arcs on the floor, Tick 1 at the top and clockwise. An attacked Tick
 * is a thick teal arc (orange when it may be a Crossfire) with its number outside the ring; a free Tick is thin and steel.
 * A chip "+1 ?" above the target says a Crossfire may happen (the Attacks can still miss).
 */
function crossfireRingGraphics(ring: CrossfireRing): { ground: Container; top: Container } {
  const ground = new Container();
  const top = new Container();
  const centre = gridToWorld(ring.position);
  // Under the Hero's feet, not under the middle of the tile.
  const x = centre.x;
  const y = centre.y + footOffset();
  const rx = TILE_WIDTH * 0.62;
  const ry = TILE_HEIGHT * 0.62;
  const at = (theta: number, scale = 1) => ({ x: x + Math.cos(theta) * rx * scale, y: y + Math.sin(theta) * ry * scale });
  const arcs = new Graphics();
  const labels: Container[] = [];
  ring.segments.forEach((segment, index) => {
    const start = -Math.PI / 2 + (index * Math.PI) / 2 + RING_GAP;
    const end = start + Math.PI / 2 - 2 * RING_GAP;
    const active = segment !== RingSegment.Empty;
    const plainColor = active ? PLAN_STYLE.own : PLAN_STYLE.steel;
    const color = segment === RingSegment.Crossfire ? PLAN_STYLE.crossfire : plainColor;
    const first = at(start);
    arcs.moveTo(first.x, first.y);
    for (let step = 1; step <= 8; step++) {
      const point = at(start + ((end - start) * step) / 8);
      arcs.lineTo(point.x, point.y);
    }
    arcs.stroke({ width: active ? 7 : 4, color, alpha: active ? 1 : 0.7, cap: "round" });
    if (!active) return;
    const label = at((start + end) / 2, 1.3);
    labels.push(enlarged(slotBadge(String(index + 1), label.x, label.y, color)));
  });
  ground.addChild(arcs);
  top.addChild(...labels);
  if (ring.segments.includes(RingSegment.Crossfire)) top.addChild(enlarged(slotBadge("+1 ?", x, y - TILE_HEIGHT * 2.1, PLAN_STYLE.crossfire)));
  return { ground, top };
}

type Chest = ReturnType<typeof chestOf>;

/** An ally's plan: the bare line in yellow, no badge, no ring. */
function allyTargetLine(container: Container, line: TargetLine, from: Chest, to: Chest): Container {
  const dashed = line.kind === LineKind.Attack;
  const graphics = new Graphics();
  for (const run of dashed ? dashRuns(from, to, PLAN_STYLE.dash, PLAN_STYLE.dashGap) : [{ from, to }]) graphics.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
  container.addChild(graphics.stroke({ width: PLAN_STYLE.width, color: PLAN_STYLE.ally, cap: "round" }));
  container.alpha = PLAN_STYLE.allyAlpha;
  return container;
}

/** The player's Attack: dashed teal from chest to chest; red and dotted with "!" when the target cannot be reached. */
function plannedAttackLine(container: Container, line: TargetLine, from: Chest, to: Chest): Container {
  const color = line.unreachable ? PLAN_STYLE.danger : PLAN_STYLE.own;
  const graphics = new Graphics();
  const [dash, gap] = line.unreachable ? [PLAN_STYLE.dot, PLAN_STYLE.dotGap] : [PLAN_STYLE.dash, PLAN_STYLE.dashGap];
  for (const run of dashRuns(from, to, dash, gap)) graphics.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
  container.addChild(graphics.stroke({ width: PLAN_STYLE.width, color, cap: "round" }), tileRing(line.to, PLAN_STYLE.danger));
  container.addChild(slotBadge(`${line.tick}${line.unreachable ? "!" : ""}`, (from.x + to.x) / 2, (from.y + to.y) / 2, color));
  return container;
}

/** A target line: the shot drawing for an Attack, an arrow to an allied Hero, a ring on a tile; the Tick sits in the middle. */
function targetLineGraphics(line: TargetLine): Container {
  const container = new Container();
  const from = chestOf(line.from);
  const to = chestOf(line.to);
  if (line.planned && line.faint) return allyTargetLine(container, line, from, to);
  if (line.planned && line.kind === LineKind.Attack) return plannedAttackLine(container, line, from, to);
  const color = line.tone === LineTone.Clear ? SHOT_STYLE.clear : SHOT_STYLE.stopped;
  if (line.kind === LineKind.Attack && line.shot) {
    // An enemy's shot is always red, whatever the segment says.
    const shot = line.own ? line.shot : { ...line.shot, segments: line.shot.segments.map((segment) => ({ ...segment, style: SegmentStyle.Stopped })) };
    container.addChild(shotGraphics(shot));
  } else {
    const graphics = new Graphics().moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: SHOT_STYLE.width, color, cap: "round" });
    container.addChild(graphics);
  }
  if (line.tone === LineTone.Clear || line.kind === LineKind.Tile) {
    const { x, y } = gridToWorld(line.to);
    const ring = new Graphics().poly(floorOutline().map((value, index) => value + (index % 2 === 0 ? x : y))).stroke({ width: 4, color });
    container.addChild(ring);
  }
  container.addChild(slotBadge(String(line.tick), (from.x + to.x) / 2, (from.y + to.y) / 2, color));
  return container;
}

function shotGraphics(drawing: ShotDrawing): Graphics {
  const { segments, cross } = shotInWorld(drawing);
  const graphics = new Graphics();
  if (drawing.coverTile) {
    const { x, y } = gridToWorld(drawing.coverTile);
    graphics.poly(floorOutline().map((value, index) => value + (index % 2 === 0 ? x : y))).stroke({ width: 5, color: SHOT_STYLE.cover });
  }
  segments.forEach((segment) => strokeShotSegment(graphics, segment));
  if (cross) {
    const size = 12;
    graphics.moveTo(cross.x - size, cross.y - size).lineTo(cross.x + size, cross.y + size);
    graphics.moveTo(cross.x + size, cross.y - size).lineTo(cross.x - size, cross.y + size);
    graphics.stroke({ width: 6, color: SHOT_STYLE.stopped, cap: "round" });
  }
  return graphics;
}

/** A numbered marker on a tile: the destination of a planned action. */
export interface BoardMarker {
  position: GridPosition;
  label: string;
}

export interface TokenHero {
  id: string;
  heroClass: HeroClass;
  position: GridPosition;
  exhausted: boolean;
  /** Slowed Heroes show a Slow indicator; only Visible and own Heroes ever carry it. */
  slowed?: boolean;
  /** A Hidden Hero of the player's Squad is drawn translucent. */
  hidden?: boolean;
  /** A Ghost: drawn faded at its last known position and not selectable as a target. */
  ghost?: boolean;
  /** Marked: the enemy Squad sees this Hero; drawn with a marker above the token. */
  marked?: boolean;
}

/** The containers the terrain is drawn into. */
interface Terrain {
  floor: Container;
  objects: Container;
  planning: Container;
  /** The tileset of the Pixel art style; absent in the Original style. */
  atlas?: PixelAtlas;
}

/** The middle of the Prime Zone tiles (the zone is drawn faintly even in the fog, so using it reveals nothing). */
function zoneCentre(): GridPosition | undefined {
  const tiles = findTiles(NOTSTROM_MAP, TileKind.PrimeZone);
  if (tiles.length === 0) return undefined;
  return { col: tiles.reduce((sum, t) => sum + t.col, 0) / tiles.length, row: tiles.reduce((sum, t) => sum + t.row, 0) / tiles.length };
}

interface BoardProps {
  /** Cover tiles the Squad has seen destroyed; the board draws them as open floor. */
  destroyedCover: readonly GridPosition[];
  /** Placed Cover the Squad knows of (it stays until destroyed): drawn as Half Cover with a cyan outline. */
  placedCover: readonly GridPosition[];
  /** The tiles of `placedCover` that belong to the player's Squad, oldest first (the rest is the enemy's). Absent: all of them. */
  ownPlacedCover?: readonly GridPosition[];
  /** Planning only: the oldest Placed Cover that goes when the planned placements are made, and the tiles the new ones will stand on. */
  coverPlan?: CoverPlan;
  /** Half Cover left by Exhausted Heroes the Squad knows of: a low slab under the downed figure. */
  wreckCover: readonly GridPosition[];
  /** Areas a Scout Drone reveals: tinted yellow. */
  revealedAreas: readonly RevealedArea[];
  /** Scrap Fields the Squad knows: violet tiles with scrap and wire, and the Resolutions left. */
  scrapFields?: readonly ScrapFieldView[];
  /** Areas the enemy's Scout Drones scan: a red outline, nothing about what is in them. */
  scannedAreas?: readonly Pick<RevealedArea, "center" | "size" | "remaining">[];
  /** Tiles the Squad sees; every other tile is drawn dark. */
  visibleTiles: readonly GridPosition[];
  heroes: readonly TokenHero[];
  enemies: readonly TokenHero[];
  selectedId: string;
  onSelect: (heroId: string) => void;
  /** Heroes (enemies for an Attack, this or allied Heroes for a Utility card) the player may pick as target right now. */
  targetableIds: readonly string[];
  onTargetTap: (heroId: string) => void;
  /** Heroes shown as hit (during the playback frame in which they took an Attack). */
  hitIds: readonly string[];
  /** The clip each Hero plays during the playback frame being shown (a Step walks, a Wait waits); Heroes not listed idle. */
  clips?: Readonly<Record<string, ClipName>>;
  /** Milliseconds after the start of the frame at which a Hero's clip starts (a target reacts at the impact beat). */
  clipDelays?: Readonly<Record<string, number>>;
  /** The tile each walking Hero comes from in the playback frame being shown: its figure glides from there to its tile. */
  walks?: Readonly<Record<string, GridPosition>>;
  /**
   * During a Resolution: where the Heroes of the Squad stand at the start and at the end of the Round and what the Squad sees at
   * the end (`visibleTiles` is the start). The fog lifts and closes as the Heroes walk between the two (`fogDuringWalk`); it ends
   * as the Squad View of the next Round.
   */
  sightAfter?: {
    visibleTiles: readonly GridPosition[];
    startPositions: Readonly<Record<string, GridPosition>>;
    endPositions: Readonly<Record<string, GridPosition>>;
  };
  /** The target of each attacker with one aimed target in the playback frame being shown: the attacker turns towards it. */
  aims?: Readonly<Record<string, string>>;
  /** The effects of the attacks of the playback frame being shown (flash, projectile, impact, numbers, Marked and Slow). */
  effects?: readonly EffectCue[];
  /** Tiles the player may tap right now. */
  highlights: readonly GridPosition[];
  markers: readonly BoardMarker[];
  onTileTap: (tile: GridPosition) => void;
  /** Position of the Hero whose Move (or tile pick) is armed: while set, the camera eases to it and its highlights, inside the free area. */
  moveFrameHero?: GridPosition;
  /** A faint tint over the Prime Zone tiles: teal while the own Squad holds it, amber while contested, steel otherwise. */
  zoneTint: ZoneLook;
  /** The Prime Zone is not active yet: red laser walls stand around it, above the fog. They flicker and drop when it becomes active. */
  primeWalls?: boolean;
  /** While a card is dragged: short labels on the Heroes or tiles that take a drop. */
  zoneLabels: readonly { position: GridPosition; text: string }[];
  /** While a card is dragged: a tinted area (the Range of a card played here). */
  areaTiles: readonly GridPosition[];
  /** While a target is picked: the Range of the used card under the acting Hero, red; Walls and Full Cover grey. */
  rangeArea?: readonly RangeTile[];
  /** The tile a dragged card would be dropped on (after snapping), drawn like a pressed tile. */
  dropTile?: GridPosition;
  /** While aiming an Attack: the lines of fire to Visible enemies. A target whose shot cannot hit is not ringed. */
  shotLines: readonly ShotDrawing[];
  /** Planning only: the queued Moves of the player's Hero (teal) and the AI allies (yellow). */
  paths: readonly PlannedPath[];
  /** Who targets whom: queued actions while planning, the actions of the current Tick during the replay. */
  targetLines: readonly TargetLine[];
  /** Planning only: the Tick rings under the enemies the own plans attack. */
  crossfireRings?: readonly CrossfireRing[];
  /** Planning only: the tiles a queued Pull or Charge would carry a Hero over, with chevrons and a tag. */
  effectPaths?: readonly EffectPath[];
  /** Shield rubies, the shield bubble and planned-action icons per Hero id; Heroes without an entry have none. */
  marks: Readonly<Record<string, HeroMarks>>;
  /** Planning only: destinations of Moves that will fail through another Hero of the Squad. */
  collisionTiles: readonly GridPosition[];
  /** Filled with a function that tells what the board has under a viewport point, for dropping a dragged card. */
  pickRef: MutableRefObject<((point: Point) => BoardPick) | undefined>;
  /** Filled with a function that tells where a Hero is on screen (viewport pixels), to place the card sheet beside it. */
  heroScreenRef?: MutableRefObject<((heroId: string) => Point | undefined) | undefined>;
  /** The whole board at the fitted camera, as the side screen preview shows it (no framing of the Squad). */
  overview?: boolean;
}

const NO_RANGE: readonly RangeTile[] = [];
const NO_CLIPS: Readonly<Record<string, ClipName>> = {};
const NO_DELAYS: Readonly<Record<string, number>> = {};
const NO_WALKS: Readonly<Record<string, GridPosition>> = {};
const NO_AIMS: Readonly<Record<string, string>> = {};
const NO_EFFECTS: readonly EffectCue[] = [];
const RANGE_COLOR = 0xe5484d;
const RANGE_BLOCKED_COLOR = 0x8a99a8;
const RANGE_ALPHA = 0.27;


/** Runs `step` on the scene clock with the time since now until it returns true or the returned cancel function is called. */
function runFor(clock: BoardClock, step: (elapsedMs: number) => boolean): () => void {
  const start = clock.now();
  const stop = clock.subscribe((now) => {
    if (step(now - start)) stop();
  });
  return stop;
}

/** Grows a shape from small and transparent to full size in `ms`; with reduced motion it just shows. Returns a cancel function. */
function animateAppear(clock: BoardClock, shape: Graphics, ms: number): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  shape.alpha = 0;
  shape.scale.set(0.4);
  return runFor(clock, (elapsed) => {
    const t = Math.min(1, elapsed / ms);
    shape.alpha = t;
    shape.scale.set(0.4 + 0.6 * t);
    return t >= 1;
  });
}

/** Fades a figure between the real figure and its Ghost; with reduced motion the caller does not call this. Returns a cancel function. */
function animateFade(clock: BoardClock, figure: Container, kind: "toGhost" | "toSeen" | "appear"): () => void {
  figure.alpha = enemyFade(kind, 0);
  return runFor(clock, (elapsed) => {
    figure.alpha = enemyFade(kind, elapsed);
    return finished(elapsed, GHOST_FADE_MS);
  });
}

/** Fades a shape from full to transparent in `ms`. Returns a cancel function. */
function animateFadeOut(clock: BoardClock, shape: Graphics, ms: number): () => void {
  return runFor(clock, (elapsed) => {
    const t = Math.min(1, elapsed / ms);
    shape.alpha = 1 - t;
    shape.scale.set(1 + 0.2 * t);
    return t >= 1;
  });
}

/** Length of the camera ease when a Move is armed, placed or cancelled. */
const FRAME_MS = 250;

const NO_SCANNED_AREAS: readonly Pick<RevealedArea, "center" | "size" | "remaining">[] = [];
const NO_SCRAP_FIELDS: readonly ScrapFieldView[] = [];
/** Red outline of an area the enemy scans. */

function useBoardInputs(p: BoardProps) {
  const {
    destroyedCover,
    placedCover,
    ownPlacedCover,
    coverPlan = NO_COVER_PLAN,
    wreckCover,
    revealedAreas,
    scannedAreas = NO_SCANNED_AREAS,
    scrapFields = NO_SCRAP_FIELDS,
    visibleTiles,
    heroes,
    enemies,
    selectedId,
    onSelect,
    targetableIds,
    onTargetTap,
    hitIds,
    clips = NO_CLIPS,
    clipDelays = NO_DELAYS,
    walks = NO_WALKS,
    sightAfter,
    aims = NO_AIMS,
    effects = NO_EFFECTS,
    highlights,
    markers,
    onTileTap,
    moveFrameHero,
    zoneTint,
    primeWalls = false,
    zoneLabels,
    areaTiles,
    rangeArea = NO_RANGE,
    dropTile,
    shotLines,
    targetLines,
    crossfireRings = NO_RINGS,
    effectPaths = NO_EFFECT_PATHS,
    marks,
    paths,
    collisionTiles,
    pickRef,
    heroScreenRef,
    overview = false,
  } = p;
  return { destroyedCover, placedCover, ownPlacedCover, coverPlan, wreckCover, revealedAreas, scannedAreas, scrapFields, visibleTiles, heroes, enemies, selectedId, onSelect, targetableIds, onTargetTap, hitIds, clips, clipDelays, walks, sightAfter, aims, effects, highlights, markers, onTileTap, moveFrameHero, zoneTint, primeWalls, zoneLabels, areaTiles, rangeArea, dropTile, shotLines, targetLines, crossfireRings, effectPaths, marks, paths, collisionTiles, pickRef, heroScreenRef, overview };
}
type Ctx1 = BoardProps & ReturnType<typeof useBoardInputs>;

function useBoardLayers(p: Ctx1) {
  const { destroyedCover, placedCover, wreckCover, overview } = p;
  const input = useRef<HTMLDivElement>(null);
  // The overview (side screen preview) shows the zones but not the Cover: where the goal is, not what the cover looks like.
  const coverGrid = useMemo(() => {
    const grid = coverGridOf(destroyedCover, placedCover, wreckCover);
    return overview ? withoutCover(grid) : grid;
  }, [destroyedCover, placedCover, wreckCover, overview]);
  // The containers of the board scene; they are new after a lost WebGL context, and everything below is drawn into them again.
  const [layers, setLayers] = useState<BoardLayers>();
  useEffect(() => boardScene.watchLayers(setLayers), []);
  const tokens = layers?.objects;
  // The layer of the attack effects (above the Heroes) and the world it shakes.
  const effectsHost = useMemo(() => layers && { layer: layers.effects, world: layers.world }, [layers]);
  const overlay = layers?.planning;
  /** The layer of the Fog of War clouds: above the floor and the props, below the planning marks and the effects. */
  const fogLayer = layers?.fog;
  const wallsWereUp = useRef(false);
  /** Above the props and the Heroes, below the effects: the ghost and the numbers of the planned paths. */
  const overlayTop = layers?.planningTop;
  const terrain = useMemo<Terrain | undefined>(() => layers && { floor: layers.floor, objects: layers.objects, planning: layers.planning, atlas: layers.atlas }, [layers]);
  const [scenery, setScenery] = useState<PixelScenery>();
  return { input, coverGrid, tokens, effectsHost, overlay, fogLayer, wallsWereUp, overlayTop, terrain, layers, scenery, setScenery };
}
type Ctx2 = Ctx1 & ReturnType<typeof useBoardLayers>;

function useLatestRefs(p: Ctx2) {
  const { heroes, enemies, onSelect, targetableIds, onTargetTap, highlights, onTileTap } = p;
  // Always the latest callbacks, so the pixi sprites need not be rebuilt for them.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTargetTapRef = useRef(onTargetTap);
  onTargetTapRef.current = onTargetTap;
  const onTileTapRef = useRef(onTileTap);
  onTileTapRef.current = onTileTap;
  // One tap handler on the stage picks in isometric space; it reads the latest candidates from here.
  const candidatesRef = useRef({ heroes: [...heroes, ...enemies], targetableIds, highlights });
  candidatesRef.current = { heroes: [...heroes, ...enemies], targetableIds, highlights };
  const ownPositionsRef = useRef<GridPosition[]>([]);
  ownPositionsRef.current = heroes.map((hero) => hero.position);
  const enemyIdsRef = useRef(new Set<string>());
  enemyIdsRef.current = new Set(enemies.map((hero) => hero.id));
  return { onSelectRef, onTargetTapRef, onTileTapRef, candidatesRef, ownPositionsRef, enemyIdsRef };
}
type Ctx3 = Ctx2 & ReturnType<typeof useLatestRefs>;

function useSeenRefs(p: Ctx3) {
  const { zoneTint } = p;
  const bubbleSeen = useRef(new Set<string>());
  const { color: zoneColor, alpha: zoneAlpha, emblemAlpha: zoneEmblemAlpha, ring: zoneRingOn } = zoneTint;
  const areaSeen = useRef(new Map<string, { center: GridPosition; size: number }>());
  const ringSeen = useRef("");
  /** Enemy Heroes shown as a Ghost in the last redraw, to fade a change between Ghost and real figure. */
  const ghostSeen = useRef(new Set<string>());
  const enemiesSeen = useRef(new Set<string>());
  /** The enemies were drawn at least once, so an enemy that is new in the view came into sight and did not just load with the board. */
  const enemiesDrawn = useRef(false);
  return { bubbleSeen, areaSeen, ringSeen, ghostSeen, enemiesSeen, enemiesDrawn, zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn };
}
type Ctx4 = Ctx3 & ReturnType<typeof useSeenRefs>;

function useFrameRefs(p: Ctx4) {
  const { effects, shotLines } = p;
  // When the playback frame being shown started. The Shield and the Knockback slide of the Heroes follow it, so a redraw of
  // the figures in the middle of a frame (Cover that changes) does not start them again.
  const frameClock = useRef(clock.now());
  // Aiming an Attack is the state that draws lines of fire.
  const aiming = shotLines.length > 0;
  const frameOfEffects = useRef(effects);
  if (frameOfEffects.current !== effects) {
    frameOfEffects.current = effects;
    frameClock.current = clock.now();
  }
  return { frameClock, aiming };
}
type Ctx5 = Ctx4 & ReturnType<typeof useFrameRefs>;

function useFigureRefs(p: Ctx5) {
  const { heroes, enemies, selectedId, walks, aims } = p;
  // One clip player per Hero; the figures are drawn again for every frame, the players (and their cross-fades) are not.
  const clipPlayers = useRef(new Map<string, ClipPlayer>());
  const [pressed, setPressed] = useState<GridPosition>();
  // The camera scale in steps; outlines are drawn in world pixels of `1 / strokeScale` so they keep their width on screen.
  const [strokeScale, setStrokeScale] = useState(1);
  // The way each Hero that has walked faces (presentation only). A Step turns it at once; it lasts until the next Step and
  // is dropped when the playback ends, so the next planning phase shows the base facing. Figures are rebuilt every frame,
  // so it is kept here.
  const facings = useRef(new Map<string, Facing>());
  const turnsOfFrame = useRef({ walks, aims });
  if (turnsOfFrame.current.walks !== walks || turnsOfFrame.current.aims !== aims) {
    turnsOfFrame.current = { walks, aims };
    if (walks === NO_WALKS) facings.current.clear();
    turnHeroes(
      facings.current,
      { walks, aims },
      (id) => {
        const enemy = enemies.some((hero) => hero.id === id);
        const position = (enemy ? enemies : heroes).find((hero) => hero.id === id)?.position;
        return position && { position, enemy };
      },
    );
  }
  const cameraControl = useRef<{ toggle: () => void; frame: (hero: GridPosition) => void; release: () => void } | undefined>(
    undefined,
  );
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  return { clipPlayers, facings, cameraControl, selectedIdRef, pressed, setPressed, strokeScale, setStrokeScale };
}
type Ctx6 = Ctx5 & ReturnType<typeof useFigureRefs>;

function useMoveFrameEffect(p: Ctx6) {
  const { moveFrameHero, cameraControl } = p;
  // Arming a Move frames the Hero and its highlights; placing or cancelling it returns to the previous view.
  const frameCol = moveFrameHero?.col;
  const frameRow = moveFrameHero?.row;
  useEffect(() => {
    if (frameCol === undefined || frameRow === undefined) return;
    cameraControl.current?.frame({ col: frameCol, row: frameRow });
    return () => cameraControl.current?.release();
  }, [frameCol, frameRow]);
  return {};
}
type Ctx7 = Ctx6 & ReturnType<typeof useMoveFrameEffect>;

/** Puts a graphic on a layer at the world position of a tile and remembers it, so the effect can destroy it. */
function addAt(layer: Container, created: Container[], graphic: Container, tile: GridPosition): void {
  const { x, y } = gridToWorld(tile);
  graphic.position.set(x, y);
  layer.addChild(graphic);
  created.push(graphic);
}

/** The orange tint of the area an effect reaches and the tint of the Range area of the card being aimed. */
function drawAreaAndRange(overlay: Container, created: Container[], areaTiles: readonly GridPosition[], rangeArea: readonly { position: GridPosition; blocked: boolean }[]): void {
  const diamond = floorOutline();
  for (const tile of areaTiles) {
    addAt(overlay, created, new Graphics().poly(diamond).fill({ color: 0xff8a3d, alpha: 0.2 }).stroke({ width: 1, color: 0xff8a3d, alpha: 0.5 }), tile);
  }
  for (const { position, blocked } of rangeArea) {
    addAt(overlay, created, new Graphics().poly(diamond).fill({ color: blocked ? RANGE_BLOCKED_COLOR : RANGE_COLOR, alpha: RANGE_ALPHA }), position);
  }
}

/** The lit tiles, which pulse slowly (issue 208); with reduced motion they stand still. Returns what stops the pulse. */
function drawHighlights(overlay: Container, created: Container[], highlights: readonly GridPosition[]): (() => void) | undefined {
  const diamond = floorOutline();
  const lit: Graphics[] = [];
  for (const tile of highlights) {
    const highlight = new Graphics().poly(diamond).fill({ color: 0x2ec4b6 }).stroke({ width: 4, color: 0x2ec4b6 });
    addAt(overlay, created, highlight, tile);
    lit.push(highlight);
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pulseStart = clock.now();
  const pulse = (now: number) => {
    const alpha = pulseAlpha(now - pulseStart, reducedMotion);
    for (const highlight of lit) highlight.alpha = alpha;
  };
  if (lit.length === 0) return undefined;
  pulse(pulseStart);
  return reducedMotion ? undefined : clock.subscribe(pulse);
}

/** The tile under the finger, drawn larger than the tile so the finger does not hide it. */
function drawPreviewTile(overlay: Container, created: Container[], previewTile: GridPosition | undefined): void {
  if (!previewTile) return;
  const preview = new Graphics().poly(floorOutline()).fill({ color: 0xffffff, alpha: 0.3 }).stroke({ width: 6, color: 0xffffff });
  preview.scale.set(1.15);
  addAt(overlay, created, preview, previewTile);
}

/** The numbers of the planned Moves, and the labels of the zones above the token's head so the Hero does not hide them. */
function drawMarkersAndLabels(
  overlay: Container,
  created: Container[],
  markers: readonly { position: GridPosition; label: string }[],
  zoneLabels: readonly { position: GridPosition; text: string }[],
): void {
  for (const { position, label } of markers) {
    const marker = new Container();
    marker.addChild(new Graphics().circle(0, 0, 16).fill(0xff8a3d).stroke({ width: 2, color: 0x12161c }));
    const text = new Text({ text: label, style: { fill: 0x12161c, fontSize: 20, fontWeight: "700" } });
    text.anchor.set(0.5);
    marker.addChild(text);
    addAt(overlay, created, marker, position);
  }
  for (const { position, text } of zoneLabels) {
    const label = new Container();
    const caption = new Text({ text, style: { fill: 0x12161c, fontSize: 22, fontWeight: "700" } });
    caption.anchor.set(0.5);
    label.addChild(new Graphics().roundRect(-caption.width / 2 - 8, -16, caption.width + 16, 32, 6).fill(0xffffff), caption);
    const { x, y } = gridToWorld(position);
    label.position.set(x, y - TILE_HEIGHT * 1.5);
    overlay.addChild(label);
    created.push(label);
  }
}

/** The oldest Placed Cover that goes gets a dashed amber outline, the tile of the new one a dashed teal one. */
function drawCoverPlan(overlayTop: Container, created: Container[], coverPlan: typeof NO_COVER_PLAN, strokeScale: number): void {
  for (const [tiles, color, text] of [[coverPlan.oldest, COVER_AMBER, "OLDEST · GOES"], [coverPlan.fresh, COVER_OWN, "NEW COVER HERE"]] as const) {
    for (const tile of tiles) {
      const dashed = dashedTileOutline(tile, color, strokeScale);
      const tag = coverTag(text, color, tile);
      // Above the Cover, so the outline of the oldest piece is not hidden behind its own bars.
      overlayTop.addChild(dashed, tag);
      created.push(dashed, tag);
    }
  }
}

/** A graphic with a part on the ground and a part above the props and Heroes. */
interface TwoLayers {
  ground: Container;
  top: Container;
}

function addTwoLayers({ overlay, overlayTop }: { overlay: Container; overlayTop: Container }, created: Container[], drawn: TwoLayers): void {
  overlay.addChild(drawn.ground);
  overlayTop.addChild(drawn.top);
  created.push(drawn.ground, drawn.top);
}

/** The lines and paths of the plan and of the aim: effect paths, Tick rings, target lines, shots, planned paths and the crosses of collisions. */
function drawPlannedLines(
  layers: { overlay: Container; overlayTop: Container },
  created: Container[],
  lines: Pick<BoardProps, "effectPaths" | "targetLines" | "shotLines" | "paths" | "collisionTiles" | "crossfireRings">,
  strokeScale: number,
): void {
  const { overlay } = layers;
  const { effectPaths = NO_EFFECT_PATHS, crossfireRings = NO_RINGS } = lines;
  for (const effectPath of effectPaths) addTwoLayers(layers, created, effectPathGraphics(effectPath, strokeScale));
  for (const ring of crossfireRings) addTwoLayers(layers, created, crossfireRingGraphics(ring));
  for (const targetLine of lines.targetLines) {
    const drawn = targetLineGraphics(targetLine);
    overlay.addChild(drawn);
    created.push(drawn);
  }
  for (const shot of lines.shotLines) {
    const line = shotGraphics(shot);
    overlay.addChild(line);
    created.push(line);
  }
  for (const path of lines.paths) addTwoLayers(layers, created, pathGraphics(path, strokeScale));
  for (const tile of lines.collisionTiles) {
    const cross = collisionCross(tile);
    overlay.addChild(cross);
    created.push(cross);
  }
}

function usePlanningOverlayEffect(p: Ctx7) {
  const { coverPlan, highlights, markers, zoneLabels, areaTiles, rangeArea, dropTile, shotLines, targetLines, crossfireRings, effectPaths, paths, collisionTiles, overlay, overlayTop, pressed, strokeScale } = p;
  useEffect(() => {
    if (!overlay || !overlayTop) return;
    const created: Container[] = [];
    drawAreaAndRange(overlay, created, areaTiles, rangeArea);
    const stopPulse = drawHighlights(overlay, created, highlights);
    drawPreviewTile(overlay, created, dropTile ?? pressed);
    drawMarkersAndLabels(overlay, created, markers, zoneLabels);
    drawCoverPlan(overlayTop, created, coverPlan, strokeScale);
    drawPlannedLines({ overlay, overlayTop }, created, { effectPaths, crossfireRings, targetLines, shotLines, paths, collisionTiles }, strokeScale);
    return () => {
      stopPulse?.();
      created.forEach((child) => child.destroy({ children: true }));
    };
  }, [overlay, overlayTop, highlights, markers, pressed, dropTile, zoneLabels, areaTiles, rangeArea, shotLines, targetLines, crossfireRings, effectPaths, coverPlan, paths, collisionTiles, strokeScale]);
  return {};
}
type Ctx8 = Ctx7 & ReturnType<typeof usePlanningOverlayEffect>;

/** What one redraw of the tokens reads from the board. */
type TokenInputs = Pick<
  Ctx8,
  | "revealedAreas" | "heroes" | "enemies" | "selectedId" | "targetableIds" | "hitIds" | "clips" | "clipDelays" | "walks" | "effects" | "shotLines" | "marks" | "coverGrid"
  | "strokeScale" | "bubbleSeen" | "ghostSeen" | "enemiesSeen" | "enemiesDrawn" | "frameClock" | "clipPlayers" | "facings"
>;

/** What one redraw of the tokens builds, and what the effect must cancel or destroy when the tokens are drawn again. */
interface TokenBuild {
  created: Container[];
  cancels: (() => void)[];
  /** The rings of the Heroes that can be tapped as target pulse (issue 209); with reduced motion they stand still. */
  pulsingRings: Graphics[];
  statusMarks: StatusMark[];
  /** Shields that change in this frame, and Heroes that slide one tile of Pull (the rules moved them already). */
  shieldMarks: StatusMark[];
  slides: { token: Container; fromX: number; fromY: number; startMs: number }[];
  /** Heroes that walk one tile in this frame glide from the tile they came from. */
  glides: { token: Container; fromX: number; fromY: number }[];
  /** The figures that play a clip (not the hit or Exhausted ones, which are flat poses). */
  animated: { id: string; heroClass: HeroClass; cover: CoverKind; pixel: PixelHero }[];
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const tokenRing = (color: number) => new Graphics().ellipse(0, -TILE_HEIGHT / 2, TILE_WIDTH * 0.42, TILE_HEIGHT * 0.42).stroke({ width: 4, color });

/** A soft light on the floor around each own Hero. */
function addHeroLights(tokens: Container, created: Container[], heroes: readonly TokenHero[]): void {
  for (const hero of heroes) {
    const { x, y } = gridToWorld(hero.position);
    const { color, alpha, rings } = TERRAIN_STYLE.heroLight;
    const light = new Graphics();
    for (let ring = 1; ring <= rings; ring++) {
      const reach = ring / rings;
      light.ellipse(0, 0, TILE_WIDTH * 0.9 * reach, TILE_HEIGHT * 0.9 * reach).fill({ color, alpha: alpha / rings });
    }
    light.position.set(x, y);
    light.zIndex = -1;
    tokens.addChild(light);
    created.push(light);
  }
}

/**
 * The container of a Hero's token at its tile. A Hero that is pulled slides from the tile it was pulled from, and a Hero that walks
 * one tile in this frame glides from the tile it came from; both are registered in `build` for the clip loop.
 */
function startToken(inputs: TokenInputs, build: TokenBuild, hero: TokenHero, enemy: boolean): Container {
  const { effects, walks, enemiesSeen } = inputs;
  const { x, y } = gridToWorld(hero.position);
  const token = new Container();
  token.position.set(x, y + footOffset());
  token.zIndex = depthOf(hero.position) + 0.5;
  // Only a figure that was on the board before can move on it: a Ghost, and an enemy that has just come into sight, stand where
  // they are (they fade in; a glide from a tile of an earlier Round would slide them across the map).
  const movable = canMove(hero, enemy, enemiesSeen.current.has(hero.id));
  const slide = !movable || prefersReducedMotion() ? undefined : effects.find((cue) => cue.kind === "pull" && cue.toId === hero.id);
  if (slide?.kind === "pull" && slide.from) {
    // The token starts on the tile it was pulled from and slides to the one the rules put it on.
    const from = gridToWorld(slide.from);
    build.slides.push({ token, fromX: from.x - x, fromY: from.y - y, startMs: slide.startMs });
  }
  const walkedFrom = movable ? walks[hero.id] : undefined;
  if (walkedFrom !== undefined && !prefersReducedMotion()) {
    const from = gridToWorld(walkedFrom);
    build.glides.push({ token, fromX: from.x - x, fromY: from.y - y });
  }
  return token;
}

/** The ring of the selected Hero and the pulsing ring of a Hero that can be tapped as the target. */
function addTokenRings(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero, enemy: boolean): void {
  const { selectedId, targetableIds, shotLines } = inputs;
  if (hero.id === selectedId) token.addChild(tokenRing(0x2ec4b6));
  const cannotHit = shotLines.some((shot) => shot.targetId === hero.id && !shot.ringed);
  if (targetableIds.includes(hero.id) && !cannotHit) {
    const targetRing = tokenRing(enemy ? 0xe5484d : 0x2ec4b6);
    token.addChild(targetRing);
    build.pulsingRings.push(targetRing);
  }
}

/** The fade of an enemy that just left sight (to its Ghost) or came into sight (from its Ghost, or from nothing). */
function fadeEnemy(inputs: TokenInputs, build: TokenBuild, figure: Container, hero: TokenHero): void {
  const { revealedAreas, ghostSeen, enemiesSeen, enemiesDrawn } = inputs;
  const was = previousSighting(hero.id, ghostSeen.current, enemiesSeen.current);
  if (hero.ghost && was === "seen") build.cancels.push(animateFade(clock, figure, "toGhost"));
  else if (!hero.ghost && was === "ghost") build.cancels.push(animateFade(clock, figure, "toSeen"));
  else if (!hero.ghost && was === undefined && (enemiesDrawn.current || revealedAreas.some((area) => areaContains(area.center, area.size, hero.position)))) {
    // A Scout Drone lifted the fog over it, or a walking Hero came into sight of it (it shows with the next Round's view): it fades in.
    build.cancels.push(animateFade(clock, figure, "appear"));
  }
}

/** The figure of a Hero in its pose, with the Ghost and Hidden looks, and the fade of an enemy. Returns the pose it drew. */
function addFigure(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero, enemy: boolean): string {
  const { clips, hitIds, strokeScale, facings, coverGrid } = inputs;
  // A hit Hero plays the Hit clip; with reduced motion nothing moves, so it shows the flat white pose instead.
  const reduced = prefersReducedMotion();
  // An Exhausted Hero plays its fall in the frame that Exhausts it; at any other time it shows the flat pose (a saved match too).
  const falling = hero.exhausted && clips[hero.id] === "exhausted" && !reduced;
  const pose = heroPose({ exhausted: hero.exhausted && !falling, hit: reduced && hitIds.includes(hero.id) });
  // The enemy Squad is told apart by the red ring under the figure.
  const { figure, pixel } = styledHeroFigure(hero.heroClass, enemy, pose, strokeScale, facings.current.get(hero.id) ?? baseFacing(enemy));
  if (hero.ghost) figure.alpha = GHOST_ALPHA;
  // The Hidden clip fades the figure itself; reduced motion and every other moment show the ghost at once.
  if (hero.hidden && (clips[hero.id] !== "hidden" || reduced)) figure.alpha = 0.55;
  if (hero.ghost) token.addChild(ghostMark());
  // An enemy that just left sight fades to its Ghost; one seen again fades from the Ghost to the real figure.
  if (enemy && !reduced) fadeEnemy(inputs, build, figure, hero);
  token.addChild(figure);
  if (pose === "idle") build.animated.push({ id: hero.id, heroClass: hero.heroClass, cover: coverAt(coverGrid, hero.position), pixel });
  return pose;
}

/** The animated Shield mark of a Hero whose Shield changes in this frame (gained, or hit and absorbing), if there is one. */
function animatedShield(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero, heroMarks: HeroMarks | undefined): StatusMark | undefined {
  const { effects, strokeScale } = inputs;
  if (prefersReducedMotion() || hero.ghost) return undefined;
  const gain = effects.find((cue) => cue.kind === "shieldGain" && cue.toId === hero.id);
  const hit = effects.find((cue) => cue.kind === "shieldHit" && cue.toId === hero.id);
  if (gain?.kind !== "shieldGain" && hit?.kind !== "shieldHit") return undefined;
  const shield = shieldMark({
    held: heroMarks?.rubies ?? 0,
    ...(gain?.kind === "shieldGain" && { gain: { startMs: gain.startMs, amount: gain.amount } }),
    ...(hit?.kind === "shieldHit" && { hit: { startMs: hit.startMs, absorbed: hit.absorbed } }),
    cameraScale: strokeScale,
  });
  token.addChild(shield.container);
  build.shieldMarks.push(shield);
  return shield;
}

/** The bubble of a Shield that is not animated: it appears with an animation when it was not there before, and fades away when the Shield was used up or expired. */
function addBubble(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero, heroMarks: HeroMarks | undefined): void {
  const { strokeScale, bubbleSeen } = inputs;
  if (heroMarks?.bubble) {
    const bubble = shieldBubble(strokeScale);
    token.addChild(bubble);
    if (!bubbleSeen.current.has(hero.id)) build.cancels.push(animateAppear(clock, bubble, HERO_STYLE.marks.bubble.appearMs));
  } else if (bubbleSeen.current.has(hero.id) && !prefersReducedMotion()) {
    const bubble = shieldBubble(strokeScale);
    token.addChild(bubble);
    build.cancels.push(animateFadeOut(clock, bubble, HERO_STYLE.marks.bubble.appearMs));
  }
}

/** The Shield of a Hero: an animated mark in the frame where it changes, otherwise rubies and icons, and the bubble. */
function addShield(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero): void {
  const heroMarks = hero.ghost ? undefined : inputs.marks[hero.id];
  const shield = animatedShield(inputs, build, token, hero, heroMarks);
  if (shield !== undefined) return;
  if (heroMarks && (heroMarks.rubies > 0 || heroMarks.icons.length > 0)) token.addChild(marksFigure(heroMarks, inputs.strokeScale));
  // (The bubble of an animated Shield is part of its mark.)
  addBubble(inputs, build, token, hero, heroMarks);
}

/**
 * Marked and Slow are state: drawn whenever the Hero has them, also when the board is loaded mid-match. In the frame
 * that applies one, the effects layer draws it with its lock-on instead. A Hidden enemy that a Scout Drone area shows gets its eye and tag.
 */
function addStatusMarks(inputs: TokenInputs, build: TokenBuild, token: Container, hero: TokenHero, enemy: boolean): void {
  const { effects } = inputs;
  const locking = (kind: string) => effects.some((cue) => cue.kind === kind && "toId" in cue && cue.toId === hero.id);
  if (hero.marked && !hero.exhausted && !hero.ghost && !locking("marked")) {
    const mark = markedMark();
    token.addChild(mark.container);
    build.statusMarks.push(mark);
  }
  if (hero.slowed && !hero.exhausted && !hero.ghost && !locking("slow")) {
    const mark = slowMark();
    token.addChild(mark.container);
    build.statusMarks.push(mark);
  }
  // A Hidden enemy that a Scout Drone area shows: the figure at about 55 % (above), a cyan ring, an eye and the tag.
  if (enemy && hero.hidden && !hero.exhausted && !hero.ghost) token.addChild(hiddenSeenMark());
}

function addToken(inputs: TokenInputs, build: TokenBuild, tokens: Container, hero: TokenHero, enemy: boolean): void {
  // An enemy that goes Hidden is not drawn at all (Fog of War); only its own Squad sees the ghost.
  if (enemy && !enemyIsDrawn(inputs.clips[hero.id])) return;
  const token = startToken(inputs, build, hero, enemy);
  addTokenRings(inputs, build, token, hero, enemy);
  addFigure(inputs, build, token, hero, enemy);
  addShield(inputs, build, token, hero);
  addStatusMarks(inputs, build, token, hero, enemy);
  tokens.addChild(token);
  build.created.push(token);
}

/** The pulse of the target rings and the clip of every Hero: the active one of this frame, Idle otherwise. Reduced motion stands on the rest frame. */
function animateTokens(inputs: TokenInputs, build: TokenBuild): void {
  const { clips, clipDelays, frameClock, clipPlayers } = inputs;
  const reducedMotion = prefersReducedMotion();
  const pulseStart = clock.now();
  const pulse = (now: number) => {
    const alpha = pulseAlpha(now - pulseStart, reducedMotion);
    for (const targetRing of build.pulsingRings) targetRing.alpha = alpha;
  };
  if (build.pulsingRings.length > 0) {
    pulse(pulseStart);
    if (!reducedMotion) build.cancels.push(clock.subscribe(pulse));
  }
  const playClips = (now: number) => {
    const frameMs = (now - frameClock.current) * CLIP_SPEED;
    for (const mark of build.shieldMarks) mark.update(frameMs);
    for (const { token, fromX, fromY, startMs } of build.slides) {
      const left = 1 - slideProgress(frameMs - startMs);
      token.pivot.set(-fromX * left, -fromY * left);
    }
    const walked = walkProgress(now - frameClock.current);
    for (const { token, fromX, fromY } of build.glides) token.pivot.set(-fromX * (1 - walked), -fromY * (1 - walked));
    // Marked and Slow are past their lock-on here; the Slow field keeps breathing.
    for (const mark of build.statusMarks) mark.update(reducedMotion ? STATUS_AT_REST_MS : 300 + now - pulseStart);
    for (const { id, heroClass, cover, pixel } of build.animated) {
      // A Hero with nothing to show stands, or stands behind the Cover it is on.
      const name = clips[id] ?? restClipName(cover);
      if (reducedMotion) {
        pixel.showStill(name);
        continue;
      }
      let player = clipPlayers.current.get(id);
      if (player === undefined) {
        player = new ClipPlayer(heroClass, now);
        clipPlayers.current.set(id, player);
      }
      player.play(name, now, clipDelays[id] ?? 0, clips);
      player.update(now);
      pixel.show(player.playing, player.clipTimeMs(now));
    }
  };
  playClips(clock.now());
  if (!reducedMotion) build.cancels.push(clock.subscribe(playClips));
}

function useTokensEffect(p: Ctx8) {
  const { revealedAreas, heroes, enemies, selectedId, targetableIds, hitIds, clips, clipDelays, walks, aims, effects, shotLines, marks, coverGrid, tokens, bubbleSeen, ghostSeen, enemiesSeen, enemiesDrawn, frameClock, clipPlayers, facings, strokeScale } = p;
  useEffect(() => {
    if (!tokens) return;
    const inputs: TokenInputs = { revealedAreas, heroes, enemies, selectedId, targetableIds, hitIds, clips, clipDelays, walks, effects, shotLines, marks, coverGrid, strokeScale, bubbleSeen, ghostSeen, enemiesSeen, enemiesDrawn, frameClock, clipPlayers, facings };
    const build: TokenBuild = { created: [], cancels: [], pulsingRings: [], statusMarks: [], shieldMarks: [], slides: [], glides: [], animated: [] };
    addHeroLights(tokens, build.created, heroes);
    heroes.forEach((hero) => addToken(inputs, build, tokens, hero, false));
    enemies.forEach((hero) => addToken(inputs, build, tokens, hero, true));
    ghostSeen.current = new Set(enemies.filter((hero) => hero.ghost).map((hero) => hero.id));
    enemiesSeen.current = new Set(enemies.filter((hero) => !hero.ghost).map((hero) => hero.id));
    enemiesDrawn.current = true;
    // A bubble appears with an animation only when it was not there before this redraw.
    bubbleSeen.current = new Set(Object.entries(marks).flatMap(([id, heroMarks]) => (heroMarks.bubble ? [id] : [])));
    animateTokens(inputs, build);
    return () => {
      build.cancels.forEach((cancel) => cancel());
      build.created.forEach((token) => token.destroy({ children: true }));
    };
  }, [tokens, strokeScale, heroes, enemies, selectedId, targetableIds, hitIds, clips, clipDelays, walks, aims, effects, shotLines, marks, coverGrid]);
  return {};
}
type Ctx9 = Ctx8 & ReturnType<typeof useTokensEffect>;

function useEffectsLayerEffects(p: Ctx9) {
  const { effects, effectsHost, candidatesRef, enemyIdsRef, frameClock } = p;
  // The effects of the attacks of the frame being shown. They read the latest Heroes from refs, so a redraw of
  // the tokens does not restart them; a new frame (a new `effects` array) does.
  const effectsLayer = useRef<EffectsLayer | undefined>(undefined);
  useEffect(() => {
    if (!effectsHost) return;
    const layer = new EffectsLayer(effectsHost.layer);
    effectsLayer.current = layer;
    return () => {
      effectsLayer.current = undefined;
      layer.container.destroy({ children: true });
    };
  }, [effectsHost]);
  useEffect(() => {
    const layer = effectsLayer.current;
    if (!layer || !effectsHost) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tile = (position: GridPosition) => {
      const { x, y } = gridToWorld(position);
      return { x, y: y + footOffset() };
    };
    const world: EffectsWorld = {
      place: (id) => {
        const hero = candidatesRef.current.heroes.find((candidate) => candidate.id === id);
        return hero && tile(hero.position);
      },
      tile,
      builtCover: (position, grow) => coverLook(position, "half", true, grow),
      own: (id) => !enemyIdsRef.current.has(id),
    };
    layer.play(effects, frameClock.current, world, reduced);
    const step = (now: number) => {
      const shake = layer.update(now);
      effectsHost.world.pivot.set(shake.x, shake.y);
    };
    step(clock.now());
    const stop = effects.length > 0 ? clock.subscribe(step) : undefined;
    return () => {
      stop?.();
      effectsHost.world.pivot.set(0, 0);
    };
  }, [effects, effectsHost]);
  return {};
}
type Ctx10 = Ctx9 & ReturnType<typeof useEffectsLayerEffects>;

function useFogCloudsEffect(p: Ctx10) {
  const { coverGrid, fogLayer } = p;
  // The cloud layer over the unseen tiles (fog-clouds.ts). Made once per board; it turns with the view and drifts on its own.
  const [fogClouds, setFogClouds] = useState<FogClouds>();
  useEffect(() => {
    if (!fogLayer) return;
    const clouds = new FogClouds(coverGrid, window.matchMedia("(prefers-reduced-motion: reduce)").matches, clock);
    fogLayer.addChild(clouds.container);
    setFogClouds(clouds);
    return () => {
      setFogClouds(undefined);
      clouds.destroy();
    };
  }, [fogLayer, coverGrid.width, coverGrid.height]);
  return { fogClouds };
}
type Ctx11 = Ctx10 & ReturnType<typeof useFogCloudsEffect>;

type FogGrid = Grid;
type SeenAreas = Map<string, { center: GridPosition; size: number }>;
/** Tiles whose fog changes over time: the fog they have without the area, and how far the area has lifted. */
interface FadingTile {
  index: number;
  fog: number;
  lift: (ms: number) => number;
}

/** The tiles of the square area around `center`, each with its ring (0 in the middle). */
function fogAreaTiles(grid: FogGrid, center: GridPosition, size: number): { tile: GridPosition; ring: number }[] {
  const reach = Math.floor(size / 2);
  const tiles: { tile: GridPosition; ring: number }[] = [];
  for (let row = center.row - reach; row <= center.row + reach; row++) {
    for (let col = center.col - reach; col <= center.col + reach; col++) {
      if (tileAt(grid, { col, row }) !== undefined) tiles.push({ tile: { col, row }, ring: areaRing(center, { col, row }) });
    }
  }
  return tiles;
}

/** The tiles of the Scout Drone areas that fade the fog out (a new area) or back in (an area that ended); with reduced motion nothing fades. */
function fadingAreaTiles(
  inputs: { coverGrid: FogGrid; visibleTiles: Parameters<typeof fogShape>[1]; revealedAreas: BoardProps["revealedAreas"]; own: GridPosition[]; reduced: boolean },
  seen: SeenAreas,
): { fading: FadingTile[]; seenNow: SeenAreas } {
  const { coverGrid, visibleTiles, revealedAreas, own, reduced } = inputs;
  const seenNow: SeenAreas = new Map();
  const fading: FadingTile[] = [];
  const withoutAreas = fogShape(coverGrid, visibleTiles.filter((tile) => !revealedAreas.some((area) => areaContains(area.center, area.size, tile))), own);
  for (const { center, size } of revealedAreas) {
    const key = `${center.col},${center.row},${size}`;
    seenNow.set(key, { center, size });
    if (reduced || seen.has(key)) continue;
    for (const { tile, ring } of fogAreaTiles(coverGrid, center, size)) {
      const index = tile.row * coverGrid.width + tile.col;
      fading.push({ index, fog: withoutAreas[index]!, lift: (ms) => 1 - areaLift(ms, ring) });
    }
  }
  if (reduced) return { fading, seenNow };
  for (const [key, { center, size }] of seen) {
    if (seenNow.has(key)) continue;
    const reach = Math.floor(size / 2);
    for (const { tile, ring } of fogAreaTiles(coverGrid, center, size)) {
      const index = tile.row * coverGrid.width + tile.col;
      fading.push({ index, fog: 0, lift: (ms) => 1 - areaLift(ms, reach - ring) });
    }
  }
  return { fading, seenNow };
}

/** Resolution: the fog follows the walking Heroes between the sight at the start and at the end of the Round. Returns what stops it. */
function followWalkFog(
  fogClouds: FogClouds,
  inputs: Pick<Ctx11, "coverGrid" | "visibleTiles" | "heroes" | "walks" | "frameClock"> & { sightAfter: NonNullable<Ctx11["sightAfter"]>; reduced: boolean },
  fading: readonly FadingTile[],
): () => void {
  const { coverGrid, visibleTiles, heroes, walks, frameClock, sightAfter, reduced } = inputs;
  const ids = heroes.map((hero) => hero.id).filter((id) => sightAfter.startPositions[id] && sightAfter.endPositions[id]);
  const startFog = fogShape(coverGrid, visibleTiles, Object.values(sightAfter.startPositions));
  const endFog = fogShape(coverGrid, sightAfter.visibleTiles, Object.values(sightAfter.endPositions));
  const walkers: FogWalker[] = ids.map((id) => ({ from: sightAfter.startPositions[id]!, to: sightAfter.endPositions[id]!, at: { col: 0, row: 0 } }));
  const frame = new Float32Array(startFog.length);
  const startedAt = clock.now();
  const step = (now: number) => {
    const progress = reduced ? 1 : walkProgress(now - frameClock.current);
    ids.forEach((id, index) => {
      const to = heroes.find((hero) => hero.id === id)!.position;
      const from = walks[id] ?? to;
      walkers[index]!.at.col = from.col + (to.col - from.col) * progress;
      walkers[index]!.at.row = from.row + (to.row - from.row) * progress;
    });
    fogDuringWalk(frame, startFog, endFog, coverGrid.width, walkers);
    // A Scout Drone area still lifts or closes over its own timing, on top of the walk.
    const ms = now - startedAt;
    for (const { index, fog, lift } of fading) frame[index] = (fog - frame[index]!) * lift(ms) + frame[index]!;
    fogClouds.setFog(frame);
  };
  step(startedAt);
  return clock.subscribe(step);
}

/** Planning: the fog as the Squad sees now, with the Scout Drone areas lifting or closing over their own timing. Returns what stops it, if anything runs. */
function settleFog(fogClouds: FogClouds, coverGrid: FogGrid, visibleTiles: Parameters<typeof fogShape>[1], own: GridPosition[], fading: readonly FadingTile[]): (() => void) | undefined {
  const finalFog = fogShape(coverGrid, visibleTiles, own);
  fogClouds.setFog(finalFog);
  if (fading.length === 0) return undefined;
  const frame = new Float32Array(finalFog);
  const step = (ms: number): boolean => {
    for (const { index, fog, lift } of fading) frame[index] = (fog - finalFog[index]!) * lift(ms) + finalFog[index]!;
    fogClouds.setFog(frame);
    const done = finished(ms, TRANSITION_MS);
    if (done) fogClouds.setFog(finalFog);
    return done;
  };
  step(0);
  return runFor(clock, step);
}

function useFogAreaEffect(p: Ctx11) {
  const { revealedAreas, visibleTiles, heroes, walks, sightAfter, coverGrid, frameClock, fogClouds } = p;
  // The fog is the Squad's own sight only. A Scout Drone area fades the fog out (or back in when it ends) over the area's own timing.
  const fogAreaSeen = useRef<SeenAreas>(new Map());
  useEffect(() => {
    if (!fogClouds) return;
    const own = heroes.map((hero) => hero.position);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { fading, seenNow } = fadingAreaTiles({ coverGrid, visibleTiles, revealedAreas, own, reduced }, fogAreaSeen.current);
    fogAreaSeen.current = seenNow;
    if (sightAfter) return followWalkFog(fogClouds, { coverGrid, visibleTiles, heroes, walks, frameClock, sightAfter, reduced }, fading);
    return settleFog(fogClouds, coverGrid, visibleTiles, own, fading);
  }, [fogClouds, coverGrid, visibleTiles, heroes, revealedAreas, sightAfter, walks]);
  return {};
}
type Ctx12 = Ctx11 & ReturnType<typeof useFogAreaEffect>;

function useSceneryEffects(p: Ctx12) {
  const { destroyedCover, visibleTiles, heroes, overview, terrain, scenery, setScenery } = p;
  // Pixel art: the floor is baked into one texture and the Walls and Cover are sprites. They are built again only when the map's
  // own Cover changes (destroyed Cover); Placed Cover, wrecks and the fog are drawn over them by the effect below.
  const destroyedKey = destroyedCover.map((tile) => `${tile.col},${tile.row}`).join(";");
  useEffect(() => {
    if (!terrain?.atlas) return;
    const standing = coverGridOf(destroyedCover, [], []);
    const built = new PixelScenery(terrain.atlas, overview ? withoutCover(standing) : standing);
    built.attach(terrain.floor, terrain.objects);
    setScenery(built);
    return () => {
      setScenery(undefined);
      built.destroy();
    };
    // `destroyedKey` stands for `destroyedCover`: the scenery is built again when the set of destroyed Cover changes, not its array.
  }, [terrain, destroyedKey, overview]);
  useEffect(() => {
    if (!scenery) return;
    scenery.setLit(litTiles(visibleTiles, heroes.map((hero) => hero.position)));
  }, [scenery, visibleTiles, heroes]);
  useEffect(() => {
    if (!scenery) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scenery.tick(clock.now(), reducedMotion);
    if (reducedMotion || !scenery.animated) return;
    return clock.subscribe((now) => scenery.tick(now, false));
  }, [scenery]);
  return {};
}
type Ctx13 = Ctx12 & ReturnType<typeof useSceneryEffects>;

/** What the effects of the terrain share: what it made, what animates for 3 s, what pulses all the time, and when the effects began. */
interface TerrainFx {
  created: Container[];
  /** Run on every frame for 3 s after the redraw (a transition). */
  animated: ((now: number) => void)[];
  /** Run on every frame while the zone is on screen (the idle pulse), unlike `animated`, which ends after 3 s. */
  idle: ((now: number) => void)[];
  effectBegan: number;
  reducedMotion: boolean;
}

type TerrainLayersOf = { floor: Container; objects: Container; planning: Container };
type SeenAreaMap = Map<string, { center: GridPosition; size: number }>;

/** The Prime Zone tint (grey, teal, gold, amber, red) with its pulsing border; our Squad holding it sends a ring over the zone. */
function addZoneFx(
  fx: TerrainFx,
  planning: Container,
  grid: Grid,
  look: Pick<Ctx13, "zoneColor" | "zoneAlpha" | "zoneEmblemAlpha" | "zoneRingOn" | "ringSeen">,
): void {
  const { zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn, ringSeen } = look;
  const zone = drawZone(planning, grid, { color: zoneColor, alpha: zoneAlpha, emblemAlpha: zoneEmblemAlpha });
  const zoneTiles = zone.tiles;
  fx.created.push(...zone.created, ...drawOutposts(planning, grid));
  if (zone.border && zone.glow) {
    const { border, glow } = zone;
    const setBorder = (now: number) => {
      const alpha = zoneBorderAlpha(now, fx.reducedMotion);
      border.alpha = alpha;
      glow.alpha = alpha * 0.25;
    };
    setBorder(0);
    if (!fx.reducedMotion) fx.idle.push(setBorder);
  }
  if (!zoneRingOn || zoneTiles.length === 0) {
    ringSeen.current = "";
    return;
  }
  const middle = gridToWorld({ col: zoneTiles.reduce((sum, tile) => sum + tile.col, 0) / zoneTiles.length, row: zoneTiles.reduce((sum, tile) => sum + tile.row, 0) / zoneTiles.length });
  const zoneRing = new Graphics().ellipse(0, 0, TILE_WIDTH * 1.4, TILE_HEIGHT * 1.4).stroke({ width: 3, color: zoneColor });
  zoneRing.position.set(middle.x, middle.y);
  planning.addChild(zoneRing);
  fx.created.push(zoneRing);
  const pulseOf = (ms: number) => {
    const { scale, alpha } = zoneRingAt(ms);
    zoneRing.scale.set(scale);
    zoneRing.alpha = alpha;
  };
  // One ring per Resolution held: it plays when the hold level (the tint) is new, not on every redraw.
  const ringKey = `${zoneColor}-${zoneAlpha}`;
  if (fx.reducedMotion || ringSeen.current === ringKey) zoneRing.visible = false;
  else fx.animated.push((now) => pulseOf(now));
  ringSeen.current = ringKey;
}

/**
 * Scout Drone areas: the tiles lift from the middle outwards in cyan, two pips count the Resolutions left. An area that was already
 * there before this redraw stands lifted; only a new one plays. Returns the areas seen now.
 */
function addScoutAreas(fx: TerrainFx, layers: TerrainLayersOf, grid: Grid, revealedAreas: BoardProps["revealedAreas"], areaSeen: SeenAreaMap): SeenAreaMap {
  const { planning, objects } = layers;
  const seenNow: SeenAreaMap = new Map();
  for (const { center, size, remaining } of revealedAreas) {
    const key = `${center.col},${center.row},${size}`;
    seenNow.set(key, { center, size });
    const plays = !fx.reducedMotion && !areaSeen.has(key);
    const area = drawScoutArea(planning, grid, { center, size, remaining }, (tile) => areaRing(center, tile));
    fx.created.push(...area.created);
    // The drone circles over the area and scans; it hangs still with reduced motion.
    const drone = scoutDroneMark(center, size, fx.reducedMotion);
    drone.container.zIndex = depthOf(center) + size;
    objects.addChild(drone.container);
    fx.created.push(drone.container);
    drone.update(0);
    if (!fx.reducedMotion) fx.idle.push((now) => drone.update(now - fx.effectBegan));
    if (!plays) continue;
    for (const { tint, ring } of area.tints) {
      tint.alpha = 0;
      fx.animated.push((now) => {
        tint.alpha = areaLift(now, ring);
      });
    }
  }
  return seenNow;
}

/** Areas the enemy scans: a dashed amber outline with a sweep and the Resolutions left. */
function addScannedAreas(fx: TerrainFx, objects: Container, scannedAreas: BoardProps["scannedAreas"] & object): void {
  for (const { center, size, remaining } of scannedAreas) {
    const mark = scannedMark(center, size, remaining, fx.reducedMotion);
    mark.container.zIndex = depthOf(center) + size;
    objects.addChild(mark.container);
    fx.created.push(mark.container);
    mark.update(0);
    if (!fx.reducedMotion) fx.idle.push((now) => mark.update(now - fx.effectBegan));
  }
}

/** An area that ran out: the fog closes again from the outside inwards instead of cutting. */
function addClosingAreas(fx: TerrainFx, planning: Container, grid: Grid, areaSeen: SeenAreaMap, seenNow: SeenAreaMap): void {
  if (fx.reducedMotion) return;
  for (const [key, { center, size }] of areaSeen) {
    if (seenNow.has(key)) continue;
    const reach = Math.floor(size / 2);
    for (let row = center.row - reach; row <= center.row + reach; row++) {
      for (let col = center.col - reach; col <= center.col + reach; col++) {
        if (tileAt(grid, { col, row }) === undefined) continue;
        const tint = new Graphics().poly(floorOutline()).fill({ color: areaColorOf(), alpha: 0.28 });
        addAt(planning, fx.created, tint, { col, row });
        const outward = reach - areaRing(center, { col, row });
        fx.animated.push((now) => {
          tint.alpha = 1 - areaLift(now, outward);
        });
      }
    }
  }
}

/** Runs the animated and idle effects on the clock: a transition ends within 3 s, the idle pulse never ends. Returns what stops it. */
function runTerrainFx(fx: TerrainFx): (() => void) | undefined {
  const { animated, idle, reducedMotion } = fx;
  const effectStart = clock.now();
  let stopEffects: (() => void) | undefined;
  const runEffects = (now: number) => {
    for (const update of animated) update(now - effectStart);
    for (const update of idle) update(now);
    // Every transition (the longest: a ring of the zone or an area of up to 5 rings) is over within 3 s; the idle pulse never ends.
    const transitioning = animated.length > 0 && !finished(now - effectStart, TRANSITION_MS);
    if (reducedMotion || (idle.length === 0 && !transitioning)) stopEffects?.();
  };
  runEffects(effectStart);
  if (!reducedMotion && (idle.length > 0 || animated.length > 0)) stopEffects = clock.subscribe(runEffects);
  return stopEffects;
}

function useTerrainEffect(p: Ctx13) {
  const { destroyedCover, placedCover, ownPlacedCover, wreckCover, revealedAreas, scannedAreas, scrapFields, visibleTiles, heroes, coverGrid, terrain, areaSeen, ringSeen, zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn, aiming, strokeScale } = p;
  // The terrain is drawn again when Cover the Squad has seen destroyed changes.
  useEffect(() => {
    if (!terrain) return;
    const { floor, objects, planning } = terrain;
    const grid = coverGrid;
    const lit = litTiles(visibleTiles, heroes.map((hero) => hero.position));
    const created: Container[] = drawTerrain({ floor, objects, planning }, { grid, strokeScale, lit, placedCover, ownPlacedCover, destroyedCover });
    const fx: TerrainFx = { created, animated: [], idle: [], effectBegan: clock.now(), reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    addZoneFx(fx, planning, grid, { zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn, ringSeen });
    const seenNow = addScoutAreas(fx, { floor, objects, planning }, grid, revealedAreas, areaSeen.current);
    // Scrap Fields: violet tiles with scrap and wire.
    for (const field of scrapFields) created.push(...drawScrapField(planning, grid, field));
    addScannedAreas(fx, objects, scannedAreas);
    addClosingAreas(fx, planning, grid, areaSeen.current, seenNow);
    areaSeen.current = seenNow;
    const stopEffects = runTerrainFx(fx);
    return () => {
      stopEffects?.();
      created.forEach((child) => child.destroy({ children: true }));
    };
  }, [terrain, strokeScale, aiming, destroyedCover, placedCover, ownPlacedCover, wreckCover, revealedAreas, scannedAreas, scrapFields, visibleTiles, heroes, zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn]);
  return {};
}
type Ctx14 = Ctx13 & ReturnType<typeof useTerrainEffect>;

function usePrimeWallsEffect(p: Ctx14) {
  const { primeWalls, wallsWereUp, terrain } = p;
  // The laser walls of the Prime Zone: closed while it is inactive (they show through the fog), a short flicker when it opens.
  useEffect(() => {
    if (!terrain) return;
    // The walls stand among the props and the Heroes (sorted by depth), so a Hero in front of the zone is drawn over its wall and
    // the core inside it over the posts at the back.
    const drawn = drawLaserWalls(terrain.objects, NOTSTROM_MAP);
    const flicker = wallsWereUp.current && !primeWalls && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wallsWereUp.current = primeWalls;
    if (!primeWalls && !flicker) {
      drawn.created.forEach((child) => child.destroy({ children: true }));
      return;
    }
    let stopFlicker: (() => void) | undefined;
    const began = clock.now();
    const run = (now: number) => {
      const ms = now - began;
      drawn.panels.forEach((panel, index) => {
        panel.alpha = flicker ? laserWallAlpha(ms, index) : 1;
      });
      drawn.posts.forEach((post) => {
        post.alpha = flicker ? laserWallAlpha(ms, 1000) : 1;
      });
      if (!flicker || ms >= LASER_FLICKER_MS) stopFlicker?.();
    };
    run(began);
    if (flicker) stopFlicker = clock.subscribe(run);
    return () => {
      stopFlicker?.();
      drawn.created.forEach((child) => child.destroy({ children: true }));
    };
  }, [terrain, primeWalls]);
  return {};
}
type Ctx15 = Ctx14 & ReturnType<typeof usePrimeWallsEffect>;

/** What the camera of the board reads from the board: the latest candidates and callbacks (in refs), and where it reports the stroke scale. */
type CameraInputs = Pick<
  Ctx15,
  "overview" | "onSelectRef" | "onTargetTapRef" | "onTileTapRef" | "candidatesRef" | "ownPositionsRef" | "enemyIdsRef" | "cameraControl" | "selectedIdRef" | "setPressed" | "setStrokeScale"
>;

/** The camera of the board: where it is, how it eases, the automatic framing of an armed Move, and the picking in the world it sees. */
class BoardCameraDirector {
  private camera: Camera;
  private stopAnimation: (() => void) | undefined;
  /** The camera of an armed Move; a manual camera change ends the automatic framing for that Move. */
  private framing: MoveFraming | undefined;

  constructor(
    private readonly world: Container,
    private readonly element: HTMLElement,
    private readonly inputs: CameraInputs,
    private readonly cameraRef: { current: Camera | undefined },
  ) {
    this.camera = cameraRef.current ?? this.startFraming();
  }

  /** Pixel art zooms in whole steps, except in the overview, which always shows the whole board as large as fits. */
  readonly size = (): CameraView => {
    const view = boardScene.view();
    return { width: view.width, height: view.height, pixel: !this.inputs.overview };
  };

  /** The start framing: the own Squad and the Prime Zone, never an enemy (Fog of War). */
  readonly startFraming = (): Camera => {
    const view = this.size();
    const zone = zoneCentre();
    return zone && !this.inputs.overview ? frameSquadCamera(this.inputs.ownPositionsRef.current, zone, view, freeBoardArea(view, { kind: "idle" })) : fitCamera(view);
  };

  readonly currentCamera = (): Camera => this.camera;

  readonly setCamera = (next: Camera): void => {
    this.camera = next;
    this.cameraRef.current = next;
    this.world.scale.set(next.scale);
    this.world.position.set(next.x, next.y);
    this.inputs.setStrokeScale(lineScale(next.scale));
    boardScene.touch();
  };

  /** Eases to a camera in FRAME_MS on the scene clock; jumps when the player prefers reduced motion. */
  private animateTo(target: Camera): void {
    this.stopAnimation?.();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return this.setCamera(target);
    const from = this.camera;
    this.stopAnimation = runFor(clock, (elapsed) => {
      const t = Math.min(elapsed / FRAME_MS, 1);
      const eased = 1 - (1 - t) ** 3;
      this.setCamera({
        scale: from.scale + (target.scale - from.scale) * eased,
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
      });
      return t >= 1;
    });
  }

  readonly setCameraByHand = (next: Camera): void => {
    this.stopAnimation?.();
    this.framing = takeOverFraming(this.framing);
    this.setCamera(next);
  };

  /** What the screen asks of the camera: toggle between the whole board and the selected Hero, frame an armed Move, release it. */
  readonly control = {
    toggle: () => {
      const { candidatesRef, selectedIdRef } = this.inputs;
      const hero = candidatesRef.current.heroes.find((h) => h.id === selectedIdRef.current);
      if (isZoomed(this.camera, this.size()) || !hero) this.setCameraByHand(fitCamera(this.size()));
      else this.setCameraByHand(zoomOnPoint(gridToWorld(hero.position), this.size()));
    },
    frame: (hero: GridPosition) => {
      this.framing ??= beginMoveFraming(this.camera);
      if (this.framing.automatic) this.animateTo(frameMoveCamera(hero, this.inputs.candidatesRef.current.highlights, this.size(), freeBoardArea(this.size(), { kind: "picking" })));
    },
    release: () => {
      if (this.framing?.automatic) this.animateTo(endMoveFraming(this.framing, this.camera));
      this.framing = undefined;
    },
  };

  /** Where a Hero is on the screen, for the cards that are dropped on a Hero. */
  readonly heroScreenPoint = (heroId: string) => {
    const hero = this.inputs.candidatesRef.current.heroes.find((h) => h.id === heroId);
    if (!hero) return undefined;
    const at = gridToWorld(hero.position);
    const rect = this.element.getBoundingClientRect();
    return { x: rect.left + at.x * this.camera.scale + this.camera.x, y: rect.top + at.y * this.camera.scale + this.camera.y };
  };

  readonly pick = (viewX: number, viewY: number) => {
    const { width, height } = this.size();
    const { x, y } = viewToWorld(viewX, viewY, width, height, undefined, this.camera);
    return { x, y, target: resolveTap(x, y, this.inputs.candidatesRef.current, undefined, this.camera.scale) };
  };

  /** Picks at a point in client pixels: what stands there and which tile it is on. */
  readonly pickClient = ({ x: clientX, y: clientY }: { x: number; y: number }) => {
    const rect = this.element.getBoundingClientRect();
    const { x, y, target } = this.pick(clientX - rect.left, clientY - rect.top);
    return { target, ground: pickTileAt(x, y, undefined) };
  };

  /** The gestures on the transparent element over the canvas: camera moves, presses and taps. */
  gestures(): BoardGestures {
    const { setPressed, onTileTapRef, onTargetTapRef, onSelectRef, candidatesRef, enemyIdsRef } = this.inputs;
    return new BoardGestures({
      camera: () => this.camera,
      view: this.size,
      setCameraByHand: this.setCameraByHand,
      press: (point) => {
        if (!point) return setPressed(undefined);
        const { x, y, target } = this.pick(point.x, point.y);
        setPressed(target.kind === "tile" ? target.tile : pickTileAt(x, y, undefined));
      },
      tap: (point) => {
        const { target } = this.pick(point.x, point.y);
        if (target.kind === "tile") onTileTapRef.current(target.tile);
        else if (target.kind === "hero") {
          const targetable = candidatesRef.current.targetableIds.includes(target.id);
          if (enemyIdsRef.current.has(target.id) || targetable) onTargetTapRef.current(target.id);
          else onSelectRef.current(target.id);
        }
      },
    });
  }

  stopAnimating(): void {
    this.stopAnimation?.();
  }
}

function useCameraEffect(p: Ctx15) {
  const { pickRef, heroScreenRef, input, layers, cameraControl    } = p;
  // The camera lives here, not in the scene: a scene rebuilt after a lost WebGL context gets the camera where the player left it.
  const cameraRef = useRef<Camera | undefined>(undefined);
  useEffect(() => {
    const element = input.current;
    if (!layers || !element) return;
    const director = new BoardCameraDirector(layers.world, element, p, cameraRef);
    cameraControl.current = director.control;
    if (heroScreenRef) heroScreenRef.current = director.heroScreenPoint;
    pickRef.current = director.pickClient;
    // One transparent element over the canvas takes the pointer events; the gestures turn them into camera moves, presses and taps.
    const detach = attachBoardInput(element, director.gestures());
    // After a resize or rotation the view starts framed on the own Squad again.
    director.setCamera(director.currentCamera());
    const stopWatchingView = boardScene.watchView(() => director.setCameraByHand(director.startFraming()));
    return () => {
      stopWatchingView();
      detach();
      director.stopAnimating();
      cameraControl.current = undefined;
      pickRef.current = undefined;
      if (heroScreenRef) heroScreenRef.current = undefined;
    };
  }, [layers]);
  return {};
}
type Ctx16 = Ctx15 & ReturnType<typeof useCameraEffect>;

function useBoardReadyEffects(p: Ctx16) {
  const { scenery } = p;
  // The first frame that shows the tiles and the Heroes is the one the scene reports as ready (the seam of ADR 0026, rule 10).
  useEffect(() => {
    if (scenery) boardScene.markDrawn();
  }, [scenery]);
  // Whatever the effects above changed is drawn in one more frame; a board that changes nothing runs no frames.
  useEffect(() => boardScene.touch());
  return {};
}
type Ctx17 = Ctx16 & ReturnType<typeof useBoardReadyEffects>;

function useBoardContext(props: BoardProps) {
  const c1 = { ...props, ...useBoardInputs(props) };
  const c2 = { ...c1, ...useBoardLayers(c1) };
  const c3 = { ...c2, ...useLatestRefs(c2) };
  const c4 = { ...c3, ...useSeenRefs(c3) };
  const c5 = { ...c4, ...useFrameRefs(c4) };
  const c6 = { ...c5, ...useFigureRefs(c5) };
  const c7 = { ...c6, ...useMoveFrameEffect(c6) };
  const c8 = { ...c7, ...usePlanningOverlayEffect(c7) };
  const c9 = { ...c8, ...useTokensEffect(c8) };
  const c10 = { ...c9, ...useEffectsLayerEffects(c9) };
  const c11 = { ...c10, ...useFogCloudsEffect(c10) };
  const c12 = { ...c11, ...useFogAreaEffect(c11) };
  const c13 = { ...c12, ...useSceneryEffects(c12) };
  const c14 = { ...c13, ...useTerrainEffect(c13) };
  const c15 = { ...c14, ...usePrimeWallsEffect(c14) };
  const c16 = { ...c15, ...useCameraEffect(c15) };
  const c17 = { ...c16, ...useBoardReadyEffects(c16) };
  return c17;
}

function BoardView(p: Ctx17) {
  const { input } = p;
  return (
    <div className="board" role="img" aria-label="Notstrom Map">
      <StageLayer scene={BOARD_SCENE_NAME} />
      <div ref={input} className="board-input" />
    </div>
  );
}

export function Board(props: BoardProps) {
  const context = useBoardContext(props);
  return <BoardView {...context} />;
}
