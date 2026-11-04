import {
  CoverKind,
  coverAt,
  type GridPosition,
  type HeroClass,
  type RangeTile,
  type RevealedArea,
  findTiles,
  REACTOR_DECK,
  TileKind,
  tileAt,
} from "game-core";
import { Application, Assets, Container, Graphics, Text } from "pixi.js";
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
  turnCamera,
  gridToWorld,
  isZoomed,
  panBy,
  pickTileAt,
  resolveTap,
  TILE_HEIGHT,
  TILE_WIDTH,
  viewToWorld,
  zoomAt,
  zoomOnPoint,
} from "./board-layout";
import { freeBoardArea } from "./hud-layout";
import { buildTerrain, depthOf, type Face, floorOutline, footOffset, coverGridOf, lineScale, litTiles, turnView, VIEW_ANGLE, VIEW_STEP, worldLineWidth } from "./terrain";
import { applyPose, applyRestPose, type BoundPart, bindParts, CLIP_SPEED, ClipPlayer } from "./clip-player";
import { attackBadge, EffectsLayer, type EffectsWorld, markedMark, shieldMark, slowMark, STATUS_AT_REST_MS, type StatusMark } from "./effects-layer";
import { BADGE_DELAY_MS, type EffectCue, slideProgress } from "./weapon-effects";
import { AREA_COLOR, AREA_PIPS, areaContains, areaLift, areaRing, enemyFade, finished, GHOST_ALPHA, GHOST_FADE_MS, type ZoneLook, zoneBorderAlpha, zoneRingAt } from "./vision-effects";
import { type ClipName, restClipName } from "./hero-clips";
import { enemyIsDrawn } from "./playback";
import { BEACON_LABEL, beaconAlpha, heroFigure, marksFigure, shieldBubble } from "./hero-figure";
import { HERO_STYLE } from "./hero-style";
import type { HeroMarks } from "./shield-marks";
import { chestOf, dashRuns, SegmentStyle, type ShotDrawing, shotInWorld, type ShotInWorld } from "./shot-lines";
import { finalTile, PathOwner, type PlannedPath } from "./ally-paths";
import { LineKind, LineTone, type TargetLine } from "./target-lines";
import { PLAN_STYLE, SHOT_STYLE, TERRAIN_STYLE } from "./terrain-style";
import { pulseAlpha } from "./target-pick";

/** Strokes `segment` as a run of dashes: long for a clear shot, dots for the stopped part, grey after a block. */
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
function tileRing(tile: GridPosition, angle: number, color: number, fillAlpha = 0): Graphics {
  const { x, y } = gridToWorld(tile, angle);
  const ring = new Graphics().ellipse(x, y, TILE_WIDTH * 0.3, TILE_HEIGHT * 0.3);
  if (fillAlpha > 0) ring.fill({ color, alpha: fillAlpha });
  return ring.stroke({ width: PLAN_STYLE.width, color });
}

/**
 * A planned path: a line from the Hero through its Move destinations. The player's has a ring and a numbered badge at each
 * destination and a ghost copy of the Hero on the final tile; an ally's is the bare line, very faint.
 */
function pathGraphics(path: PlannedPath, angle: number, scale: number): Container {
  const { owner, from, stops } = path;
  const own = owner === PathOwner.Player;
  const color = own ? PLAN_STYLE.own : PLAN_STYLE.ally;
  const container = new Container();
  const line = new Graphics();
  const start = chestOf(from, angle);
  line.moveTo(start.x, start.y);
  for (const { tile } of stops) {
    const point = chestOf(tile, angle);
    line.lineTo(point.x, point.y);
  }
  line.stroke({ width: PLAN_STYLE.width, color, cap: "round", join: "round" });
  container.addChild(line);
  if (!own) {
    container.alpha = PLAN_STYLE.allyAlpha;
    return container;
  }
  const ghost = heroFigure(path.heroClass, false, "idle", scale);
  const foot = gridToWorld(finalTile(path), angle);
  ghost.position.set(foot.x, foot.y + footOffset(angle));
  ghost.alpha = PLAN_STYLE.ghostAlpha;
  container.addChild(ghost);
  for (const { tile, tick } of stops) {
    const { x, y } = gridToWorld(tile, angle);
    container.addChild(tileRing(tile, angle, color, PLAN_STYLE.ringFillAlpha), slotBadge(String(tick), x + TILE_WIDTH * 0.42, y, color));
  }
  return container;
}

/** The red cross on the destination of a Move that will fail through another Hero of the Squad. */
function collisionCross(tile: GridPosition, angle: number): Graphics {
  const { x, y } = chestOf(tile, angle);
  const size = 12;
  return new Graphics()
    .moveTo(x - size, y - size)
    .lineTo(x + size, y + size)
    .moveTo(x + size, y - size)
    .lineTo(x - size, y + size)
    .stroke({ width: 6, color: COLLISION_COLOR, cap: "round" });
}

