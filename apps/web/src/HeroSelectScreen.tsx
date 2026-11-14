import { HeroClass } from "game-core";
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { cardListTitle, cardRowName, cardRows, feetX, HERO_CLOSE_UP, HERO_NAMES, HERO_PROFILES, HERO_TASKS, MODE_LABELS, type SelectMode, SELECTABLE_HEROES } from "./hero-select";
import { HERO_STYLE } from "./hero-style";
import { loadPixelHeroes, PixelHero } from "./pixel-heroes";
import "./hero-select.css";

// The Hero Select screen (docs/design/hero-select). The screen is laid out at 844 x 390 and scaled to the window; the
// three Heroes are drawn on a PixiJS canvas, everything else is HTML.

export const SCREEN = { width: 844, height: 390 };
/** The tap area of a Hero (no box is drawn): its size, its top, the left of each, and where the feet stand inside it. */
const AREA = { width: 240, height: 214, top: 56, lefts: [24, 302, 580], feetY: 138 };
/** How much the figure of the board is magnified here. */
const MAGNIFY = 2.5;
/** Screen px per sprite px of a Hero here (a Hero is about 143 px tall). */
const SPRITE_PX = 2.5;

export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** What the player has chosen; `tap` counts the taps, so that tapping the chosen Hero again plays its ready pose again. */
interface Choice {
  hero: HeroClass | undefined;
  tap: number;
}

/** One Hero on the canvas: the sprite-sheet figure, which poses itself, and when it entered its state. */
interface Stand {
  heroClass: HeroClass;
  holder: Container;
  pixel: PixelHero;
  /** The Hidden label of the Assassin, close above its head (the sheet's own label floats too high). */
  hiddenLabel?: Text;
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
  // The sheets carry the muzzle flash, the tracer and the Hidden label themselves, so all three layers are drawn.
  // The holder magnifies by MAGNIFY, so the figure itself has scale 1 and the sprites are SPRITE_PX screen px per pixel.
  const pixel = new PixelHero(heroClass, false, MAGNIFY / HERO_STYLE.figureScale, "right", { layers: ["fx_back", "figure", "fx_front"], figureScale: 1, pixelScale: SPRITE_PX / MAGNIFY });
  holder.addChild(tile(), pixel.container);
  if (heroClass !== HeroClass.Assassin) return { heroClass, holder, pixel, since: performance.now(), state: "idle" };
  pixel.clipFrontAbove(HIDDEN_LABEL.clipRow);
  const hiddenLabel = new Text({ text: "HIDDEN", style: { fill: HIDDEN_LABEL.color, fontSize: 5, fontFamily: "IBM Plex Mono, monospace", fontWeight: "500", letterSpacing: 0.5 }, resolution: Math.max(2, window.devicePixelRatio) * MAGNIFY });
  hiddenLabel.anchor.set(0.5);
  hiddenLabel.alpha = 0;
  pixel.container.addChild(hiddenLabel);
  return { heroClass, holder, pixel, hiddenLabel, since: performance.now(), state: "idle" };
}

/** The Hidden label of the Assassin: the colour of the sheet's, 6 design px above the head, from the moment the Hero has gone Hidden. */
const HIDDEN_LABEL = { color: 0xc29bff, headY: -42, gap: 7, appearsMs: 2400, fadeMs: 300, riseDesignPx: 4, clipRow: 26 };

/** Fades the label in above the head and lets it settle; with reduced motion it simply stands there. */
function showHiddenLabel(label: Text, readyMs: number, reducedMotion: boolean): void {
  const shown = readyMs <= 0 ? 0 : reducedMotion ? 1 : Math.min(1, Math.max(0, (readyMs - HIDDEN_LABEL.appearsMs) / HIDDEN_LABEL.fadeMs));
  label.alpha = shown;
  label.position.set(0, HIDDEN_LABEL.headY - HIDDEN_LABEL.gap - (1 - shown) * -HIDDEN_LABEL.riseDesignPx);
}

/** Poses every Hero for this moment; a Hero that has just changed state starts that state's pose from its beginning. */
function poseStands(stands: readonly Stand[], choice: Choice, now: number, reducedMotion: boolean): void {
  for (const stand of stands) {
    const state = stand.heroClass === choice.hero ? "ready" : "idle";
    stand.state = state;
    stand.pixel.showSelect(state === "ready", now - stand.since, reducedMotion);
    if (stand.hiddenLabel) showHiddenLabel(stand.hiddenLabel, state === "ready" ? now - stand.since : 0, reducedMotion);
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
      await loadPixelHeroes();
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      element.appendChild(app.canvas);
      const built = SELECTABLE_HEROES.map(buildStand);
      stands.current = built;
      for (const stand of built) app.stage.addChild(stand.holder);
      const reducedMotion = prefersReducedMotion();
      poseStands(built, choiceRef.current, performance.now(), reducedMotion);
      // With reduced motion nothing moves, so the one frame posed above is the picture; a later choice poses it again.
      if (!reducedMotion) app.ticker.add(() => poseStands(built, choiceRef.current, performance.now(), false));
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

function BioSheet({ heroClass, onClose }: { heroClass: HeroClass; onClose: () => void }) {
  const { name, quote, bio } = HERO_PROFILES[heroClass];
  return (
    <div className="hs-cards-overlay" data-testid="bio-sheet">
      <section className="hs-bio" aria-label={`${name}, bio`}>
        <button type="button" className="hs-close hs-bio-close" aria-label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 2L14 14M14 2L2 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="hs-bio-portrait">
          <img src={`${import.meta.env.BASE_URL}assets/pixel-heroes/${HERO_CLOSE_UP[heroClass]}/portrait.png`} alt={`Close-up of ${name}`} />
        </div>
        <div className="hs-bio-text">
          <h2>{name.toUpperCase()}</h2>
          <p className="hs-bio-class">{HERO_NAMES[heroClass].toUpperCase()}</p>
          <p className="hs-bio-body">{bio}</p>
          <p className="hs-bio-quote">{`\u201c${quote}\u201d`}</p>
        </div>
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
  const [sheet, setSheet] = useState<"cards" | "bio">();
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
        <div className="hs-drift" aria-hidden="true" />
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
            <span className="hs-name">{HERO_PROFILES[heroClass].name.toUpperCase()}</span>
            <span className="hs-class">{HERO_NAMES[heroClass].toUpperCase()}</span>
          </button>
        ))}
        <div className={`hs-info${hero ? "" : " empty"}`} data-testid="hero-info">
          {hero ? (
            <>
              <p>{HERO_TASKS[hero]}</p>
              <div className="hs-actions">
                <button type="button" className="hs-view-cards" onClick={() => setSheet("cards")}>
                  CARDS
                </button>
                <button type="button" className="hs-view-cards" onClick={() => setSheet("bio")}>
                  BIO
                </button>
              </div>
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
        {sheet === "cards" && hero && <CardList heroClass={hero} onClose={() => setSheet(undefined)} />}
        {sheet === "bio" && hero && <BioSheet heroClass={hero} onClose={() => setSheet(undefined)} />}
      </div>
    </section>
  );
}
