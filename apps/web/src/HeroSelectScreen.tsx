import { HeroClass } from "game-core";
import { useEffect, useReducer, useRef, useState } from "react";
import { gameAudio } from "./audio";
import {
  BRIDGES,
  CLIPS,
  FRAME,
  HANGAR_HEROES,
  type HangarHero,
  HERO_OF,
  HeroPlayer,
  isLooped,
  realEnv,
  tapOrder,
} from "./hangar-select";
import { HERO_NAMES, HERO_PROFILES, type SelectMode, SELECTABLE_HEROES } from "./hero-select";
import "./hero-select.css";
import "./hangar-select.css";

// The Hero Select in the hangar of the Notstrom (docs/design/hero-select, the design canvas "Hangar: Max, Tilly and Kit"). The
// hangar is a picture of 960 x 444 design pixels, drawn in layers (floor, flickering lights, dust, a spark, shade) with the three
// Heroes in front, each a strip of animation clips played by a small state machine (hangar-select.ts). The Side Select still uses the
// 844 x 390 stage of the earlier Hero Select.

export const SCREEN = { width: 844, height: 390 };
/** The hangar's design size, and how far its picture is moved up (the floor continues below the bottom edge). */
const HANGAR = { width: 960, height: 444, shift: 104, pictureHeight: 549 };
const ART = `${import.meta.env.BASE_URL}assets/hangar/`;
const CLIP_ART = `${ART}clips/`;

export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where each Hero stands in the picture and where it is tapped (design pixels inside the moved picture). */
const PLACE: Record<HangarHero, { left: number; top: number; hit: { left: number; top: number; width: number; height: number; z?: number } }> = {
  max: { left: 105, top: 89, hit: { left: 105, top: 150, width: 285, height: 230 } },
  tilly: { left: 332.8, top: 83.8, hit: { left: 400, top: 130, width: 200, height: 250, z: 3 } },
  kit: { left: 572.4, top: 140.4, hit: { left: 690, top: 190, width: 200, height: 230, z: 3 } },
};
/** The name plates on the floor: where each stands and how large, in the plain and the chosen state. */
const NAME_PLATE: Record<HangarHero, { left: number; top: number; width: number; height: number }> = {
  max: { left: 141.75, top: 346.5, width: 210, height: 88.5 },
  tilly: { left: 375, top: 346.5, width: 210, height: 88.5 },
  kit: { left: 677.25, top: 318.75, width: 135, height: 52.5 },
};
const KIT_RING = { left: 639.75, top: 364.5, width: 210, height: 45 };
const BEGIN_DELAYS_MS: Record<HangarHero, number> = { max: 0, tilly: 1400, kit: 700 };
const MOTES: readonly [number, number, number, number][] = [
  [443, 338, 10.8, -10.2], [269, 359, 10.7, -2.7], [287, 300, 6.7, -3.1], [436, 343, 9.3, -5.3], [257, 311, 8.4, -1.5], [546, 300, 10.6, -0.8], [589, 294, 6.8, -6.6], [251, 310, 10.6, -10.2],
  [374, 302, 7.7, -7.4], [404, 304, 11.6, -8.0], [542, 327, 6.1, -2.5], [359, 320, 6.4, -1.9], [250, 384, 10.1, -3.4], [485, 338, 10.9, -5.2], [490, 305, 8.9, -6.3], [291, 319, 11.9, -0.3],
];

/** The picture fitted to the window: as large as it goes inside without being cut (the floor and the dark ceiling fill the rest). */
function fitScale(): number {
  return Math.min(window.innerWidth / HANGAR.width, window.innerHeight / HANGAR.height);
}

/** The style of one Hero's strip: its clip, or the two frames of its bridge. A new mode is a new element (`key`), so the clip starts from its first frame. */
function spriteStyle(hero: HangarHero, player: HeroPlayer, still: boolean): React.CSSProperties {
  const { width, height } = FRAME[hero];
  const place = PLACE[hero];
  const base: React.CSSProperties = { left: place.left, top: place.top, width, height, backgroundRepeat: "no-repeat" };
  const { mode, bridgeEntry, bridgeHalf, bridgeFrom } = player.state;
  if (mode === "bridge") {
    const bridge = BRIDGES[hero][bridgeFrom];
    if (!bridge) return base;
    return { ...base, backgroundImage: `url(${CLIP_ART}${bridge.file})`, backgroundSize: `${bridge.frames * width}px ${height}px`, backgroundPosition: `-${(bridgeEntry * 2 + bridgeHalf) * width}px 0` };
  }
  const clip = CLIPS[hero][mode];
  if (!clip) return base;
  const style: React.CSSProperties = { ...base, backgroundImage: `url(${CLIP_ART}${clip.file})`, backgroundSize: `${clip.frames * width}px ${height}px`, backgroundPosition: "0 0" };
  if (still) return style;
  return { ...style, ["--frames" as string]: clip.frames, ["--frame-width" as string]: `${width}px`, animation: `hg-strip ${clip.seconds}s steps(${clip.frames}, end) ${isLooped(mode) ? "infinite" : "1 forwards"}` };
}

interface HeroSelectScreenProps {
  mode: SelectMode;
  /** The Hero chosen when the screen opens (none: all three idle and NEXT waits). */
  initial?: HeroClass;
  onBack: () => void;
  onStart: (hero: HeroClass) => void;
}

