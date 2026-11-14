import { type Grid, type GridPosition, HeroClass, TileKind, withTile, withWreck } from "game-core";
import { Application, Container, Graphics, Rectangle } from "pixi.js";
import { drawScoutArea, drawTerrain, drawZone, ghostMark, scannedMark, scoutDroneMark } from "./board-drawing";
import { baseFacing } from "./facing";
import { attackBadge, EffectsLayer, type EffectsWorld, hiddenSeenMark, markedMark, slowMark, STATUS_AT_REST_MS } from "./effects-layer";
import { CLIP_SPEED } from "./clip-player";
import type { SceneName } from "./glossary";
import { heroFigure, type HeroPose, marksFigure, shieldBubble } from "./hero-figure";
import { heroMarks, type HeroMarks, IconKind } from "./shield-marks";
import { coverLook, depthOf, footOffset, gridToWorld, VIEW_ANGLE } from "./terrain";
import { areaRing, GHOST_ALPHA, zoneLook, type ZoneState } from "./vision-effects";
import type { EffectCue } from "./weapon-effects";

// The pictures of the glossary screen. Each one is a small board (3 by 3 tiles) drawn with the very functions the board uses
// (`board-drawing.ts`, `hero-figure.ts`, `effects-layer.ts`), rendered once to an image. Nothing here is a copy of a look.

/** Picture size in CSS pixels; the pictures are rendered at twice that. */
export const PICTURE = { width: 220, height: 160, resolution: 2 } as const;
/** The camera scale of a picture: a 3 by 3 board fills the width, with room above the Hero for its marks. */
const CAMERA = 0.55;
const ANGLE = VIEW_ANGLE;
const BACKGROUND = "#12161c";
const CENTRE: GridPosition = { col: 1, row: 1 };

const floor = (): TileKind[][] => [0, 1, 2].map(() => [TileKind.Floor, TileKind.Floor, TileKind.Floor]);
const gridOf = (tiles: TileKind[][]): Grid => ({ width: 3, height: 3, tiles });
const FLOOR_GRID = gridOf(floor());
const ALL_TILES: ReadonlySet<string> = new Set(FLOOR_GRID.tiles.flatMap((line, row) => line.map((_, col) => `${col},${row}`)));

/** One picture being built: the layers of the board and helpers to put Heroes on it. */
class Scene {
  readonly root = new Container();
  readonly floor = new Container();
  readonly planning = new Container();
  readonly objects = new Container();
  /** Everything the scene made, destroyed with it. */
  readonly effects: EffectsLayer;
  private readonly updates: (() => void)[] = [];

  constructor(
    private grid: Grid,
    private readonly cover: { placed?: readonly GridPosition[]; own?: readonly GridPosition[]; destroyed?: readonly GridPosition[] } = {},
    /** A scene with marks high above the Hero zooms out to keep them in the picture. */
    private readonly camera = CAMERA,
  ) {
    this.objects.sortableChildren = true;
    this.root.addChild(this.floor, this.planning, this.objects);
    this.effects = new EffectsLayer(this.objects);
    this.root.scale.set(camera);
    const centre = gridToWorld(CENTRE, ANGLE);
    this.root.position.set(PICTURE.width / 2 - centre.x * camera, PICTURE.height * 0.64 - centre.y * camera);
  }

  /** The floor and the Cover of the grid, as the board draws them. */
  terrain(): this {
    drawTerrain(
      { floor: this.floor, objects: this.objects, planning: this.planning },
      { grid: this.grid, angle: ANGLE, strokeScale: this.camera, lit: ALL_TILES, placedCover: this.cover.placed ?? [], ...(this.cover.own && { ownPlacedCover: this.cover.own }), destroyedCover: this.cover.destroyed ?? [] },
    );
    return this;
  }