/** A target line: the shot drawing for an Attack, an arrow to an allied Hero, a ring on a tile; the Tick sits in the middle. */
function targetLineGraphics(line: TargetLine, angle: number): Container {
  const container = new Container();
  const from = chestOf(line.from, angle);
  const to = chestOf(line.to, angle);
  if (line.planned && line.faint) {
    // An ally's plan: the bare line in yellow, no badge, no ring.
    const dashed = line.kind === LineKind.Attack;
    const graphics = new Graphics();
    for (const run of dashed ? dashRuns(from, to, PLAN_STYLE.dash, PLAN_STYLE.dashGap) : [{ from, to }]) graphics.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
    container.addChild(graphics.stroke({ width: PLAN_STYLE.width, color: PLAN_STYLE.ally, cap: "round" }));
    container.alpha = PLAN_STYLE.allyAlpha;
    return container;
  }
  if (line.planned && line.kind === LineKind.Attack) {
    // The player's Attack: dashed teal from chest to chest; red and dotted with "!" when the target cannot be reached.
    const color = line.unreachable ? PLAN_STYLE.danger : PLAN_STYLE.own;
    const graphics = new Graphics();
    const [dash, gap] = line.unreachable ? [PLAN_STYLE.dot, PLAN_STYLE.dotGap] : [PLAN_STYLE.dash, PLAN_STYLE.dashGap];
    for (const run of dashRuns(from, to, dash, gap)) graphics.moveTo(run.from.x, run.from.y).lineTo(run.to.x, run.to.y);
    container.addChild(graphics.stroke({ width: PLAN_STYLE.width, color, cap: "round" }), tileRing(line.to, angle, PLAN_STYLE.danger));
    container.addChild(slotBadge(`${line.tick}${line.unreachable ? "!" : ""}`, (from.x + to.x) / 2, (from.y + to.y) / 2, color));
    return container;
  }
  const color = line.tone === LineTone.Clear ? SHOT_STYLE.clear : SHOT_STYLE.stopped;
  if (line.kind === LineKind.Attack && line.shot) {
    // An enemy's shot is always red, whatever the segment says.
    const shot = line.own ? line.shot : { ...line.shot, segments: line.shot.segments.map((segment) => ({ ...segment, style: SegmentStyle.Stopped })) };
    container.addChild(shotGraphics(shot, angle));
  } else {
    const graphics = new Graphics().moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: SHOT_STYLE.width, color, cap: "round" });
    if (line.kind === LineKind.Ally) {
      const direction = Math.atan2(to.y - from.y, to.x - from.x);
      for (const side of [-1, 1]) {
        graphics.moveTo(to.x, to.y).lineTo(to.x - 18 * Math.cos(direction + side * 0.5), to.y - 18 * Math.sin(direction + side * 0.5));
      }
      graphics.stroke({ width: SHOT_STYLE.width, color, cap: "round" });
    }
    container.addChild(graphics);
  }
  if (line.kind !== LineKind.Ally && (line.tone === LineTone.Clear || line.kind === LineKind.Tile)) {
    const { x, y } = gridToWorld(line.to, angle);
    const ring = new Graphics().poly(floorOutline(angle).map((value, index) => value + (index % 2 === 0 ? x : y))).stroke({ width: 4, color });
    container.addChild(ring);
  }
  container.addChild(slotBadge(String(line.tick), (from.x + to.x) / 2, (from.y + to.y) / 2, color));
  return container;
}

