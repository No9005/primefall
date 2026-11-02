import {
  CoverKind,
  coverAt,
  destroyCover,
  type GridPosition,
  type HeroClass,
  REACTOR_DECK,
  type RevealedArea,
  TileKind,
  tileAt,
  withTile,
} from "game-core";
import { Application, Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import { type MutableRefObject, useEffect, useRef, useState } from "react";
import type { BoardPick, Point } from "./card-drag";
import {
  beginMoveFraming,
  buildPlacements,
  type Camera,
  type CameraView,
  endMoveFraming,
  fitCamera,
  frameMoveCamera,
  type MoveFraming,
  takeOverFraming,
  gridToWorld,
  isZoomed,
  Layer,
  panBy,
  pickTileAt,
  resolveTap,
  TILE_HEIGHT,
  TILE_WIDTH,
  viewToWorld,
  zoomAt,
  zoomOnPoint,
} from "./board-layout";

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

/** The containers the terrain is drawn into, and the sprite anchors from the asset manifest. */
interface Terrain {
  floor: Container;
  objects: Container;
  planning: Container;
  anchors: Map<string, number[]>;
}

interface BoardProps {
  /** Cover tiles the Squad has seen destroyed; the board draws them as open floor. */
  destroyedCover: readonly GridPosition[];
  /** Temporary Half Cover the Squad knows of: drawn as Half Cover with a cyan outline. */
  placedCover: readonly GridPosition[];
  /** Areas a Scout Drone reveals: tinted yellow. */
  revealedAreas: readonly RevealedArea[];
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
  /** Position of the Hero whose Move is armed: while set, the camera eases to it and its highlights. */
  moveFrameHero?: GridPosition;
  /** While a card is dragged: short labels on the Heroes or tiles that take a drop. */
  zoneLabels: readonly { position: GridPosition; text: string }[];
  /** While a card is dragged: a tinted area (the Range of a card played here). */
  areaTiles: readonly GridPosition[];
  /** Filled with a function that tells what the board has under a viewport point, for dropping a dragged card. */
  pickRef: MutableRefObject<((point: Point) => BoardPick) | undefined>;
}

/** Length of the camera ease when a Move is armed, placed or cancelled. */
const FRAME_MS = 250;

function tileDiamond(): number[] {
  return [0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0];
}

export function Board({
  destroyedCover,
  placedCover,
  revealedAreas,
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
  zoneLabels,
  areaTiles,
  pickRef,
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
  const [pressed, setPressed] = useState<GridPosition>();
  const [zoomed, setZoomed] = useState(false);
  const cameraControl = useRef<{ toggle: () => void; frame: (hero: GridPosition) => void; release: () => void } | undefined>(undefined);
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
    for (const tile of areaTiles) {
      const { x, y } = gridToWorld(tile);
      const tint = new Graphics().poly(tileDiamond()).fill({ color: 0xff8a3d, alpha: 0.2 }).stroke({ width: 1, color: 0xff8a3d, alpha: 0.5 });
      tint.position.set(x, y);
      overlay.addChild(tint);
      created.push(tint);
    }
    for (const tile of highlights) {
      const { x, y } = gridToWorld(tile);
      const diamond = new Graphics().poly(tileDiamond()).fill({ color: 0x2ec4b6, alpha: 0.35 }).stroke({ width: 4, color: 0x2ec4b6 });
      diamond.position.set(x, y);
      overlay.addChild(diamond);
      created.push(diamond);
    }
    if (pressed) {
      // The tile under the finger, drawn larger than the tile so the finger does not hide it.
      const { x, y } = gridToWorld(pressed);
      const preview = new Graphics().poly(tileDiamond()).fill({ color: 0xffffff, alpha: 0.3 }).stroke({ width: 6, color: 0xffffff });
      preview.position.set(x, y);
      preview.scale.set(1.15);
      overlay.addChild(preview);
      created.push(preview);
    }
    markers.forEach(({ position, label }) => {
      const { x, y } = gridToWorld(position);
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
      const { x, y } = gridToWorld(position);
      const label = new Container();
      label.position.set(x, y - TILE_HEIGHT * 1.5);
      const caption = new Text({ text, style: { fill: 0x12161c, fontSize: 22, fontWeight: "700" } });
      caption.anchor.set(0.5);
      label.addChild(new Graphics().roundRect(-caption.width / 2 - 8, -16, caption.width + 16, 32, 6).fill(0xffffff), caption);
      overlay.addChild(label);
      created.push(label);
    });
    return () => created.forEach((child) => child.destroy({ children: true }));
  }, [overlay, highlights, markers, pressed, zoneLabels, areaTiles]);

  useEffect(() => {
    if (!tokens) return;
    const created: Container[] = [];
    const ring = (color: number) =>
      new Graphics().ellipse(0, -TILE_HEIGHT / 2, TILE_WIDTH * 0.42, TILE_HEIGHT * 0.42).stroke({ width: 4, color });
    const addToken = (hero: TokenHero, enemy: boolean) => {
      const { x, y } = gridToWorld(hero.position);
      const token = new Container();
      token.position.set(x, y + TILE_HEIGHT / 2);
      token.zIndex = hero.position.col + hero.position.row + 0.5;
      const targetable = targetableIds.includes(hero.id);
      if (hero.id === selectedId) token.addChild(ring(0x2ec4b6));
      if (targetable) token.addChild(ring(enemy ? 0xe5484d : 0x5ad17a));
      const pose = hero.exhausted ? "exhausted" : hitIds.includes(hero.id) ? "hit" : "idle";
      const sprite = new Sprite(Assets.get(`heroes.${hero.heroClass}.${pose}`));
      sprite.anchor.set(0.5, 1);
      // Enemies carry a red tint so the two Squads are told apart.
      if (enemy) sprite.tint = 0xffb3b3;
      if (hero.ghost) sprite.alpha = 0.35;
      if (hero.hidden) sprite.alpha = 0.55;
      token.addChild(sprite);
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
    heroes.forEach((hero) => addToken(hero, false));
    enemies.forEach((hero) => addToken(hero, true));
    return () => created.forEach((token) => token.destroy({ children: true }));
  }, [tokens, heroes, enemies, selectedId, targetableIds, hitIds]);

  // The terrain is drawn again when Cover the Squad has seen destroyed changes.
  useEffect(() => {
    if (!terrain) return;
    const { floor, objects, planning, anchors } = terrain;
    const known = destroyedCover.reduce(destroyCover, REACTOR_DECK);
    const grid = placedCover.reduce((current, tile) => withTile(current, tile, TileKind.HalfCover), known);
    const created: Container[] = [];
    for (const { alias, x, y, layer, depth } of buildPlacements(grid)) {
      const sprite = new Sprite(Assets.get(alias));
      const [anchorX, anchorY] = anchors.get(alias) ?? [0.5, 1];
      sprite.anchor.set(anchorX, anchorY);
      sprite.position.set(x, y);
      sprite.zIndex = depth;
      (layer === Layer.Floor ? floor : objects).addChild(sprite);
      created.push(sprite);
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
        const color = destroyed ? 0x8a8f98 : placed ? 0x7be0ff : cover === CoverKind.Full ? 0xff8a3d : 0x4aa3ff;
        const { x, y } = gridToWorld({ col, row });
        const outline = new Graphics().poly(tileDiamond()).stroke({ width: destroyed ? 2 : placed ? 5 : 3, color, alpha: destroyed ? 0.6 : 0.9 });
        outline.position.set(x, y);
        planning.addChild(outline);
        created.push(outline);
      }),
    );

    // Revealed areas: every tile of the square, clipped to the Grid, gets a yellow tint.
    for (const { center, size } of revealedAreas) {
      const reach = Math.floor(size / 2);
      for (let row = center.row - reach; row <= center.row + reach; row++) {
        for (let col = center.col - reach; col <= center.col + reach; col++) {
          if (tileAt(grid, { col, row }) === undefined) continue;
          const { x, y } = gridToWorld({ col, row });
          const tint = new Graphics().poly(tileDiamond()).fill({ color: 0xffd447, alpha: 0.22 }).stroke({ width: 1, color: 0xffd447, alpha: 0.5 });
          tint.position.set(x, y);
          planning.addChild(tint);
          created.push(tint);
        }
      }
    }
    return () => created.forEach((child) => child.destroy({ children: true }));
  }, [terrain, destroyedCover, placedCover, revealedAreas]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    const app = new Application();

    void (async () => {
      const [manifest] = await Promise.all([
        loadAssets(),
        app.init({ background: "#12161c", resizeTo: element, antialias: true, autoDensity: true, resolution: window.devicePixelRatio }),
      ]);
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      element.appendChild(app.canvas);

      const anchors = new Map(manifest.bundles.flatMap((b) => b.assets).map((a) => [a.alias, a.data?.anchor ?? [0.5, 1]]));
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

      setTerrain({ floor, objects, planning, anchors });

      const size = (): CameraView => ({ width: app.screen.width, height: app.screen.height });
      let camera = fitCamera(size());
      const setCamera = (next: Camera) => {
        camera = next;
        world.scale.set(camera.scale);
        world.position.set(camera.x, camera.y);
        setZoomed(isZoomed(camera, size()));
      };
      // Eases to a camera in FRAME_MS; jumps when the player prefers reduced motion.
      let animation: number | undefined;
      const stopAnimation = () => {
        if (animation !== undefined) cancelAnimationFrame(animation);
        animation = undefined;
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
      cameraControl.current = {
        toggle: () => {
          const hero = candidatesRef.current.heroes.find((h) => h.id === selectedIdRef.current);
          if (isZoomed(camera, size()) || !hero) setCameraByHand(fitCamera(size()));
          else setCameraByHand(zoomOnPoint(gridToWorld(hero.position), size()));
        },
        frame: (hero) => {
          framing ??= beginMoveFraming(camera);
          if (framing.automatic) animateTo(frameMoveCamera(hero, candidatesRef.current.highlights, size()));
        },
        release: () => {
          if (framing?.automatic) animateTo(endMoveFraming(framing, camera));
          framing = undefined;
        },
      };

      const pick = (viewX: number, viewY: number) => {
        const { x, y } = viewToWorld(viewX, viewY, app.screen.width, app.screen.height, undefined, camera);
        return { x, y, target: resolveTap(x, y, candidatesRef.current) };
      };
      pickRef.current = ({ x: clientX, y: clientY }) => {
        const rect = app.canvas.getBoundingClientRect();
        const { x, y, target } = pick(clientX - rect.left, clientY - rect.top);
        return { target, ground: pickTileAt(x, y) };
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
          setPressed(target.kind === "tile" ? target.tile : pickTileAt(x, y));
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
      <button
        type="button"
        className="board-zoom"
        aria-label={zoomed ? "Fit board" : "Zoom on selected Hero"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => cameraControl.current?.toggle()}
      >
        {zoomed ? "Fit" : "Zoom"}
      </button>
    </div>
  );
}