// `mode` is kept in the props: the screen shows it again once the design for it is made.
export function HeroSelectScreen({ initial, onBack, onStart }: HeroSelectScreenProps) {
  const [scale, setScale] = useState(fitScale);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const players = useRef<Record<HangarHero, HeroPlayer> | undefined>(undefined);
  const still = useRef(prefersReducedMotion());

  useEffect(() => {
    // The sounds of the three Heroes load while the player looks at them; leaving the screen silences a line that still runs.
    void gameAudio.load(SELECTABLE_HEROES);
    // The intro of the music plays under the Hero Select.
    void gameAudio.loadMusic().then(() => gameAudio.startIntro());
    return () => {
      gameAudio.stopAll();
      gameAudio.stopIntro();
    };
  }, []);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const made = Object.fromEntries(HANGAR_HEROES.map((hero) => [hero, new HeroPlayer(hero, realEnv, redraw)])) as Record<HangarHero, HeroPlayer>;
    players.current = made;
    for (const hero of HANGAR_HEROES) {
      const chosen = initial !== undefined && HERO_OF[hero] === initial;
      if (still.current) made[hero].setStill(chosen);
      else if (chosen) made[hero].beginSelected();
      else made[hero].begin(BEGIN_DELAYS_MS[hero]);
    }
    redraw();
    return () => {
      for (const hero of HANGAR_HEROES) made[hero].dispose();
      players.current = undefined;
    };
    // The screen opens once with its initial Hero.
  }, []);

  const all = players.current;
  const selectedHeroes = all ? HANGAR_HEROES.filter((hero) => all[hero].selected) : [];
  const chosen = selectedHeroes[0];

  const tap = (hero: HangarHero) => {
    if (!all) return;
    const { release, tap: tapped } = tapOrder(hero, selectedHeroes);
    for (const other of release) {
      if (still.current) all[other].setStill(false);
      else all[other].tap();
    }
    const wasSelected = all[tapped].selected;
    if (still.current) all[tapped].setStill(!wasSelected);
    else all[tapped].tap();
    if (!wasSelected) {
      gameAudio.stopAll();
      gameAudio.playMoment("heroSelected", { heroId: `select-${HERO_OF[tapped]}`, heroClass: HERO_OF[tapped], tile: undefined });
    }
  };

  return (
    <section className="hero-select hangar-select" aria-label="Hero Select" data-testid="hero-select">
      <div className="hg-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="hg-shift">
          <img className="hg-layer hg-floor" src={`${ART}hangar-wide.png`} alt="The hangar of the Notstrom" />
          <div className="hg-door" aria-hidden="true">
            <img className="hg-fire" src={`${ART}fire.png`} alt="" />
          </div>
          {(["a", "b", "c", "d"] as const).map((name) => (
            <img key={name} className={`hg-layer hg-lights hg-lights-${name}`} src={`${ART}lights-${name}.png`} alt="" aria-hidden="true" />
          ))}
          <img className="hg-layer hg-lights hg-lights-flicker" src={`${ART}lights-flicker.png`} alt="" aria-hidden="true" />
          <div className="hg-guide" aria-hidden="true" />
          {MOTES.map(([left, top, seconds, delay]) => (
            <i key={`${left}-${top}`} className="hg-mote" style={{ left, top, animationDuration: `${seconds}s`, animationDelay: `${delay}s` }} aria-hidden="true" />
          ))}
          <div className="hg-spark hg-spark-a" aria-hidden="true" />
          <div className="hg-spark hg-spark-b" aria-hidden="true" />
          <img className="hg-layer hg-shade" src={`${ART}shade-back.png`} alt="" aria-hidden="true" />
          <img className="hg-layer hg-glow" src={`${ART}glow.png`} alt="" aria-hidden="true" />
          {HANGAR_HEROES.map((hero) => {
            const selected = all ? all[hero].selected : false;
            return <img key={`plate-${hero}`} className="hg-plate" style={NAME_PLATE[hero]} src={`${ART}name-${hero}${selected ? "-selected" : ""}.png`} alt="" aria-hidden="true" />;
          })}
          <img className="hg-plate" style={{ ...KIT_RING, opacity: all?.kit.selected ? 1 : 0 }} src={`${ART}kit-ring.png`} alt="" aria-hidden="true" />
          {all &&
            HANGAR_HEROES.map((hero) => (
              <div key={`${hero}-${all[hero].state.mode}-${all[hero].state.bridgeEntry}-${all[hero].state.bridgeHalf}`} className="hg-sprite" style={spriteStyle(hero, all[hero], still.current)} aria-hidden="true" />
            ))}
          {[...HANGAR_HEROES].reverse().map((hero) => {
            const { hit } = PLACE[hero];
            const heroClass = HERO_OF[hero];
            const selected = all ? all[hero].selected : false;
            return (
              <button
                key={hero}
                type="button"
                className="hg-hit"
                style={{ left: hit.left, top: hit.top, width: hit.width, height: hit.height, zIndex: hit.z }}
                aria-pressed={selected}
                aria-label={`${HERO_PROFILES[heroClass].name}, ${HERO_NAMES[heroClass]}`}
                data-testid={`hero-${heroClass}`}
                onClick={() => tap(hero)}
              />
            );
          })}
          <img className="hg-layer hg-shade" src={`${ART}shade-front.png`} alt="" aria-hidden="true" />
        </div>
        <div className="hg-bar">
          <button type="button" className="hg-nav hg-back" aria-label="BACK" onClick={onBack} />
          <button type="button" className={`hg-nav hg-next${chosen ? " ready" : ""}`} aria-label="NEXT" disabled={!chosen} onClick={() => chosen && onStart(HERO_OF[chosen])} />
        </div>
      </div>
    </section>
  );
}
