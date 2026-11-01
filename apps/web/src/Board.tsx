import { REACTOR_DECK } from "game-core";
import { Application, Assets, Container, Sprite } from "pixi.js";
import { useEffect, useRef } from "react";
import { buildPlacements, computeCamera } from "./board-layout";

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

export function Board() {
  const host = useRef<HTMLDivElement>(null);

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

      for (const { alias, x, y, layer, depth } of buildPlacements(REACTOR_DECK)) {
        const sprite = new Sprite(Assets.get(alias));
        const [anchorX, anchorY] = anchors.get(alias) ?? [0.5, 1];
        sprite.anchor.set(anchorX, anchorY);
        sprite.position.set(x, y);
        sprite.zIndex = depth;
        (layer === "floor" ? floor : objects).addChild(sprite);
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