function shotGraphics(drawing: ShotDrawing, angle: number): Graphics {
  const { segments, cross } = shotInWorld(drawing, angle);
  const graphics = new Graphics();
  if (drawing.coverTile) {
    const { x, y } = gridToWorld(drawing.coverTile, angle);
    graphics.poly(floorOutline(angle).map((value, index) => value + (index % 2 === 0 ? x : y))).stroke({ width: 5, color: SHOT_STYLE.cover });
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

interface Manifest {
  bundles: { name: string; assets: { alias: string; src: string; data?: { anchor?: [number, number] } }[] }[];
}

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
let assetsReady: Promise<Manifest> | undefined;

/** Loads every bundle of the asset manifest once; placeholder and final art load the same way. */
function loadAssets(): Promise<Manifest> {
  assetsReady ??= (async () => {
    const manifest = (await (await fetch(`${ASSET_BASE}manifest.json`)).json()) as Manifest;
    await Assets.init({ manifest, basePath: ASSET_BASE });
    await Assets.loadBundle(manifest.bundles.map((bundle) => bundle.name));
    return manifest;
  })();
  return assetsReady;
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
  /** The permanent Attack bonus (Adrenal Surge); above zero draws the gold `+1` badge beside the ring. */
  attackBonus?: number;
}

/** The containers the terrain is drawn into. */
interface Terrain {
  floor: Container;
  objects: Container;
  planning: Container;
}

/** Fills a face and outlines it with a line that keeps its width on screen at the camera `scale`. */
function fillFace(graphics: Graphics, { points, fill, edge, edgeWidth }: Face, scale: number): Graphics {
  return graphics.poly(points).fill(fill).stroke({ width: worldLineWidth(edgeWidth, scale), color: edge, join: "round" });
}

/** The middle of the Prime Zone tiles (the zone is drawn faintly even in the fog, so using it reveals nothing). */
function zoneCentre(): GridPosition | undefined {
  const tiles = findTiles(REACTOR_DECK, TileKind.PrimeZone);
  if (tiles.length === 0) return undefined;
  return { col: tiles.reduce((sum, t) => sum + t.col, 0) / tiles.length, row: tiles.reduce((sum, t) => sum + t.row, 0) / tiles.length };
}

interface BoardProps {
  /** Cover tiles the Squad has seen destroyed; the board draws them as open floor. */
  destroyedCover: readonly GridPosition[];
  /** Temporary Half Cover the Squad knows of: drawn as Half Cover with a cyan outline. */
  placedCover: readonly GridPosition[];
  /** Half Cover left by Exhausted Heroes the Squad knows of: a low slab under the downed figure. */
  wreckCover: readonly GridPosition[];
  /** Areas a Scout Drone reveals: tinted yellow. */
  revealedAreas: readonly RevealedArea[];
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
  /** Shield rubies, the shield bubble and planned-action icons per Hero id; Heroes without an entry have none. */
  marks: Readonly<Record<string, HeroMarks>>;
  /** Planning only: destinations of Moves that will fail through another Hero of the Squad. */
  collisionTiles: readonly GridPosition[];
  /** Filled with a function that tells what the board has under a viewport point, for dropping a dragged card. */
  pickRef: MutableRefObject<((point: Point) => BoardPick) | undefined>;
  /** Filled with a function that tells where a Hero is on screen (viewport pixels), to place the card sheet beside it. */
  heroScreenRef?: MutableRefObject<((heroId: string) => Point | undefined) | undefined>;
}

const NO_RANGE: readonly RangeTile[] = [];
const NO_CLIPS: Readonly<Record<string, ClipName>> = {};
const NO_DELAYS: Readonly<Record<string, number>> = {};
const NO_EFFECTS: readonly EffectCue[] = [];
const RANGE_COLOR = 0xe5484d;
const RANGE_BLOCKED_COLOR = 0x8a99a8;
const RANGE_ALPHA = 0.27;


/** Grows a shape from small and transparent to full size in `ms`; with reduced motion it just shows. Returns a cancel function. */
function animateAppear(shape: Graphics, ms: number): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    shape.alpha = t;
    shape.scale.set(0.4 + 0.6 * t);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  shape.alpha = 0;
  shape.scale.set(0.4);
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** The dashed ring and the `last seen` tag of a Ghost. */
function ghostMark(): Container {
  const mark = new Container();
  const ring = new Graphics();
  const rx = TILE_WIDTH * 0.42;
  const ry = TILE_HEIGHT * 0.42;
  const dashes = 16;
  for (let i = 0; i < dashes; i++) {
    const from = (i / dashes) * 2 * Math.PI;
    const to = from + Math.PI / dashes;
    ring.moveTo(Math.cos(from) * rx, -TILE_HEIGHT / 2 + Math.sin(from) * ry).lineTo(Math.cos(to) * rx, -TILE_HEIGHT / 2 + Math.sin(to) * ry);
  }
  ring.stroke({ width: 3, color: 0xe5484d, alpha: 0.8 });
  const tag = new Text({ text: "last seen", style: { fontFamily: "IBM Plex Mono", fontSize: 12, fill: 0x8a99a8, stroke: { color: 0x0b1016, width: 3 } } });
  tag.anchor.set(0.5, 0);
  tag.position.set(0, 4);
  mark.addChild(ring, tag);
  return mark;
}

/** Fades a figure between the real figure and its Ghost; with reduced motion the caller does not call this. Returns a cancel function. */
function animateFade(figure: Container, kind: "toGhost" | "toSeen" | "appear"): () => void {
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    figure.alpha = enemyFade(kind, now - start);
    if (!finished(now - start, GHOST_FADE_MS)) frame = requestAnimationFrame(step);
  };
  figure.alpha = enemyFade(kind, 0);
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Blinks the Controller's beacon in a loop; with reduced motion it stays lit. Returns a cancel function. */
function animateBeacon(beacon: Container): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  let frame = 0;
  const step = (now: number) => {
    beacon.alpha = beaconAlpha(now);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Fades a shape from full to transparent in `ms`. Returns a cancel function. */
function animateFadeOut(shape: Graphics, ms: number): () => void {
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    shape.alpha = 1 - t;
    shape.scale.set(1 + 0.2 * t);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Length of the camera ease when a Move is armed, placed or cancelled. */
const FRAME_MS = 250;

export function Board({
  destroyedCover,
  placedCover,
  wreckCover,
  revealedAreas,
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
  effects = NO_EFFECTS,
  highlights,
  markers,
  onTileTap,
  moveFrameHero,
  zoneTint,
  zoneLabels,
  areaTiles,
  rangeArea = NO_RANGE,
  dropTile,
  shotLines,
  targetLines,
  marks,
  paths,
  collisionTiles,
  pickRef,
  heroScreenRef,
}: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const coverGrid = useMemo(() => coverGridOf(destroyedCover, placedCover, wreckCover), [destroyedCover, placedCover, wreckCover]);
  const [tokens, setTokens] = useState<Container>();
  // The layer of the attack effects (above the Heroes) and the world it shakes.
  const [effectsHost, setEffectsHost] = useState<{ layer: Container; world: Container }>();
  const [overlay, setOverlay] = useState<Container>();
  const [terrain, setTerrain] = useState<Terrain>();
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
  const bubbleSeen = useRef(new Set<string>());
  const { color: zoneColor, alpha: zoneAlpha, emblemAlpha: zoneEmblemAlpha, ring: zoneRingOn } = zoneTint;
  const areaSeen = useRef(new Map<string, { center: GridPosition; size: number }>());
  const ringSeen = useRef("");
  /** Enemy Heroes shown as a Ghost in the last redraw, to fade a change between Ghost and real figure. */
  const ghostSeen = useRef(new Set<string>());
  const enemiesSeen = useRef(new Set<string>());
  // When the playback frame being shown started. The Shield and the Knockback slide of the Heroes follow it, so a redraw of
  // the figures in the middle of a frame (Cover that changes) does not start them again.
  const frameClock = useRef(performance.now());
  const frameOfEffects = useRef(effects);
  if (frameOfEffects.current !== effects) {
    frameOfEffects.current = effects;
    frameClock.current = performance.now();
  }
  // One clip player per Hero; the figures are drawn again for every frame, the players (and their cross-fades) are not.
  const clipPlayers = useRef(new Map<string, ClipPlayer>());
  const [pressed, setPressed] = useState<GridPosition>();
  // The camera scale in steps; outlines are drawn in world pixels of `1 / strokeScale` so they keep their width on screen.
  const [strokeScale, setStrokeScale] = useState(1);
  // The angle the board is drawn at right now; it changes every frame of a turn.
  const [angle, setAngle] = useState(VIEW_ANGLE);
  const angleRef = useRef(VIEW_ANGLE);
  const cameraControl = useRef<{ toggle: () => void; frame: (hero: GridPosition) => void; release: () => void; turn: (steps: 1 | -1) => void } | undefined>(
    undefined,
  );
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Arming a Move frames the Hero and its highlights; placing or cancelling it returns to the previous view.
  const frameCol = moveFrameHero?.col;
  const frameRow = moveFrameHero?.row;
  useEffect(() => {
    if (frameCol === undefined || frameRow === undefined) return;
    cameraControl.current?.frame({ col: frameCol, row: frameRow });
    return () => cameraControl.current?.release();
  }, [frameCol, frameRow]);

  useEffect(() => {
    if (!overlay) return;
    const created: Container[] = [];
    const diamond = floorOutline(angle);
    for (const tile of areaTiles) {
      const { x, y } = gridToWorld(tile, angle);
      const tint = new Graphics().poly(diamond).fill({ color: 0xff8a3d, alpha: 0.2 }).stroke({ width: 1, color: 0xff8a3d, alpha: 0.5 });
      tint.position.set(x, y);
      overlay.addChild(tint);
      created.push(tint);
    }
    for (const { position, blocked } of rangeArea) {
      const { x, y } = gridToWorld(position, angle);
      const color = blocked ? RANGE_BLOCKED_COLOR : RANGE_COLOR;
      const tint = new Graphics().poly(diamond).fill({ color, alpha: RANGE_ALPHA });
      tint.position.set(x, y);
      overlay.addChild(tint);
      created.push(tint);
    }
    const lit: Graphics[] = [];
    for (const tile of highlights) {
      const { x, y } = gridToWorld(tile, angle);
      const highlight = new Graphics().poly(diamond).fill({ color: 0x2ec4b6 }).stroke({ width: 4, color: 0x2ec4b6 });
      highlight.position.set(x, y);
      overlay.addChild(highlight);
      created.push(highlight);
      lit.push(highlight);
    }
    // The lit tiles pulse slowly (issue 208); with reduced motion they stand still.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulseStart = performance.now();
    let pulseFrame = 0;
    const pulse = (now: number) => {
      const alpha = pulseAlpha(now - pulseStart, reducedMotion);
      for (const highlight of lit) highlight.alpha = alpha;
      if (!reducedMotion) pulseFrame = requestAnimationFrame(pulse);
    };
    if (lit.length > 0) pulse(pulseStart);
    const previewTile = dropTile ?? pressed;
    if (previewTile) {
      // The tile under the finger, drawn larger than the tile so the finger does not hide it.
      const { x, y } = gridToWorld(previewTile, angle);
      const preview = new Graphics().poly(diamond).fill({ color: 0xffffff, alpha: 0.3 }).stroke({ width: 6, color: 0xffffff });
      preview.position.set(x, y);
      preview.scale.set(1.15);
      overlay.addChild(preview);
      created.push(preview);
    }
    markers.forEach(({ position, label }) => {
      const { x, y } = gridToWorld(position, angle);
      const marker = new Container();
      marker.position.set(x, y);
      marker.addChild(new Graphics().circle(0, 0, 16).fill(0xff8a3d).stroke({ width: 2, color: 0x12161c }));
      const text = new Text({ text: label, style: { fill: 0x12161c, fontSize: 20, fontWeight: "700" } });
      text.anchor.set(0.5);
      marker.addChild(text);
      overlay.addChild(marker);
      created.push(marker);
    });
    zoneLabels.forEach(({ position, text }) => {
      // Above the token's head, so the label is not hidden by the Hero.
      const { x, y } = gridToWorld(position, angle);
      const label = new Container();
      label.position.set(x, y - TILE_HEIGHT * 1.5);
      const caption = new Text({ text, style: { fill: 0x12161c, fontSize: 22, fontWeight: "700" } });
      caption.anchor.set(0.5);
      label.addChild(new Graphics().roundRect(-caption.width / 2 - 8, -16, caption.width + 16, 32, 6).fill(0xffffff), caption);
      overlay.addChild(label);
      created.push(label);
    });
    for (const targetLine of targetLines) {
      const drawn = targetLineGraphics(targetLine, angle);
      overlay.addChild(drawn);
      created.push(drawn);
    }
    for (const shot of shotLines) {
      const line = shotGraphics(shot, angle);
      overlay.addChild(line);
      created.push(line);
    }
    for (const path of paths) {
      const drawn = pathGraphics(path, angle, strokeScale);
      overlay.addChild(drawn);
      created.push(drawn);
    }
    for (const tile of collisionTiles) {
      const cross = collisionCross(tile, angle);
      overlay.addChild(cross);
      created.push(cross);
    }
    return () => {
      cancelAnimationFrame(pulseFrame);
      created.forEach((child) => child.destroy({ children: true }));
    };
  }, [overlay, angle, highlights, markers, pressed, dropTile, zoneLabels, areaTiles, rangeArea, shotLines, targetLines, paths, collisionTiles, strokeScale]);

  useEffect(() => {
    if (!tokens) return;
    const created: Container[] = [];
    const cancels: (() => void)[] = [];
    // The rings of the Heroes that can be tapped as target pulse (issue 209); with reduced motion they stand still.
    const pulsingRings: Graphics[] = [];
    const statusMarks: StatusMark[] = [];
    // The `+1` badges of Heroes with an Attack bonus; one that is gained in this frame pops in at `startMs`.
    const badges: { mark: StatusMark; startMs: number | undefined }[] = [];
    // Shields that change in this frame, and Heroes that slide one tile of Knockback (the rules moved them already).
    const shieldMarks: StatusMark[] = [];
    const slides: { token: Container; fromX: number; fromY: number; startMs: number }[] = [];
    // The figures that play a clip (not the hit or Exhausted ones, which are flat poses).
    const animated: { id: string; heroClass: HeroClass; cover: CoverKind; parts: BoundPart[] }[] = [];
    const ring = (color: number) =>
      new Graphics().ellipse(0, -TILE_HEIGHT / 2, TILE_WIDTH * 0.42, TILE_HEIGHT * 0.42).stroke({ width: 4, color });
    const addToken = (hero: TokenHero, enemy: boolean) => {
      // An enemy that goes Hidden is not drawn at all (Fog of War); only its own Squad sees the ghost.
      if (enemy && !enemyIsDrawn(clips[hero.id])) return;
      const { x, y } = gridToWorld(hero.position, angle);
      const token = new Container();
      token.position.set(x, y + footOffset(angle));
      token.zIndex = depthOf(hero.position, angle) + 0.5;
      const targetable = targetableIds.includes(hero.id);
      const slide = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? undefined : effects.find((cue) => cue.kind === "knockback" && cue.toId === hero.id);
      if (slide?.kind === "knockback") {
        // The token starts on the tile it was pushed from and slides to the one the rules put it on.
        const from = gridToWorld(slide.from, angle);
        slides.push({ token, fromX: from.x - x, fromY: from.y - y, startMs: slide.startMs });
      }
      if (hero.id === selectedId) token.addChild(ring(0x2ec4b6));
      const cannotHit = shotLines.some((shot) => shot.targetId === hero.id && !shot.ringed);
      if (targetable && !cannotHit) {
        const targetRing = ring(enemy ? 0xe5484d : 0x2ec4b6);
        token.addChild(targetRing);
        pulsingRings.push(targetRing);
      }
      // A hit Hero plays the Hit clip; with reduced motion nothing moves, so it shows the flat white pose instead.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // An Exhausted Hero plays its fall in the frame that Exhausts it; at any other time it shows the flat pose (a saved match too).
      const falling = hero.exhausted && clips[hero.id] === "exhausted" && !reduced;
      const pose = hero.exhausted && !falling ? "exhausted" : reduced && hitIds.includes(hero.id) ? "hit" : "idle";
      // The enemy Squad is told apart by the red ring under the figure.
      const figure = heroFigure(hero.heroClass, enemy, pose, strokeScale);
      if (hero.ghost) figure.alpha = GHOST_ALPHA;
      // The Hidden clip fades the figure itself; reduced motion and every other moment show the ghost at once.
      if (hero.hidden && (clips[hero.id] !== "hidden" || reduced)) figure.alpha = 0.55;
      if (hero.ghost) token.addChild(ghostMark());
      // An enemy that just left sight fades to its Ghost; one seen again fades from the Ghost to the real figure.
      if (enemy && !reduced) {
        const was = ghostSeen.current.has(hero.id) ? "ghost" : enemiesSeen.current.has(hero.id) ? "seen" : undefined;
        if (hero.ghost && was === "seen") cancels.push(animateFade(figure, "toGhost"));
        else if (!hero.ghost && was === "ghost") cancels.push(animateFade(figure, "toSeen"));
        else if (!hero.ghost && was === undefined && revealedAreas.some((area) => areaContains(area.center, area.size, hero.position))) {
          // The Scout Drone lifted the fog over it: it fades in.
          cancels.push(animateFade(figure, "appear"));
        }
      }
      token.addChild(figure);
      const beacon = figure.getChildByLabel(BEACON_LABEL, true);
      if (beacon && pose === "idle" && !falling) cancels.push(animateBeacon(beacon));
      if (pose === "idle") animated.push({ id: hero.id, heroClass: hero.heroClass, cover: coverAt(coverGrid, hero.position), parts: bindParts(figure, falling) });
      const heroMarks = hero.ghost ? undefined : marks[hero.id];
      // A Shield that changes in this frame (gained, or hit and absorbing) is drawn with its own animation.
      let shield: StatusMark | undefined;
      if (!reduced && !hero.ghost) {
        const gain = effects.find((cue) => cue.kind === "shieldGain" && cue.toId === hero.id);
        const hit = effects.find((cue) => cue.kind === "shieldHit" && cue.toId === hero.id);
        if (gain?.kind === "shieldGain" || hit?.kind === "shieldHit") {
          shield = shieldMark({
            held: heroMarks?.rubies ?? 0,
            ...(gain?.kind === "shieldGain" && { gain: { startMs: gain.startMs, amount: gain.amount } }),
            ...(hit?.kind === "shieldHit" && { hit: { startMs: hit.startMs, absorbed: hit.absorbed } }),
            cameraScale: strokeScale,
          });
          token.addChild(shield.container);
          shieldMarks.push(shield);
        }
      }
      if (shield === undefined && heroMarks && (heroMarks.rubies > 0 || heroMarks.icons.length > 0)) {
        token.addChild(marksFigure(heroMarks, strokeScale));
      }
      // (The bubble of an animated Shield is part of its mark.)
      if (shield === undefined && heroMarks?.bubble) {
        const bubble = shieldBubble(strokeScale);
        token.addChild(bubble);
        if (!bubbleSeen.current.has(hero.id)) cancels.push(animateAppear(bubble, HERO_STYLE.marks.bubble.appearMs));
      } else if (shield === undefined && bubbleSeen.current.has(hero.id) && !reduced) {
        // The Shield was used up or expired: the bubble fades away (not with reduced motion).
        const bubble = shieldBubble(strokeScale);
        token.addChild(bubble);
        cancels.push(animateFadeOut(bubble, HERO_STYLE.marks.bubble.appearMs));
      }
      // Marked and Slow are state: drawn whenever the Hero has them, also when the board is loaded mid-match. In the frame
      // that applies one, the effects layer draws it with its lock-on instead.
      const locking = (kind: string) => effects.some((cue) => cue.kind === kind && "toId" in cue && cue.toId === hero.id);
      if (hero.marked && !hero.exhausted && !hero.ghost && !locking("marked")) {
        const mark = markedMark();
        token.addChild(mark.container);
        statusMarks.push(mark);
      }
      if (hero.slowed && !hero.exhausted && !hero.ghost && !locking("slow")) {
        const mark = slowMark();
        token.addChild(mark.container);
        statusMarks.push(mark);
      }
      // The Attack bonus of Adrenal Surge is state too: the badge stays beside the ring until Exhaustion.
      if ((hero.attackBonus ?? 0) > 0 && !hero.exhausted && !hero.ghost) {
        const badge = attackBadge();
        token.addChild(badge.container);
        const surge = reduced ? undefined : effects.find((cue) => cue.kind === "surge" && cue.toId === hero.id);
        badges.push({ mark: badge, startMs: surge?.kind === "surge" ? surge.startMs + BADGE_DELAY_MS : undefined });
      }
      tokens.addChild(token);
      created.push(token);
    };
    for (const hero of heroes) {
      // A soft light on the floor around each own Hero.
      const { x, y } = gridToWorld(hero.position, angle);
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
    heroes.forEach((hero) => addToken(hero, false));
    enemies.forEach((hero) => addToken(hero, true));
    ghostSeen.current = new Set(enemies.filter((hero) => hero.ghost).map((hero) => hero.id));
    enemiesSeen.current = new Set(enemies.filter((hero) => !hero.ghost).map((hero) => hero.id));
    // A bubble appears with an animation only when it was not there before this redraw.
    bubbleSeen.current = new Set(Object.entries(marks).flatMap(([id, heroMarks]) => (heroMarks.bubble ? [id] : [])));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulseStart = performance.now();
    let pulseFrame = 0;
    const pulse = (now: number) => {
      const alpha = pulseAlpha(now - pulseStart, reducedMotion);
      for (const targetRing of pulsingRings) targetRing.alpha = alpha;
      if (!reducedMotion) pulseFrame = requestAnimationFrame(pulse);
    };
    if (pulsingRings.length > 0) pulse(pulseStart);
    // The clip of every Hero: the active one of this frame, Idle otherwise. Reduced motion stands on the rest frame.
    let clipFrame = 0;
    const playClips = (now: number) => {
      const frameMs = (now - frameClock.current) * CLIP_SPEED;
      for (const mark of shieldMarks) mark.update(frameMs);
      for (const { mark, startMs } of badges) mark.update(startMs === undefined ? STATUS_AT_REST_MS : frameMs - startMs);
      for (const { token, fromX, fromY, startMs } of slides) {
        const left = 1 - slideProgress(frameMs - startMs);
        token.pivot.set(-fromX * left, -fromY * left);
      }
      // Marked and Slow are past their lock-on here; the Slow field keeps breathing.
      for (const mark of statusMarks) mark.update(reducedMotion ? STATUS_AT_REST_MS : 300 + now - pulseStart);
      for (const { id, heroClass, cover, parts } of animated) {
        // A Hero with nothing to show stands, or stands behind the Cover it is on.
        const name = clips[id] ?? restClipName(cover);
        if (reducedMotion) {
          applyRestPose(parts, name);
          continue;
        }
        let player = clipPlayers.current.get(id);
        if (player === undefined) {
          player = new ClipPlayer(heroClass, now);
          clipPlayers.current.set(id, player);
        }
        player.play(name, now, clipDelays[id] ?? 0, clips);
        applyPose(parts, player.sample(now));
      }
      if (!reducedMotion) clipFrame = requestAnimationFrame(playClips);
    };
    playClips(performance.now());
    return () => {
      cancelAnimationFrame(pulseFrame);
      cancelAnimationFrame(clipFrame);
      cancels.forEach((cancel) => cancel());
      created.forEach((token) => token.destroy({ children: true }));
    };
  }, [tokens, angle, strokeScale, heroes, enemies, selectedId, targetableIds, hitIds, clips, clipDelays, effects, shotLines, marks, coverGrid]);

  // The effects of the attacks of the frame being shown. They read the latest Heroes and angle from refs, so a redraw of
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
      const { x, y } = gridToWorld(position, angleRef.current);
      return { x, y: y + footOffset(angleRef.current) };
    };
    const world: EffectsWorld = {
      place: (id) => {
        const hero = candidatesRef.current.heroes.find((candidate) => candidate.id === id);
        return hero && tile(hero.position);
      },
      tile,
      own: (id) => !enemyIdsRef.current.has(id),
    };
    layer.play(effects, frameClock.current, world, reduced);
    let frame = 0;
    const step = () => {
      const shake = layer.update(performance.now());
      effectsHost.world.pivot.set(shake.x, shake.y);
      if (effects.length > 0) frame = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(frame);
      effectsHost.world.pivot.set(0, 0);
    };
  }, [effects, effectsHost]);

  // The terrain is drawn again when Cover the Squad has seen destroyed changes.
  useEffect(() => {
    if (!terrain) return;
    const { floor, objects, planning } = terrain;
    const grid = coverGrid;
    const created: Container[] = [];
    // Floor tiles share one shape layer; standing pieces are drawn per tile and sort with the Heroes by depth.
    const ground = new Graphics();
    floor.addChild(ground);
    created.push(ground);
    const lit = litTiles(
      visibleTiles,
      heroes.map((hero) => hero.position),
    );
    for (const tile of buildTerrain(grid, angle, lit)) {
      fillFace(ground, tile.floor, strokeScale);
      if (tile.marker) ground.poly(tile.marker.points).stroke({ width: 2, color: tile.marker.color, alpha: 0.9 });
      if (!tile.piece) continue;
      const piece = new Graphics();
      for (const face of tile.piece) fillFace(piece, face, strokeScale);
      piece.zIndex = tile.depth;
      if (!tile.lit) piece.alpha = TERRAIN_STYLE.fogPieceAlpha;
      objects.addChild(piece);
      created.push(piece);
    }

    // Cover tiles get an outline on the floor: orange for Full Cover, blue for Half Cover.
    // Destroyed Cover keeps a grey outline so the broken tile stays readable.
    grid.tiles.forEach((line, row) =>
      line.forEach((_, col) => {
        const cover = coverAt(grid, { col, row });
        const isTile = (tile: GridPosition) => tile.col === col && tile.row === row;
        const placed = placedCover.some(isTile);
        const destroyed = !placed && destroyedCover.some(isTile);
        if (cover === CoverKind.None && !destroyed) return;
        const outlines = TERRAIN_STYLE.coverOutline;
        const color = destroyed ? outlines.destroyed : placed ? outlines.placed : cover === CoverKind.Full ? outlines.full : outlines.half;
        const { x, y } = gridToWorld({ col, row }, angle);
        const outline = new Graphics().poly(floorOutline(angle)).stroke({ width: destroyed ? 2 : placed ? 5 : 3, color, alpha: destroyed ? 0.6 : 0.9 });
        outline.position.set(x, y);
        planning.addChild(outline);
        created.push(outline);
      }),
    );

    // The Prime Zone tint (grey, teal, gold, amber, red); our Squad holding it sends a ring over the zone.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const zoneTiles: GridPosition[] = [];
    grid.tiles.forEach((line, row) =>
      line.forEach((kind, col) => {
        if (kind !== TileKind.PrimeZone) return;
        zoneTiles.push({ col, row });
        const { x, y } = gridToWorld({ col, row }, angle);
        const tint = new Graphics().poly(floorOutline(angle)).fill({ color: zoneColor, alpha: zoneAlpha });
        tint.position.set(x, y);
        planning.addChild(tint);
        created.push(tint);
      }),
    );
    const animated: ((now: number) => void)[] = [];
    /** Run on every frame while the zone is on screen (the idle pulse), unlike `animated`, which ends after 3 s. */
    const idle: ((now: number) => void)[] = [];
    if (zoneTiles.length > 0) {
      // One outline around the outer edge of the zone (not per tile), with a wide glow under it, and a flat emblem on the middle tile.
      const cols = zoneTiles.map((tile) => tile.col);
      const rows = zoneTiles.map((tile) => tile.row);
      const [minCol, maxCol, minRow, maxRow] = [Math.min(...cols) - 0.5, Math.max(...cols) + 0.5, Math.min(...rows) - 0.5, Math.max(...rows) + 0.5];
      const outer = [[minCol, minRow], [maxCol, minRow], [maxCol, maxRow], [minCol, maxRow]].flatMap(([col, row]) => {
        const { x, y } = gridToWorld({ col: col!, row: row! }, angle);
        return [x, y];
      });
      const glow = new Graphics().poly(outer).stroke({ width: 7, color: zoneColor, join: "round" });
      const border = new Graphics().poly(outer).stroke({ width: 3, color: zoneColor, join: "round" });
      const middleTile = gridToWorld({ col: (minCol + maxCol) / 2, row: (minRow + maxRow) / 2 }, angle);
      const emblem = new Graphics()
        .ellipse(0, 0, TILE_WIDTH * 0.275, TILE_HEIGHT * 0.275)
        .stroke({ width: 2, color: zoneColor })
        .poly([-TILE_WIDTH * 0.125, 0, 0, -TILE_HEIGHT * 0.125, TILE_WIDTH * 0.125, 0, 0, TILE_HEIGHT * 0.125])
        .fill({ color: zoneColor });
      emblem.position.set(middleTile.x, middleTile.y);
      emblem.alpha = zoneEmblemAlpha;
      for (const graphic of [glow, border, emblem]) {
        planning.addChild(graphic);
        created.push(graphic);
      }
      const setBorder = (now: number) => {
        const alpha = zoneBorderAlpha(now, reducedMotion);
        border.alpha = alpha;
        glow.alpha = alpha * 0.25;
      };
      setBorder(0);
      if (!reducedMotion) idle.push(setBorder);
    }
    if (zoneRingOn && zoneTiles.length > 0) {
      const middle = gridToWorld({ col: zoneTiles.reduce((sum, tile) => sum + tile.col, 0) / zoneTiles.length, row: zoneTiles.reduce((sum, tile) => sum + tile.row, 0) / zoneTiles.length }, angle);
      const zoneRing = new Graphics().ellipse(0, 0, TILE_WIDTH * 1.4, TILE_HEIGHT * 1.4).stroke({ width: 3, color: zoneColor });
      zoneRing.position.set(middle.x, middle.y);
      planning.addChild(zoneRing);
      created.push(zoneRing);
      const pulseOf = (ms: number) => {
        const { scale, alpha } = zoneRingAt(ms);
        zoneRing.scale.set(scale);
        zoneRing.alpha = alpha;
      };
      // One ring per Resolution held: it plays when the hold level (the tint) is new, not on every redraw.
      const ringKey = `${zoneColor}-${zoneAlpha}`;
      if (reducedMotion || ringSeen.current === ringKey) zoneRing.visible = false;
      else animated.push((now) => pulseOf(now));
      ringSeen.current = ringKey;
    } else {
      ringSeen.current = "";
    }

    // Scout Drone areas: the tiles lift from the middle outwards in cyan, two pips count the Resolutions left.
    // An area that was already there before this redraw stands lifted; only a new one plays.
    const seenNow = new Map<string, { center: GridPosition; size: number }>();
    for (const { center, size, remaining } of revealedAreas) {
      const key = `${center.col},${center.row},${size}`;
      seenNow.set(key, { center, size });
      const plays = !reducedMotion && !areaSeen.current.has(key);
      const reach = Math.floor(size / 2);
      for (let row = center.row - reach; row <= center.row + reach; row++) {
        for (let col = center.col - reach; col <= center.col + reach; col++) {
          if (tileAt(grid, { col, row }) === undefined) continue;
          const { x, y } = gridToWorld({ col, row }, angle);
          // The 5 by 5 area of an Overdrive Scout Drone is gold.
          const areaColor = size >= 5 ? 0xffb000 : AREA_COLOR;
          const tint = new Graphics().poly(floorOutline(angle)).fill({ color: areaColor, alpha: 0.28 }).stroke({ width: 1, color: areaColor, alpha: 0.6 });
          tint.position.set(x, y);
          planning.addChild(tint);
          created.push(tint);
          if (!plays) continue;
          const ring = areaRing(center, { col, row });
          tint.alpha = 0;
          animated.push((now) => {
            tint.alpha = areaLift(now, ring);
          });
        }
      }
      const top = gridToWorld(center, angle);
      const pips = new Graphics();
      for (let pip = 0; pip < AREA_PIPS; pip++) pips.circle((pip - 0.5) * 12, 0, 3.5).fill({ color: AREA_COLOR, alpha: pip < remaining ? 1 : 0.25 }).stroke({ width: 1, color: 0x0b1016 });
      pips.position.set(top.x, top.y - TILE_HEIGHT * (reach + 2.2));
      planning.addChild(pips);
      created.push(pips);
    }
    // An area that ran out: the fog closes again from the outside inwards instead of cutting.
    if (!reducedMotion) {
      for (const [key, { center, size }] of areaSeen.current) {
        if (seenNow.has(key)) continue;
        const reach = Math.floor(size / 2);
        for (let row = center.row - reach; row <= center.row + reach; row++) {
          for (let col = center.col - reach; col <= center.col + reach; col++) {
            if (tileAt(grid, { col, row }) === undefined) continue;
            const { x, y } = gridToWorld({ col, row }, angle);
            const tint = new Graphics().poly(floorOutline(angle)).fill({ color: size >= 5 ? 0xffb000 : AREA_COLOR, alpha: 0.28 });
            tint.position.set(x, y);
            planning.addChild(tint);
            created.push(tint);
            const outward = reach - areaRing(center, { col, row });
            animated.push((now) => {
              tint.alpha = 1 - areaLift(now, outward);
            });
          }
        }
      }
    }
    areaSeen.current = seenNow;
    const effectStart = performance.now();
    let effectFrame = 0;
    const runEffects = (now: number) => {
      for (const update of animated) update(now - effectStart);
      for (const update of idle) update(now);
      // Every transition (the longest: a ring of the zone or an area of up to 5 rings) is over within 3 s; the idle pulse never ends.
      const transitioning = animated.length > 0 && !finished(now - effectStart, 3000);
      if (!reducedMotion && (idle.length > 0 || transitioning)) effectFrame = requestAnimationFrame(runEffects);
    };
    runEffects(effectStart);
    return () => {
      cancelAnimationFrame(effectFrame);
      created.forEach((child) => child.destroy({ children: true }));
    };
  }, [terrain, angle, strokeScale, destroyedCover, placedCover, wreckCover, revealedAreas, visibleTiles, heroes, zoneColor, zoneAlpha, zoneEmblemAlpha, zoneRingOn]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    const app = new Application();

    void (async () => {
      await Promise.all([
        loadAssets(),
        app.init({ background: "#12161c", resizeTo: element, antialias: true, autoDensity: true, resolution: window.devicePixelRatio }),
      ]);
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      element.appendChild(app.canvas);

      const world = new Container();
      const floor = new Container();
      const objects = new Container();
      objects.sortableChildren = true;
      const planning = new Container();
      const effectsLayer = new Container();
      world.addChild(floor, planning, objects, effectsLayer);
      app.stage.addChild(world);
      setEffectsHost({ layer: effectsLayer, world });
      // Hero tokens sort together with the props, by tile depth.
      setTokens(objects);
      // Highlights and markers lie on the floor; markers would hide behind props, which is acceptable.
      setOverlay(planning);

      setTerrain({ floor, objects, planning });

      const size = (): CameraView => ({ width: app.screen.width, height: app.screen.height, angle: angleRef.current });
      // The start framing: the own Squad and the Prime Zone, never an enemy (Fog of War).
      const startFraming = (): Camera => {
        const view = size();
        const zone = zoneCentre();
        return zone ? frameSquadCamera(ownPositionsRef.current, zone, view, freeBoardArea(view, { kind: "idle" })) : fitCamera(view);
      };
      let camera = startFraming();
      const setCamera = (next: Camera) => {
        camera = next;
        world.scale.set(camera.scale);
        world.position.set(camera.x, camera.y);
        setStrokeScale(lineScale(camera.scale));
      };
      // Eases to a camera in FRAME_MS; jumps when the player prefers reduced motion.
      let animation: number | undefined;
      // Set while a turn is animating; cancelling the animation then snaps to the turn's end view.
      let finishTurn: (() => void) | undefined;
      const stopAnimation = () => {
        if (animation !== undefined) cancelAnimationFrame(animation);
        animation = undefined;
        const finish = finishTurn;
        finishTurn = undefined;
        finish?.();
      };
      const animateTo = (target: Camera) => {
        stopAnimation();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setCamera(target);
        const from = camera;
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / FRAME_MS, 1);
          const eased = 1 - (1 - t) ** 3;
          setCamera({
            scale: from.scale + (target.scale - from.scale) * eased,
            x: from.x + (target.x - from.x) * eased,
            y: from.y + (target.y - from.y) * eased,
          });
          animation = t < 1 ? requestAnimationFrame(step) : undefined;
        };
        animation = requestAnimationFrame(step);
      };
      // The camera of an armed Move; a manual camera change ends the automatic framing for that Move.
      let framing: MoveFraming | undefined;
      const setCameraByHand = (next: Camera) => {
        stopAnimation();
        framing = takeOverFraming(framing);
        setCamera(next);
      };
      // Turns the board one step (the angle rests in 0..359; a cancelled turn snaps to its end view). The terrain is
      // redrawn at the in-between angles; the camera is refitted (or, when zoomed, kept on the same tile) each frame.
      const showAngle = (next: number) => {
        const turned = turnCamera(camera, size(), next);
        angleRef.current = next;
        setAngle(next);
        setCamera(turned);
      };
      const turnBy = (steps: 1 | -1) => {
        stopAnimation(); // finishes a turn still running, so `from` is a resting view
        framing = takeOverFraming(framing);
        const from = angleRef.current;
        const end = turnView(from, steps);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return showAngle(end);
        finishTurn = () => showAngle(end);
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / FRAME_MS, 1);
          if (t < 1) {
            showAngle(from + steps * VIEW_STEP * (1 - (1 - t) ** 3));
            animation = requestAnimationFrame(step);
          } else {
            animation = undefined;
            finishTurn = undefined;
            showAngle(end);
          }
        };
        animation = requestAnimationFrame(step);
      };
      cameraControl.current = {
        turn: turnBy,
        toggle: () => {
          const hero = candidatesRef.current.heroes.find((h) => h.id === selectedIdRef.current);
          if (isZoomed(camera, size()) || !hero) setCameraByHand(fitCamera(size()));
          else setCameraByHand(zoomOnPoint(gridToWorld(hero.position, angleRef.current), size()));
        },
        frame: (hero) => {
          framing ??= beginMoveFraming(camera);
          if (framing.automatic) animateTo(frameMoveCamera(hero, candidatesRef.current.highlights, size(), freeBoardArea(size(), { kind: "picking" })));
        },
        release: () => {
          if (framing?.automatic) animateTo(endMoveFraming(framing, camera));
          framing = undefined;
        },
      };

      if (heroScreenRef) {
        heroScreenRef.current = (heroId) => {
          const hero = candidatesRef.current.heroes.find((h) => h.id === heroId);
          if (!hero) return undefined;
          const world = gridToWorld(hero.position, angleRef.current);
          const rect = app.canvas.getBoundingClientRect();
          return { x: rect.left + world.x * camera.scale + camera.x, y: rect.top + world.y * camera.scale + camera.y };
        };
      }

      const pick = (viewX: number, viewY: number) => {
        const { x, y } = viewToWorld(viewX, viewY, app.screen.width, app.screen.height, undefined, camera);
        return { x, y, target: resolveTap(x, y, candidatesRef.current, undefined, angleRef.current, camera.scale) };
      };
      pickRef.current = ({ x: clientX, y: clientY }) => {
        const rect = app.canvas.getBoundingClientRect();
        const { x, y, target } = pick(clientX - rect.left, clientY - rect.top);
        return { target, ground: pickTileAt(x, y, undefined, angleRef.current) };
      };
      // Fingers (or the mouse button) currently down, by pointer id; two of them pinch, one pans a zoomed board.
      const down = new Map<number, { x: number; y: number }>();
      let dragStart = { x: 0, y: 0 };
      let dragged = false;
      // A drag or pinch is not a tap.
      let suppressTap = false;
      const DRAG_THRESHOLD = 8;
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointerdown", (event) => {
        down.set(event.pointerId, { x: event.global.x, y: event.global.y });
        if (down.size === 1) {
          suppressTap = false;
          dragged = false;
          dragStart = { x: event.global.x, y: event.global.y };
          const { x, y, target } = pick(event.global.x, event.global.y);
          setPressed(target.kind === "tile" ? target.tile : pickTileAt(x, y, undefined, angleRef.current));
        } else {
          suppressTap = true;
          setPressed(undefined);
        }
      });
      app.stage.on("globalpointermove", (event) => {
        const previous = down.get(event.pointerId);
        if (!previous) return;
        const current = { x: event.global.x, y: event.global.y };
        if (down.size >= 2) {
          const [a, b] = [...down.entries()].map(([id, point]) => (id === event.pointerId ? current : point));
          const [oldA, oldB] = [...down.values()];
          const oldDistance = Math.hypot(oldA!.x - oldB!.x, oldA!.y - oldB!.y);
          const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          const oldMid = { x: (oldA!.x + oldB!.x) / 2, y: (oldA!.y + oldB!.y) / 2 };
          const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
          down.set(event.pointerId, current);
          if (oldDistance === 0) return;
          const zoomedCamera = zoomAt(camera, (camera.scale * distance) / oldDistance, oldMid.x, oldMid.y, size());
          setCameraByHand(panBy(zoomedCamera, mid.x - oldMid.x, mid.y - oldMid.y, size()));
          return;
        }
        down.set(event.pointerId, current);
        if (!isZoomed(camera, size())) return;
        if (!dragged && Math.hypot(current.x - dragStart.x, current.y - dragStart.y) > DRAG_THRESHOLD) {
          dragged = true;
          suppressTap = true;
          setPressed(undefined);
        }
        if (dragged) setCameraByHand(panBy(camera, current.x - previous.x, current.y - previous.y, size()));
      });
      const release = (event: { pointerId: number }) => {
        down.delete(event.pointerId);
        // The finger left after a pinch pans from where it is.
        if (down.size === 1) dragged = true;
        setPressed(undefined);
      };
      app.stage.on("pointerup", release);
      app.stage.on("pointerupoutside", release);
      app.stage.on("pointercancel", release);
      app.canvas.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          const rect = app.canvas.getBoundingClientRect();
          setCameraByHand(zoomAt(camera, camera.scale * Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top, size()));
        },
        { passive: false },
      );
      app.stage.on("pointertap", (event) => {
        if (suppressTap) return;
        const { target } = pick(event.global.x, event.global.y);
        if (target.kind === "tile") onTileTapRef.current(target.tile);
        else if (target.kind === "hero") {
          const targetable = candidatesRef.current.targetableIds.includes(target.id);
          if (enemyIdsRef.current.has(target.id) || targetable) onTargetTapRef.current(target.id);
          else onSelectRef.current(target.id);
        }
      });

      // After a resize or rotation the view starts framed on the own Squad again.
      setCamera(camera);
      app.renderer.on("resize", () => setCameraByHand(startFraming()));
    })();

    return () => {
      cancelled = true;
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div ref={host} className="board" role="img" aria-label="Reactor Deck">
    </div>
  );
}
