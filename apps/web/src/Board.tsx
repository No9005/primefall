import {
  CoverKind,
  coverAt,
  destroyCover,
  type GridPosition,
  type HeroClass,
  type RangeTile,
  REACTOR_DECK,
  type RevealedArea,
  TileKind,
  tileAt,
  withTile,
  withWreck,
} from "game-core";
import { Application, Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import { type MutableRefObject, useEffect, useRef, useState } from "react";
import type { BoardPick, Point } from "./card-drag";
import {
  beginMoveFraming,
  type Camera,
  type CameraView,
  endMoveFraming,
  fitCamera,
  frameMoveCamera,
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
import { buildTerrain, depthOf, type Face, floorOutline, footOffset, lineScale, litTiles, turnView, VIEW_ANGLE, VIEW_STEP, worldLineWidth } from "./terrain";
import { heroFigure, marksFigure, shieldBubble } from "./hero-figure";
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
  /** Tiles the player may tap right now. */
  highlights: readonly GridPosition[];
  markers: readonly BoardMarker[];
  onTileTap: (tile: GridPosition) => void;
  /** Position of the Hero whose Move (or tile pick) is armed: while set, the camera eases to it and its highlights, inside the free area. */
  moveFrameHero?: GridPosition;
  /** A faint tint over the Prime Zone tiles: teal while the own Squad holds it, amber while contested, steel otherwise. */
  zoneTint: keyof typeof TERRAIN_STYLE.zoneTint;
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
  const [tokens, setTokens] = useState<Container>();
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
  const enemyIdsRef = useRef(new Set<string>());
  enemyIdsRef.current = new Set(enemies.map((hero) => hero.id));
  const bubbleSeen = useRef(new Set<string>());
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
    const ring = (color: number) =>
      new Graphics().ellipse(0, -TILE_HEIGHT / 2, TILE_WIDTH * 0.42, TILE_HEIGHT * 0.42).stroke({ width: 4, color });
    const addToken = (hero: TokenHero, enemy: boolean) => {
      const { x, y } = gridToWorld(hero.position, angle);
      const token = new Container();
      token.position.set(x, y + footOffset(angle));
      token.zIndex = depthOf(hero.position, angle) + 0.5;
      const targetable = targetableIds.includes(hero.id);
      if (hero.id === selectedId) token.addChild(ring(0x2ec4b6));
      const cannotHit = shotLines.some((shot) => shot.targetId === hero.id && !shot.ringed);
      if (targetable && !cannotHit) {
        const targetRing = ring(enemy ? 0xe5484d : 0x2ec4b6);
        token.addChild(targetRing);
        pulsingRings.push(targetRing);
      }
      const pose = hero.exhausted ? "exhausted" : hitIds.includes(hero.id) ? "hit" : "idle";
      // The enemy Squad is told apart by the red ring under the figure.
      const figure = heroFigure(hero.heroClass, enemy, pose, strokeScale);
      if (hero.ghost) figure.alpha = 0.35;
      if (hero.hidden) figure.alpha = 0.55;
      token.addChild(figure);
      const heroMarks = hero.ghost ? undefined : marks[hero.id];
      if (heroMarks && (heroMarks.rubies > 0 || heroMarks.icons.length > 0)) {
        token.addChild(marksFigure(heroMarks, strokeScale));
      }
      if (heroMarks?.bubble) {
        const bubble = shieldBubble(strokeScale);
        token.addChild(bubble);
        if (!bubbleSeen.current.has(hero.id)) cancels.push(animateAppear(bubble, HERO_STYLE.marks.bubble.appearMs));
      } else if (bubbleSeen.current.has(hero.id) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // The Shield was used up or expired: the bubble fades away (not with reduced motion).
        const bubble = shieldBubble(strokeScale);
        token.addChild(bubble);
        cancels.push(animateFadeOut(bubble, HERO_STYLE.marks.bubble.appearMs));
      }
      if (hero.marked && !hero.exhausted && !hero.ghost) {
        // A red downward marker above the head.
        const mark = new Graphics().poly([-12, -8, 12, -8, 0, 12]).fill(0xe5484d).stroke({ width: 2, color: 0x12161c });
        mark.position.set(0, -TILE_HEIGHT * 1.6);
        token.addChild(mark);
      }
      if (hero.slowed && !hero.exhausted) {
        const indicator = new Sprite(Assets.get("vfx.slow_indicator"));
        indicator.anchor.set(0.5, 1);
        token.addChild(indicator);
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
    return () => {
      cancelAnimationFrame(pulseFrame);
      cancels.forEach((cancel) => cancel());
      created.forEach((token) => token.destroy({ children: true }));
    };
  }, [tokens, angle, strokeScale, heroes, enemies, selectedId, targetableIds, hitIds, shotLines, marks]);

  // The terrain is drawn again when Cover the Squad has seen destroyed changes.
  useEffect(() => {
    if (!terrain) return;
    const { floor, objects, planning } = terrain;
    const known = destroyedCover.reduce(destroyCover, REACTOR_DECK);
    const withPlaced = placedCover.reduce((current, tile) => withTile(current, tile, TileKind.HalfCover), known);
    const grid = wreckCover.reduce(withWreck, withPlaced);
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

    grid.tiles.forEach((line, row) =>
      line.forEach((kind, col) => {
        if (kind !== TileKind.PrimeZone) return;
        const { x, y } = gridToWorld({ col, row }, angle);
        const tint = new Graphics().poly(floorOutline(angle)).fill({ color: TERRAIN_STYLE.zoneTint[zoneTint], alpha: 0.18 });
        tint.position.set(x, y);
        planning.addChild(tint);
        created.push(tint);
      }),
    );

    // Revealed areas: every tile of the square, clipped to the Grid, gets a yellow tint.
    for (const { center, size } of revealedAreas) {
      const reach = Math.floor(size / 2);
      for (let row = center.row - reach; row <= center.row + reach; row++) {
        for (let col = center.col - reach; col <= center.col + reach; col++) {
          if (tileAt(grid, { col, row }) === undefined) continue;
          const { x, y } = gridToWorld({ col, row }, angle);
          const tint = new Graphics().poly(floorOutline(angle)).fill({ color: 0xffd447, alpha: 0.22 }).stroke({ width: 1, color: 0xffd447, alpha: 0.5 });
          tint.position.set(x, y);
          planning.addChild(tint);
          created.push(tint);
        }
      }
    }
    return () => created.forEach((child) => child.destroy({ children: true }));
  }, [terrain, angle, strokeScale, destroyedCover, placedCover, wreckCover, revealedAreas, visibleTiles, heroes, zoneTint]);

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
      world.addChild(floor, planning, objects);
      app.stage.addChild(world);
      // Hero tokens sort together with the props, by tile depth.
      setTokens(objects);
      // Highlights and markers lie on the floor; markers would hide behind props, which is acceptable.
      setOverlay(planning);

      setTerrain({ floor, objects, planning });

      const size = (): CameraView => ({ width: app.screen.width, height: app.screen.height, angle: angleRef.current });
      let camera = fitCamera(size());
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

      // After a resize or rotation the view starts fitted again.
      setCamera(camera);
      app.renderer.on("resize", () => setCameraByHand(fitCamera(size())));
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
