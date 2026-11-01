import { type GridPosition, REACTOR_DECK, type HeroView } from "game-core";
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

interface BoardProps {
  heroes: readonly HeroView[];
  selectedId: string;
  onSelect: (heroId: string) => void;
  /** Tiles the player may tap right now. */
  highlights: readonly GridPosition[];
  markers: readonly BoardMarker[];
  onTileTap: (tile: GridPosition) => void;
}

function tileDiamond(): number[] {
  return [0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0];
}

export function Board({ heroes, selectedId, onSelect, highlights, markers, onTileTap }: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Container>();
  const [overlay, setOverlay] = useState<Container>();
  // Always the latest callbacks, so the pixi sprites need not be rebuilt for them.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
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
    for (const hero of heroes) {
      const { x, y } = gridToWorld(hero.position);
      const bottom = y + TILE_HEIGHT / 2;
      const token = new Container();
      token.position.set(x, bottom);
      token.zIndex = hero.position.col + hero.position.row + 0.5;
      if (hero.id === selectedId) {
        const ring = new Graphics().ellipse(0, -TILE_HEIGHT / 2, TILE_WIDTH * 0.42, TILE_HEIGHT * 0.42).stroke({ width: 4, color: 0x2ec4b6 });
        token.addChild(ring);
      }
      const sprite = new Sprite(Assets.get(`heroes.${hero.heroClass}.idle`));
      sprite.anchor.set(0.5, 1);
      token.addChild(sprite);
      token.eventMode = "static";
      token.cursor = "pointer";
      token.on("pointertap", () => onSelectRef.current(hero.id));
      tokens.addChild(token);
      created.push(token);
    }
    return () => created.forEach((token) => token.destroy({ children: true }));
  }, [tokens, heroes, selectedId]);

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
