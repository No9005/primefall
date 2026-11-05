import type { HeroClass } from "game-core";
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { applyPose, type BoundPart, bindParts } from "./clip-player";
import { heroFigure } from "./hero-figure";
import { cardListTitle, cardRowName, cardRows, HERO_NAMES, HERO_TASKS, MODE_LABELS, type SelectMode, SELECTABLE_HEROES } from "./hero-select";
import { createSelectPose, feetX, sampleSelectPose } from "./hero-select-poses";
import { HERO_STYLE } from "./hero-style";
import "./hero-select.css";

// The Hero Select screen (docs/design/hero-select). The screen is laid out at 844 x 390 and scaled to the window; the
// three Heroes are drawn on a PixiJS canvas, everything else is HTML.

export const SCREEN = { width: 844, height: 390 };
/** The tap area of a Hero (no box is drawn): its size, its top, the left of each, and where the feet stand inside it. */
const AREA = { width: 240, height: 190, top: 64, lefts: [24, 302, 580], feetY: 118 };
/** How much the figure of the board is magnified here. */
const MAGNIFY = 2.5;

export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** What the player has chosen; `tap` counts the taps, so that tapping the chosen Hero again plays its ready pose again. */
interface Choice {
  hero: HeroClass | undefined;
  tap: number;
}

/** One Hero on the canvas: the figure and what is needed to pose it. */
interface Stand {
  heroClass: HeroClass;
  holder: Container;
  parts: BoundPart[];
  muzzle: Graphics;
  tracer: Graphics;
  glint: Graphics;
  label: Text;
  /** When it entered its current state, in page milliseconds. */
  since: number;
  state: "idle" | "ready";
}

/** The square of the diamond under a Hero, 46 x 24 design px. */
function tile(): Graphics {
  return new Graphics().poly([0, -12, 23, 0, 0, 12, -23, 0]).fill(0x243040);
}

function buildStand(heroClass: HeroClass, index: number): Stand {
  const holder = new Container();
  holder.position.set(AREA.lefts[index]! + feetX(heroClass, false), AREA.top + AREA.feetY);
  holder.scale.set(MAGNIFY);
  // The figure is drawn at the scale of the board; here it is MAGNIFY times a design px, so strokes keep their width on screen.
  const figure = heroFigure(heroClass, false, "idle", MAGNIFY / HERO_STYLE.figureScale);
  figure.scale.set(1);
  const muzzle = new Graphics().circle(0, 0, 5).fill(0xff8a3d).circle(0, 0, 3).fill(0xffd24a);
  muzzle.position.set(1, 27);
  muzzle.alpha = 0;
  const gun = figure.getChildByLabel("gun", true);
  if (gun) gun.addChild(muzzle);
  // The tracer of the Bruiser's shots: 38 design px, so that with the feet at x 62 it stays inside the area; it grows from the muzzle.
  const tracer = new Graphics().roundRect(0, 0, 38, 3, 1.5).fill(0x2ec4b6);
  tracer.position.set(34, -26);
  tracer.alpha = 0;
  const glint = new Graphics().circle(0, 0, 4).fill({ color: 0x7fe8ff, alpha: 0.9 }).circle(0, 0, 1.6).fill(0xffffff);
  glint.position.set(21, -32);
  glint.alpha = 0;
  const label = new Text({ text: "Hidden", style: { fill: 0x7fe8ff, fontSize: 8, fontFamily: "IBM Plex Mono, monospace", fontWeight: "500" }, resolution: Math.max(2, window.devicePixelRatio) * MAGNIFY });
  label.anchor.set(0.5);
  label.position.set(0, -44);
  label.alpha = 0;
  figure.addChild(tracer, glint, label);
  holder.addChild(tile(), figure);
  return { heroClass, holder, parts: bindParts(figure), muzzle, tracer, glint, label, since: performance.now(), state: "idle" };
}

/** Poses every Hero for this moment; a Hero that has just changed state starts that state's pose from its beginning. */
function poseStands(stands: readonly Stand[], choice: Choice, now: number, reducedMotion: boolean, scratch = createSelectPose()): void {
  for (const stand of stands) {
    const state = stand.heroClass === choice.hero ? "ready" : "idle";
    stand.state = state;
    const { pose, extras } = sampleSelectPose(stand.heroClass, state, now - stand.since, reducedMotion, scratch, now);
    applyPose(stand.parts, pose);
    stand.muzzle.alpha = extras.muzzle;
    stand.muzzle.scale.set(extras.muzzleScale);
    stand.tracer.alpha = extras.tracer;
    stand.tracer.scale.x = extras.tracerScale;
    stand.glint.alpha = extras.glint;
    stand.glint.scale.set(extras.glintScale);
    stand.label.alpha = extras.label;
    stand.label.position.y = -44 + extras.labelY;
    const index = SELECTABLE_HEROES.indexOf(stand.heroClass);
    stand.holder.position.x = AREA.lefts[index]! + feetX(stand.heroClass, state === "ready");
  }
}