  /** A Hero token on `tile`, its feet on the tile. Marks and statuses are children of the token, as on the board. */
  hero(tile: GridPosition, { enemy = false, pose = "idle", heroClass = HeroClass.Bruiser, alpha = 1 }: { enemy?: boolean; pose?: HeroPose; heroClass?: HeroClass; alpha?: number } = {}): Container {
    const { x, y } = gridToWorld(tile, ANGLE);
    const token = new Container();
    token.position.set(x, y + footOffset(ANGLE));
    token.zIndex = depthOf(tile, ANGLE) + 0.5;
    const figure = heroFigure(heroClass, enemy, pose, this.camera, baseFacing(enemy));
    figure.alpha = alpha;
    token.addChild(figure);
    this.objects.addChild(token);
    return token;
  }

  /** Plays `cues` on the effects layer and freezes it `ms` into the frame. Heroes are found by the ids given in `heroes`. */
  cues(cues: readonly EffectCue[], heroes: Record<string, GridPosition>, ms: number, own = true): void {
    const at = (id: string) => {
      const tile = heroes[id];
      if (!tile) return undefined;
      const { x, y } = gridToWorld(tile, ANGLE);
      return { x, y: y + footOffset(ANGLE) };
    };
    const world: EffectsWorld = { place: at, tile: (tile) => gridToWorld(tile, ANGLE), own: () => own, builtCover: (tile, grow) => coverLook(tile, "half", true, ANGLE, grow) };
    this.effects.play(cues, 0, world, false);
    this.updates.push(() => this.effects.update(ms / CLIP_SPEED));
  }

  /** Runs the frozen animations and returns the root to render. */
  finish(): Container {
    for (const update of this.updates) update();
    return this.root;
  }
}

const HERO_AT = CENTRE;

/** The marks above a Hero as the board draws them: the rubies, the icons and, for Shield, the bubble. */
function addMarks(token: Container, marks: HeroMarks, camera = CAMERA): void {
  if (marks.rubies > 0 || marks.icons.length > 0) token.addChild(marksFigure(marks, camera));
  if (marks.bubble) token.addChild(shieldBubble(camera));
}

const heldShield = (shield: number): HeroMarks => heroMarks({ own: true, shield, resolving: false, heroClass: HeroClass.Bruiser });

/** A Hero with a floating number or tag, the way the effects layer draws it. */
function numberScene(cues: EffectCue[], ms = 330): Container {
  const scene = new Scene(FLOOR_GRID).terrain();
  scene.hero(HERO_AT, { enemy: true });
  scene.cues(cues, { target: HERO_AT }, ms);
  return scene.finish();
}

const number = (text: string, style: "damage" | "bonus" | "shield" | "failed", drop?: number): EffectCue => ({ kind: "number", toId: "target", startMs: 0, text, style, ...(drop !== undefined && { drop }) });

function zoneScene(state: ZoneState, filled: number): Container {
  const grid = gridOf([0, 1, 2].map(() => [TileKind.PrimeZone, TileKind.PrimeZone, TileKind.PrimeZone]));
  const scene = new Scene(grid);
  scene.terrain();
  drawZone(scene.planning, grid, ANGLE, zoneLook(state, filled));
  return scene.finish();
}

function slideScene(tag: string, from: GridPosition, to: GridPosition): Container {
  const scene = new Scene(FLOOR_GRID).terrain();
  scene.hero(to, { enemy: true });
  scene.cues([{ kind: "knockback", toId: "target", from, to, startMs: 0, tag }], { target: to }, 300);
  return scene.finish();
}

/** A Pull a moment after the slide: the tether to the caster, the echoes behind the Hero and the first of the arrival ring. */
function pullScene(from: GridPosition, to: GridPosition, caster: GridPosition): Container {
  const scene = new Scene(FLOOR_GRID).terrain();
  scene.hero(caster);
  scene.hero(to, { enemy: true });
  scene.cues([{ kind: "pull", toId: "target", from, to, startMs: 0, casterId: "caster", tag: "PULL 2" }], { target: to, caster }, 300, false);
  return scene.finish();
}

