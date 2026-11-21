import { useEffect, useState } from "react";
import { WHIP_MS } from "./intro-film";
import { preloadIntro } from "./NotstromIntro";
import { AUTO_STEP_MS, BURST_OFFSET, FIREBALLS, MENU_SLOTS, type MenuId, menuIds, nextRow, percentX, percentY, STAGE, streakTop } from "./title-menu";
import "./title-screen.css";

const ART = `${import.meta.env.BASE_URL}assets/title/`;

interface TitleScreenProps {
  seed: number;
  canResume: boolean;
  /** Whether Classic plays the film: the title screen is then pulled away live first, and `onPlay` follows when that is over. */
  film: boolean;
  onPlay: () => void;
  onPlayAttackAndDefend: () => void;
  onResume: () => void;
  onGlossary: () => void;
}

const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The start screen: the dark planet with burning crystals that fall onto it, the logo, and the menu. The picture is drawn at
 * 640 x 296 pixels and scaled to the screen; the highlight (a red pill and a light streak) runs through the rows by itself until
 * the player touches one.
 */
export function TitleScreen({ seed, canResume, film, onPlay, onPlayAttackAndDefend, onResume, onGlossary }: TitleScreenProps) {
  const ids = menuIds(canResume);
  const [row, setRow] = useState(0);
  const [touched, setTouched] = useState(false);
  const [flying, setFlying] = useState(false);
  // The film of Classic is fetched while the start screen is shown.
  useEffect(preloadIntro, []);

  useEffect(() => {
    if (touched || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setRow((current) => nextRow(current, ids.length)), AUTO_STEP_MS);
    return () => window.clearInterval(timer);
  }, [touched, ids.length]);

  function fly() {
    if (flying) return;
    setFlying(true);
    window.setTimeout(onPlay, WHIP_MS);
  }

  const entries: Record<MenuId, { label: string; testId: string; run: () => void }> = {
    classic: { label: "Classic", testId: "play-classic", run: film ? fly : onPlay },
    "attack-and-defend": { label: "Attack and Defend", testId: "play-attack-defend", run: onPlayAttackAndDefend },
    glossary: { label: "Glossary", testId: "glossary-button", run: onGlossary },
    resume: { label: "Resume match", testId: "resume", run: onResume },
  };
  const pick = (index: number) => {
    setTouched(true);
    setRow(index);
  };

  return (
    <section className="title-screen" aria-label="Start" data-testid="start-screen">
      <div className={flying ? "title-stage flying" : "title-stage"}>
        <div className="title-tunnel" aria-hidden="true">
          <img className="title-streaks a" src={`${ART}hyperspace.png`} alt="" />
          <img className="title-streaks b" src={`${ART}hyperspace.png`} alt="" />
        </div>
        <div className="title-pane">
        <img className="title-layer title-back" src={`${ART}background.png`} alt="" />
        <img className="title-layer title-twinkle" src={`${ART}stars.png`} alt="" />
        {FIREBALLS.map((ball) => (
          <span key={ball.left} aria-hidden="true">
            <img
              className="title-fireball"
              style={{ left: percentX(ball.left), top: percentY(ball.top), animationDuration: `${ball.period}s`, animationDelay: `${ball.delay}s` }}
              src={`${ART}fireball.png`}
              alt=""
            />
            <img
              className="title-burst"
              style={{
                left: percentX(ball.left + BURST_OFFSET.left),
                top: percentY(ball.top + BURST_OFFSET.top),
                animationDuration: `${ball.period}s`,
                animationDelay: `${ball.delay}s`,
              }}
              src={`${ART}impact.png`}
              alt=""
            />
          </span>
        ))}
        <img className="title-layer title-haze" src={`${ART}haze.png`} alt="" />
        <h1 className="title-heading">
          <img className="title-layer title-logo" src={`${ART}logo.png`} alt="PRIMEFALL" />
        </h1>
        <img className="title-layer title-tagline" src={`${ART}tagline.png`} alt="A totally legal salvage operation. Every Prime is a contract." />
        <div className="title-streak" style={{ top: percentY(streakTop(MENU_SLOTS[row] ?? MENU_SLOTS[0])) }} aria-hidden="true" />
        {ids.map((id, index) => {
          const slot = MENU_SLOTS[index];
          const entry = entries[id];
          if (!slot) return null;
          return (
            <button
              key={id}
              type="button"
              className={index === row ? "title-item sel" : "title-item"}
              style={{ top: percentY(slot.top), height: `${(slot.height / STAGE.height) * 100}%`, ["--art" as string]: `${(slot.art / slot.height) * 100}%` }}
              data-testid={entry.testId}
              aria-label={entry.label}
              onPointerEnter={() => pick(index)}
              onFocus={() => pick(index)}
              onClick={entry.run}
            >
              <img className="title-off" src={`${ART}menu-${id}-off.png`} alt="" />
              <img className="title-on" src={`${ART}menu-${id}-on.png`} alt="" />
            </button>
          );
        })}
        <p className="title-seed" data-testid="start-seed">
          seed {seed}
        </p>
        </div>
        <img className="title-whip" src={`${ART}hyperspace.png`} alt="" aria-hidden="true" />
      </div>
    </section>
  );
}
