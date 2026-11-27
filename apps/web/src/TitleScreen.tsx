import { useEffect, useRef, useState } from "react";
import { gameAudio } from "./audio";
import { HANGAR_SCENE_NAME } from "./hangar-scene";
import { SELECTABLE_HEROES } from "./hero-select";
import { NOTSTROM_INTRO_SCENE_NAME } from "./notstrom-intro-scene";
import { preloadScene, StageLayer } from "./StageLayer";
import { MENU_SLOTS, type MenuId, menuIds, percentY, STAGE, streakTop } from "./title-menu";
import { type FlyLook, TITLE_SCENE_NAME, titleScene } from "./title-scene";
import "./title-screen.css";

const ART = `${import.meta.env.BASE_URL}assets/title/`;

interface TitleScreenProps {
  seed: number;
  canResume: boolean;
  /** Whether Classic plays the Notstrom Intro: the title screen is then pulled away live first (on the stage clock), and `onPlay` follows when that is over. */
  notstromIntro: boolean;
  onPlay: () => void;
  onResume: () => void;
}

/**
 * The start screen: the dark planet with burning crystals that fall onto it, the logo, and the menu. The picture is the scene "title" on
 * the stage (title-scene.ts, drawn at 640 x 296 pixels and scaled to the window's height); the menu rows are buttons over it. The highlight (a red pill and a light streak) stays on Start until the pointer or the
 * focus moves to another row.
 */
export function TitleScreen({ seed, canResume, notstromIntro, onPlay, onResume }: TitleScreenProps) {
  const ids = menuIds(canResume);
  const [row, setRow] = useState(0);
  const [flying, setFlying] = useState(false);
  const screen = useRef<HTMLElement>(null);
  useEffect(() => void (notstromIntro || preloadScene(HANGAR_SCENE_NAME)), [notstromIntro]); // without the Notstrom Intro the Hero Select follows: loaded ahead
  // The main-menu theme plays while the start screen is shown (it starts with the first tap, when the browser allows sound).
  useEffect(() => {
    void gameAudio.loadMusic("menu").then(() => {
      gameAudio.startMenu();
      // The sound of the Notstrom Intro and the Hero Select loop are small; they load behind the menu theme, and the sounds of the Heroes (3 MB in 160 files) and of the map behind them,
      // so that the first clips of the hangar have theirs: it is on show from the end of the Notstrom Intro, when the player looks at the Heroes.
      void gameAudio.loadMusic("intro").then(() => Promise.all([gameAudio.load(SELECTABLE_HEROES), gameAudio.loadMap()]));
    });
    return () => gameAudio.stopMenu();
  }, []);

  // While the scene pulls the picture away, the menu rows and the corner lines follow it: the scene gives their scale and opacity every frame.
  useEffect(() => {
    const apply = (look: FlyLook) => {
      screen.current?.style.setProperty("--fly-scale", String(look.near));
      screen.current?.style.setProperty("--fly-alpha", String(look.paneAlpha));
    };
    titleScene.watchFly(apply);
    return () => titleScene.watchFly(undefined);
  }, []);
  const cancelFly = useRef<() => void>(() => {});
  useEffect(() => () => cancelFly.current(), []);

  function fly() {
    if (flying) return;
    setFlying(true);
    // The menu theme fades out now and the sound of the Notstrom Intro starts: the Notstrom Intro is 9 s long from this tap.
    gameAudio.stopMenu();
    void gameAudio.loadMusic("intro").then(() => gameAudio.startNotstromIntroCue());
    preloadScene(NOTSTROM_INTRO_SCENE_NAME); // the film loads, and plays muted, from the tap on (iOS loads no film before it plays); the fly-away covers the time
    cancelFly.current = titleScene.fly(onPlay);
  }

  const entries: Record<MenuId, { label: string; testId: string; run: () => void }> = {
    classic: { label: "Start", testId: "play-classic", run: notstromIntro ? fly : onPlay },
    resume: { label: "Resume match", testId: "resume", run: onResume },
  };

  return (
    <>
      <StageLayer scene={TITLE_SCENE_NAME} />
      <section ref={screen} className="title-screen" aria-label="Start" data-testid="start-screen" style={flying ? { pointerEvents: "none" } : undefined}>
        {/* The logo and the tagline are pictures in the scene; a screen reader gets them as text. */}
        <h1 className="title-text">PRIMEFALL</h1>
        <p className="title-text">A totally legal salvage operation. Every Prime is a contract.</p>
        <div className="title-stage">
          <div className="title-pane">
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
              onPointerEnter={() => setRow(index)}
              onFocus={() => setRow(index)}
              onClick={entry.run}
            >
              <img className="title-off" src={`${ART}menu-${id}-off.png`} alt="" />
              <img className="title-on" src={`${ART}menu-${id}-on.png`} alt="" />
            </button>
          );
        })}
          </div>
        </div>
      {/* The small lines sit in the corners of the screen, whatever its shape; the stage can be wider than the screen. */}
      <p className="title-corner title-seed" data-testid="start-seed">
        seed {seed}
      </p>
      <img className="title-corner title-legal" src={`${ART}legal.png`} alt="By playing you agree to Form 27B" />
      <img className="title-corner title-version" src={`${ART}version.png`} alt="Version 0.4 (Prime)" />
    </section>
    </>
  );
}
