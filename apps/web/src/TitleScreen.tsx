import { useEffect, useState } from "react";
import { gameAudio } from "./audio";
import { WHIP_MS } from "./intro-film";
import { preloadIntro } from "./NotstromIntro";
import { BURST_OFFSET, FIREBALLS, MENU_SLOTS, type MenuId, menuIds, percentX, percentY, STAGE, streakTop } from "./title-menu";
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

/**
 * The start screen: the dark planet with burning crystals that fall onto it, the logo, and the menu. The picture is drawn at
 * 640 x 296 pixels and scaled to the screen; the highlight (a red pill and a light streak) stays on Start until the pointer or the
 * focus moves to another row.
 */
export function TitleScreen({ seed, canResume, film, onPlay, onPlayAttackAndDefend, onResume, onGlossary }: TitleScreenProps) {
  const ids = menuIds(canResume, new URLSearchParams(window.location.search).get("menu") === "all");
  const [row, setRow] = useState(0);
  const [flying, setFlying] = useState(false);
  // The film of Classic is fetched while the start screen is shown.
  useEffect(preloadIntro, []);
  // The main-menu theme plays while the start screen is shown (it starts with the first tap, when the browser allows sound).
  useEffect(() => {
    void gameAudio.loadMusic().then(() => gameAudio.startMenu());
    return () => gameAudio.stopMenu();
  }, []);

  function fly() {
    if (flying) return;
    setFlying(true);
    // The menu theme fades out now and the sound of the film starts: the film is 9 s long from this tap.
    gameAudio.stopMenu();
    void gameAudio.loadMusic().then(() => gameAudio.startFilmCue());
    window.setTimeout(onPlay, WHIP_MS);
  }

  const entries: Record<MenuId, { label: string; testId: string; run: () => void }> = {
    classic: { label: "Start", testId: "play-classic", run: film ? fly : onPlay },
    "attack-and-defend": { label: "Attack and Defend", testId: "play-attack-defend", run: onPlayAttackAndDefend },
    glossary: { label: "Glossary", testId: "glossary-button", run: onGlossary },
    resume: { label: "Resume match", testId: "resume", run: onResume },
  };
  const pick = (index: number) => {
    setRow(index);
  };

  return (
    <section className={flying ? "title-screen flying" : "title-screen"} aria-label="Start" data-testid="start-screen">
      <div className="title-stage">
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
        </div>
        <img className="title-whip" src={`${ART}hyperspace.png`} alt="" aria-hidden="true" />
      </div>
      {/* The small lines sit in the corners of the screen, whatever its shape; the stage can be wider than the screen. */}
      <p className="title-corner title-seed" data-testid="start-seed">
        seed {seed}
      </p>
      <img className="title-corner title-legal" src={`${ART}legal.png`} alt="By playing you agree to Form 27B" />
      <img className="title-corner title-version" src={`${ART}version.png`} alt="Version 0.4 (Prime)" />
    </section>
  );
}
