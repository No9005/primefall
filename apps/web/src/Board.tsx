import { REACTOR_DECK, type HeroView } from "game-core";
import { Application, Assets, Container, Graphics, Sprite } from "pixi.js";
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

interface BoardProps {
  heroes: readonly HeroView[];
  selectedId: string;
  onSelect: (heroId: string) => void;
}

export function Board({ heroes, selectedId, onSelect }: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Container>();
  // Always the latest callback, so the pixi sprites need not be rebuilt for it.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      world.addChild(floor, objects);
      app.stage.addChild(world);
      // Hero tokens sort together with the props, by tile depth.
      setTokens(objects);

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
