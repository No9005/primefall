import { HeroClass } from "game-core";
import { useEffect, useReducer, useRef, useState } from "react";
import { gameAudio } from "./audio";
import { type ClipName, HANGAR_HEROES, HangarHeroes, HERO_OF } from "./hangar-select";
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

/** The sounds that belong to a clip of a Hero as it begins (Tilly's act: fiddling, the arm tearing off, her gasp; Max's one shot): the cues `hangarClip` of the manifests. */
function playClipSounds(hero: (typeof HANGAR_HEROES)[number], clip: ClipName): void {
  gameAudio.playMoment("hangarClip", { heroId: `select-${HERO_OF[hero]}`, heroClass: HERO_OF[hero], tile: undefined }, undefined, clip);
}

/** How loud the ambience of the map is in the hangar against the match (1): the music and the Heroes' sounds come first. A first guess, to be tuned by ear. */
const HANGAR_AMBIENCE_LEVEL = 0.5;
/** The sounds of the map ambience that the hangar leaves out: the hum of the plasma core makes no sense there (it is the hum of the Prime Zone of the map), and the sparks come from its own fuse boxes. */
const HANGAR_WITHOUT = ["loop.core", "sfx.spark"];

/**
 * A tap on a Hero. A tap that chooses one first silences what runs (also the clip sounds of the Hero that was chosen before), and only then starts the clip
 * of the tap, whose sounds must not be cut; then the line of the choice and, for Tilly, the hum of her drone.
 */
function tapHero(heroes: HangarHeroes | undefined, hero: (typeof HANGAR_HEROES)[number]): void {
  if (!heroes) return;
  if (!heroes.players[hero].selected) gameAudio.stopAll();
  const now = heroes.tap(hero);
  if (now) gameAudio.playMoment("heroSelected", { heroId: `select-${HERO_OF[now]}`, heroClass: HERO_OF[now], tile: undefined });
  gameAudio.setSelectDrone(now === "tilly"); // Tilly's drone hums while she is the chosen Hero
}

export function HeroSelectScreen({ initial, onBack, onStart }: HeroSelectScreenProps) {
  const [fit, setFit] = useState(windowFit);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const heroes = useRef<HangarHeroes | undefined>(undefined);

  useEffect(() => {
    // The sounds of the three Heroes load while the player looks at them; leaving the screen silences a line that still runs.
    let leaving = false;
    void Promise.all([gameAudio.load(SELECTABLE_HEROES), gameAudio.loadMap().then(() => !leaving && gameAudio.startAmbience(HANGAR_AMBIENCE_LEVEL, HANGAR_WITHOUT))]);
    // The intro of the music plays under the Hero Select, and the ambience of the map (the hangar is part of the hauler) quietly under that.
    void gameAudio.loadMusic().then(() => gameAudio.startIntro());
    return () => {
      leaving = true;
      gameAudio.stopAll();
      gameAudio.stopIntro();
      gameAudio.stopAmbience();
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
    }, prefersReducedMotion(), undefined, playClipSounds);
    heroes.current = made;
    made.start(initial);
    hangarScene.attach(made);
    hangarScene.sounds = (sound) => gameAudio.playHangarSound(sound);
    redraw();
    return () => {
      hangarScene.attach(undefined);
      hangarScene.sounds = undefined;
      made.dispose();
      heroes.current = undefined;
    };
    // The screen opens once with its initial Hero.
  }, []);

  const all = heroes.current?.players;
  const chosen = heroes.current?.selected;

  const tap = (hero: (typeof HANGAR_HEROES)[number]) => tapHero(heroes.current, hero);

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