/** The canvas of the three Heroes. It follows `choice` through a ref, so the scene is built once. */
function HeroCanvas({ choice }: { choice: Choice }) {
  const host = useRef<HTMLDivElement>(null);
  const stands = useRef<Stand[]>([]);
  const choiceRef = useRef(choice);

  useEffect(() => {
    // A new tap restarts the pose of the tapped Hero, and sends the one that was chosen before back to its idle pose.
    const now = performance.now();
    const previous = choiceRef.current;
    for (const stand of stands.current) {
      const wasReady = stand.heroClass === previous.hero;
      const isReady = stand.heroClass === choice.hero;
      if (isReady && (!wasReady || previous.tap !== choice.tap)) stand.since = now;
      if (wasReady && !isReady) stand.since = now;
    }
    choiceRef.current = choice;
    poseStands(stands.current, choice, now, prefersReducedMotion());
  }, [choice]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    const app = new Application();
    void (async () => {
      await app.init({ width: SCREEN.width, height: SCREEN.height, backgroundAlpha: 0, preference: "webgl", antialias: true, autoDensity: true, resolution: window.devicePixelRatio });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      element.appendChild(app.canvas);
      const built = SELECTABLE_HEROES.map(buildStand);
      stands.current = built;
      for (const stand of built) app.stage.addChild(stand.holder);
      const reducedMotion = prefersReducedMotion();
      const scratch = createSelectPose();
      poseStands(built, choiceRef.current, performance.now(), reducedMotion, scratch);
      // With reduced motion nothing moves, so the one frame posed above is the picture; a later choice poses it again.
      if (!reducedMotion) app.ticker.add(() => poseStands(built, choiceRef.current, performance.now(), false, scratch));
      element.dataset.ready = "true";
    })();
    return () => {
      cancelled = true;
      stands.current = [];
      delete element.dataset.ready;
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);

  return <div className="hs-canvas" ref={host} data-testid="hero-canvas" />;
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M16 9H3M8 4L3 9l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardList({ heroClass, onClose }: { heroClass: HeroClass; onClose: () => void }) {
  return (
    <div className="hs-cards-overlay" data-testid="card-list">
      <section className="hs-cards" aria-label={`${HERO_NAMES[heroClass]} cards`}>
        <header className="hs-cards-header">
          <h2>{cardListTitle(heroClass)}</h2>
          <button type="button" className="hs-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <ul>
          {cardRows(heroClass).map((row) => (
            <li key={row.name}>
              <span className="hs-card-name">{cardRowName(row)}</span>
              <span className={`hs-card-type ${row.type.toLowerCase()}`}>{row.type}</span>
              <span className="hs-card-cost">{row.cost}</span>
              <span className="hs-card-effect">{row.effect}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The scale that fits the 844 x 390 screen into the window. */
function fitScale(): number {
  return Math.min(window.innerWidth / SCREEN.width, window.innerHeight / SCREEN.height);
}

interface HeroSelectScreenProps {
  mode: SelectMode;
  /** The Hero chosen when the screen opens (none: all three stand idle and Start is disabled). */
  initial?: HeroClass;
  onBack: () => void;
  onStart: (hero: HeroClass) => void;
}

export function HeroSelectScreen({ mode, initial, onBack, onStart }: HeroSelectScreenProps) {
  const [choice, setChoice] = useState<Choice>({ hero: initial, tap: 0 });
  const [cardsOpen, setCardsOpen] = useState(false);
  const [scale, setScale] = useState(fitScale);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { hero } = choice;
  return (
    <section className="hero-select" aria-label="Hero Select" data-testid="hero-select">
      <div className="hs-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="hs-grid" />
        <HeroCanvas choice={choice} />
        <button type="button" className="hs-back" onClick={onBack}>
          <BackArrow />
          <span>BACK</span>
        </button>
        <h1 className="hs-title">CHOOSE YOUR HERO</h1>
        <span className={`hs-chip ${mode}`} data-testid="mode-chip">
          {MODE_LABELS[mode]}
        </span>
        {SELECTABLE_HEROES.map((heroClass, index) => (
          <button
            key={heroClass}
            type="button"
            className={`hs-hero${hero === heroClass ? " selected" : ""}`}
            style={{ left: AREA.lefts[index], top: AREA.top, width: AREA.width, height: AREA.height }}
            aria-pressed={hero === heroClass}
            data-testid={`hero-${heroClass}`}
            onClick={() => setChoice((current) => ({ hero: heroClass, tap: current.tap + 1 }))}
          >
            <span className="hs-name">{HERO_NAMES[heroClass].toUpperCase()}</span>
            {hero === heroClass && <i className="hs-bar" />}
          </button>
        ))}
        <div className={`hs-info${hero ? "" : " empty"}`} data-testid="hero-info">
          {hero ? (
            <>
              <h2>{HERO_NAMES[hero].toUpperCase()}</h2>
              <p>{HERO_TASKS[hero]}</p>
              <button type="button" className="hs-view-cards" onClick={() => setCardsOpen(true)}>
                VIEW CARDS
              </button>
            </>
          ) : (
            <>
              <h2>TAP A HERO</h2>
              <p>Choose the Hero you play. The other two Heroes of your Squad are planned by the AI.</p>
            </>
          )}
        </div>
        <button type="button" className="hs-start" disabled={!hero} onClick={() => hero && onStart(hero)}>
          START
        </button>
        {cardsOpen && hero && <CardList heroClass={hero} onClose={() => setCardsOpen(false)} />}
      </div>
    </section>
  );
}