const SCENES: Record<SceneName, () => Container> = {
  shield() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT);
    addMarks(token, heldShield(2));
    return scene.finish();
  },
  plannedBlock() {
    const scene = new Scene(FLOOR_GRID).terrain();
    addMarks(scene.hero(HERO_AT), { rubies: 1, filled: false, ticks: [2], bubble: false, icons: [] });
    return scene.finish();
  },
  slow() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT, { enemy: true });
    const mark = slowMark();
    mark.update(STATUS_AT_REST_MS);
    token.addChild(mark.container);
    return scene.finish();
  },
  marked() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT, { enemy: true });
    const mark = markedMark();
    mark.update(STATUS_AT_REST_MS);
    token.addChild(mark.container);
    return scene.finish();
  },
  hidden() {
    const scene = new Scene(FLOOR_GRID).terrain();
    scene.hero(HERO_AT, { heroClass: HeroClass.Assassin, alpha: 0.55 });
    return scene.finish();
  },
  ghost() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT, { enemy: true, alpha: GHOST_ALPHA });
    token.addChild(ghostMark());
    return scene.finish();
  },
  exhaustion() {
    const wreck = withWreck(FLOOR_GRID, HERO_AT);
    const scene = new Scene(wreck).terrain();
    scene.hero(HERO_AT, { pose: "exhausted" });
    return scene.finish();
  },
  overdrive() {
    const scene = new Scene(FLOOR_GRID).terrain();
    scene.hero(HERO_AT);
    scene.cues([{ kind: "aura", heroId: "target", endMs: 1800 }], { target: HERO_AT }, 560);
    return scene.finish();
  },
  attackBonus() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT);
    const badge = attackBadge();
    badge.update(STATUS_AT_REST_MS);
    token.addChild(badge.container);
    return scene.finish();
  },
  plannedIcons() {
    const scene = new Scene(FLOOR_GRID, {}, 0.42).terrain();
    addMarks(scene.hero(HERO_AT), {
      rubies: 0,
      filled: false,
      ticks: [],
      bubble: false,
      icons: [
        { kind: IconKind.Wait, tick: 1 },
        { kind: IconKind.SelfCard, tick: 3 },
      ],
    }, 0.42);
    return scene.finish();
  },
  crossfire() {
    return numberScene([number("-3", "damage"), { kind: "crossfire", toId: "target", startMs: 0, amount: 1, stack: 0 }], 200);
  },
  deckDamage: () => numberScene([number("-2", "damage")]),
  longRangeBonus: () => numberScene([number("-4", "bonus")]),
  shieldLoss: () => numberScene([number("Shield -2", "shield")]),
  blocked: () => numberScene([number("Blocked", "failed")]),
  outOfRange: () => numberScene([number("Out of range", "failed")]),
  tooClose: () => numberScene([number("Too close", "failed")]),
  halfCoverTag() {
    return numberScene([number("-1", "damage"), number("Half Cover", "failed", 9)]);
  },
  knockback: () => slideScene("Knockback 2", { col: 0, row: 1 }, CENTRE),
  pull: () => pullScene({ col: 2, row: 1 }, CENTRE, { col: 0, row: 1 }),
  hiddenSeen() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const token = scene.hero(HERO_AT, { enemy: true, heroClass: HeroClass.Assassin, alpha: 0.55 });
    token.addChild(hiddenSeenMark());
    return scene.finish();
  },
  charge() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const enemy = { col: HERO_AT.col + 1, row: HERO_AT.row };
    const token = scene.hero(HERO_AT);
    addMarks(token, heldShield(1));
    scene.hero(enemy, { enemy: true });
    scene.cues(
      [
        { kind: "charge", heroId: "target", targetId: "foe", startMs: 0 },
        { kind: "number", toId: "target", startMs: 0, text: "SHIELD 1 · THIS ROUND", style: "shield", drop: -8 },
      ],
      { target: HERO_AT, foe: enemy },
      300,
    );
    return scene.finish();
  },
  closeAndCharge() {
    return numberScene(
      [
        number("-4", "damage"),
        { kind: "bonus", toId: "target", startMs: 0, text: "CLOSE +1", tone: "close", stack: 0 },
        { kind: "bonus", toId: "target", startMs: 0, text: "CHARGE +1", tone: "charge", stack: 1 },
      ],
      200,
    );
  },
  cover() {
    const grid = withTile(withTile(FLOOR_GRID, { col: 0, row: 1 }, TileKind.HalfCover), { col: 2, row: 1 }, TileKind.FullCover);
    return new Scene(grid).terrain().finish();
  },
  placedCover() {
    const placed = [CENTRE];
    return new Scene(withTile(FLOOR_GRID, CENTRE, TileKind.HalfCover), { placed }).terrain().finish();
  },
  destroyedCover() {
    return new Scene(FLOOR_GRID, { destroyed: [CENTRE] }).terrain().finish();
  },
  zoneEmpty: () => zoneScene("neutral", 0),
  zoneOurs: () => zoneScene("own", 1),
  zoneContested: () => zoneScene("contested", 0),
  zoneEnemy: () => zoneScene("enemy", 0),
  outposts() {
    const grid = withTile(withTile(FLOOR_GRID, { col: 0, row: 0 }, TileKind.Outpost), { col: 2, row: 2 }, TileKind.Outpost);
    return new Scene(grid).terrain().finish();
  },
  scoutArea() {
    const scene = new Scene(FLOOR_GRID, {}, 0.42).terrain();
    drawScoutArea(scene.planning, FLOOR_GRID, ANGLE, { center: CENTRE, size: 3, remaining: 2 }, (tile) => areaRing(CENTRE, tile));
    scene.hero(HERO_AT, { enemy: true });
    // The drone mid-scan: rays down to the corners and the ring over the floor.
    const drone = scoutDroneMark(CENTRE, 3, ANGLE, false);
    drone.update(250);
    scene.objects.addChild(drone.container);
    return scene.finish();
  },
  scannedArea() {
    const scene = new Scene(FLOOR_GRID).terrain();
    const mark = scannedMark(CENTRE, 3, 2, ANGLE, false);
    mark.update(600);
    scene.planning.addChild(mark.container);
    scene.hero(HERO_AT);
    return scene.finish();
  },
};

