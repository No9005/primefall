import { CoverKind, coverAt, type GridPosition, type HeroClass, REACTOR_DECK } from "game-core";
import { Application, Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { buildPlacements, computeCamera, gridToWorld, Layer, TILE_HEIGHT, TILE_WIDTH } from "./board-layout";

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
  /** A Ghost: drawn faded at its last known position and not selectable as a target. */
  ghost?: boolean;
}

interface BoardProps {
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
}

function tileDiamond(): number[] {
  return [0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0];
}

export function Board({
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
}: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Container>();
  const [overlay, setOverlay] = useState<Container>();
  // Always the latest callbacks, so the pixi sprites need not be rebuilt for them.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTargetTapRef = useRef(onTargetTap);
  onTargetTapRef.current = onTargetTap;
  const onTileTapRef = useRef(onTileTap);
  onTileTapRef.current = onTileTap;

  useEffect(() => {
    if (!overlay) return;
    const created: Container[] = [];
    for (const tile of highlights) {
      const { x, y } = gridToWorld(tile);
      const diamond = new Graphics().poly(tileDiamond()).fill({ color: 0x2ec4b6, alpha: 0.35 }).stroke({ width: 2, color: 0x2ec4b6 });
      diamond.position.set(x, y);
      diamond.eventMode = "static";
      diamond.cursor = "pointer";
      diamond.on("pointertap", () => onTileTapRef.current(tile));
      overlay.addChild(diamond);
      created.push(diamond);
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
    return () => created.forEach((child) => child.destroy({ children: true }));
  }, [overlay, highlights, markers]);

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
      token.addChild(sprite);
      if (hero.slowed && !hero.exhausted) {
        const indicator = new Sprite(Assets.get("vfx.slow_indicator"));
        indicator.anchor.set(0.5, 1);
        token.addChild(indicator);
      }
      token.eventMode = "static";
      token.cursor = "pointer";
      token.on("pointertap", () => (enemy || targetable ? onTargetTapRef.current(hero.id) : onSelectRef.current(hero.id)));
      tokens.addChild(token);
      created.push(token);
    };
    heroes.forEach((hero) => addToken(hero, false));
    enemies.forEach((hero) => addToken(hero, true));
    return () => created.forEach((token) => token.destroy({ children: true }));
  }, [tokens, heroes, enemies, selectedId, targetableIds, hitIds]);

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

      for (const { alias, x, y, layer, depth } of buildPlacements(REACTOR_DECK)) {
        const sprite = new Sprite(Assets.get(alias));
        const [anchorX, anchorY] = anchors.get(alias) ?? [0.5, 1];
        sprite.anchor.set(anchorX, anchorY);
        sprite.position.set(x, y);
        sprite.zIndex = depth;
        (layer === Layer.Floor ? floor : objects).addChild(sprite);
      }

      // Cover tiles get an outline on the floor: orange for Full Cover, blue for Half Cover.
      REACTOR_DECK.tiles.forEach((line, row) =>
        line.forEach((_, col) => {
          const cover = coverAt(REACTOR_DECK, { col, row });
          if (cover === CoverKind.None) return;
          const color = cover === CoverKind.Full ? 0xff8a3d : 0x4aa3ff;
          const { x, y } = gridToWorld({ col, row });
          const outline = new Graphics().poly(tileDiamond()).stroke({ width: 3, color, alpha: 0.9 });
          outline.position.set(x, y);
          planning.addChild(outline);
        }),
      );

      const frame = () => {
        const camera = computeCamera(app.screen.width, app.screen.height);
        world.scale.set(camera.scale);
        world.position.set(camera.x, camera.y);
      };
      frame();
      app.renderer.on("resize", frame);
    })();

    return () => {
      cancelled = true;
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={host} className="board" role="img" aria-label="Reactor Deck" />;
}
