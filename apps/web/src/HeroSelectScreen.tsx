import { HeroClass } from "game-core";
import { useEffect, useReducer, useRef, useState } from "react";
import { gameAudio } from "./audio";
import { HANGAR_HEROES, HangarHeroes, HERO_OF } from "./hangar-select";
import { HANGAR_SCENE_NAME, HANGAR_SHIFT, hangarScene, PLACE } from "./hangar-scene";
import { HERO_NAMES, HERO_PROFILES, SELECTABLE_HEROES } from "./hero-select";
import { StageLayer } from "./StageLayer";
import { computeFit } from "./stage-fit";
import "./hero-select.css";
import "./hangar-select.css";

// The Hero Select in the hangar of the Notstrom (docs/design/decisions.md, the design canvas "Hangar: Max, Tilly and Kit"). The picture (the
// hangar, the lamps, dust, the three Heroes with their shadows and name plates) is the scene "hangar" on the stage (hangar-scene.ts, ADR 0026).
// This screen owns the machine of the three Heroes (hangar-select.ts) and the UI over the canvas: a tap area for each Hero, BACK and NEXT.
// The Side Select still uses the 844 x 390 stage of the earlier Hero Select.

export const SCREEN = { width: 844, height: 390 };
/** BACK and NEXT: their size in design pixels, how far they stand above the frame's lower edge, and how far from the edge of the window (CSS pixels). */
const NAV = { width: 150, height: 45, lift: 14, edge: 20 };

export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const windowFit = () => computeFit(window.innerWidth, window.innerHeight, window.devicePixelRatio);

interface HeroSelectScreenProps {
  /** The Hero chosen when the screen opens (none: all three idle and NEXT waits). */
  initial?: HeroClass;
  onBack: () => void;
  onStart: (hero: HeroClass) => void;
}

/** The sounds of the act clip of a Hero as one pass of it begins (only Tilly has any: fiddling, the arm tearing off, her gasp). */
function playActSounds(hero: (typeof HANGAR_HEROES)[number]): void {
  gameAudio.playMoment("hangarAct", { heroId: `select-${HERO_OF[hero]}`, heroClass: HERO_OF[hero], tile: undefined });
}

export function HeroSelectScreen({ initial, onBack, onStart }: HeroSelectScreenProps) {
  const [fit, setFit] = useState(windowFit);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const heroes = useRef<HangarHeroes | undefined>(undefined);

  useEffect(() => {
    // The sounds of the three Heroes load while the player looks at them; leaving the screen silences a line that still runs.
    void Promise.all([gameAudio.load(SELECTABLE_HEROES), gameAudio.loadMap()]);
    // The intro of the music plays under the Hero Select.
    void gameAudio.loadMusic().then(() => gameAudio.startIntro());
    return () => {
      gameAudio.stopAll();
      gameAudio.stopIntro();
    };
  }, []);

  useEffect(() => {
    const onResize = () => setFit(windowFit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const made = new HangarHeroes(() => {
      redraw();
      hangarScene.invalidate();
    }, prefersReducedMotion(), undefined, playActSounds);
    heroes.current = made;
    made.start(initial);
    hangarScene.attach(made);
    redraw();
    return () => {
      hangarScene.attach(undefined);
      made.dispose();
      heroes.current = undefined;
    };
    // The screen opens once with its initial Hero.
  }, []);

  const all = heroes.current?.players;
  const chosen = heroes.current?.selected;

  const tap = (hero: (typeof HANGAR_HEROES)[number]) => {
    const now = heroes.current?.tap(hero);
    if (now) {
      gameAudio.stopAll();
      gameAudio.playMoment("heroSelected", { heroId: `select-${HERO_OF[now]}`, heroClass: HERO_OF[now], tile: undefined });
    }
    gameAudio.setSelectDrone(now === "tilly"); // Tilly's drone hums while she is the chosen Hero
  };

  const nav = { width: NAV.width * fit.scale, height: NAV.height * fit.scale, bottom: fit.offsetY + NAV.lift * fit.scale };
  return (
    <>
      <StageLayer scene={HANGAR_SCENE_NAME} />
      <section className="hero-select hangar-select" aria-label="Hero Select" data-testid="hero-select">
        <div className="hg-frame" style={{ left: fit.offsetX, top: fit.offsetY, transform: `scale(${fit.scale})` }}>
          {[...HANGAR_HEROES].reverse().map((hero) => {
            const { hit } = PLACE[hero];
            const heroClass = HERO_OF[hero];
            return (
              <button
                key={hero}
                type="button"
                className="hg-hit"
                style={{ left: hit.left, top: hit.top - HANGAR_SHIFT, width: hit.width, height: hit.height, zIndex: hit.z }}
                aria-pressed={all ? all[hero].selected : false}
                aria-label={`${HERO_PROFILES[heroClass].name}, ${HERO_NAMES[heroClass]}`}
                data-testid={`hero-${heroClass}`}
                onClick={() => tap(hero)}
              />
            );
          })}
        </div>
        <button type="button" className="hg-nav hg-back" style={{ ...nav, left: NAV.edge }} aria-label="BACK" onClick={onBack} />
        <button
          type="button"
          className={`hg-nav hg-next${chosen ? " ready" : ""}`}
          style={{ ...nav, right: NAV.edge }}
          aria-label="NEXT"
          disabled={!chosen}
          onClick={() => chosen && onStart(HERO_OF[chosen])}
        />
      </section>
    </>
  );
}