export const SCENE_NAMES = Object.keys(SCENES) as SceneName[];

/** Draws the scene as the board does and returns it; the caller renders and destroys it. */
export function drawScene(name: SceneName): Container {
  return SCENES[name]();
}

/** Renders each scene once, in one off-screen Pixi application, to a PNG data URL. */
export async function renderScenes(names: readonly SceneName[]): Promise<Map<SceneName, string>> {
  // The tags are text: the fonts must be loaded before the first picture is drawn.
  await Promise.all(["700 12px 'IBM Plex Mono'", "700 12px Rajdhani"].map((font) => document.fonts.load(font))).catch(() => undefined);
  const app = new Application();
  await app.init({ width: PICTURE.width, height: PICTURE.height, resolution: PICTURE.resolution, background: BACKGROUND, antialias: true, preference: "webgl" });
  const pictures = new Map<SceneName, string>();
  try {
    for (const name of names) {
      const root = drawScene(name);
      const frame = new Container();
      frame.addChild(new Graphics().rect(0, 0, PICTURE.width, PICTURE.height).fill(BACKGROUND), root);
      pictures.set(name, await app.renderer.extract.base64({ target: frame, frame: new Rectangle(0, 0, PICTURE.width, PICTURE.height), resolution: PICTURE.resolution, antialias: true }));
      frame.destroy({ children: true });
    }
  } finally {
    app.destroy(true, { children: true });
  }
  return pictures;
}
