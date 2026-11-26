import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";
import { HANGAR_SCENE_NAME } from "./hangar-scene";
import { NOTSTROM_INTRO } from "./notstrom-intro";
import { NOTSTROM_INTRO_SCENE_NAME, notstromIntroScene } from "./notstrom-intro-scene";
import { preloadScene, StageLayer } from "./StageLayer";
import "./notstrom-intro.css";

interface NotstromIntroProps {
  /** Called once: with true when the Notstrom Intro ran to its end (its flash follows), with false when the player skipped it or it could not play. */
  onDone: (playedToEnd: boolean) => void;
}

/** The Notstrom Intro: the scene "notstrom-intro" plays the film on the stage; this layer over it takes the tap that skips it. */
export function NotstromIntro({ onDone }: NotstromIntroProps) {
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  // The Hero Select that follows is loaded while the film plays, so the hangar is there when the film ends.
  useEffect(() => preloadScene(HANGAR_SCENE_NAME), []);

  useEffect(() => {
    notstromIntroScene.watch((playedToEnd) => {
      if (finished.current) return;
      finished.current = true;
      if (!playedToEnd) gameAudio.stopNotstromIntroCue();
      done.current(playedToEnd);
    });
    notstromIntroScene.clock = (filmMs) => gameAudio.followNotstromIntro(filmMs);
    return () => {
      notstromIntroScene.clock = undefined;
      notstromIntroScene.watch(undefined);
    };
  }, []);

  return (
    <>
      <StageLayer scene={NOTSTROM_INTRO_SCENE_NAME} />
      <section className="notstrom-intro" aria-label="The way to the Notstrom" data-testid="notstrom-intro" onPointerDown={() => notstromIntroScene.skip()} />
    </>
  );
}

/** The flash at the end of the Notstrom Intro, which fades out over the screen that follows it. */
export function NotstromIntroFlash({ onGone }: { onGone: () => void }) {
  return <div className="notstrom-intro-flash" data-testid="notstrom-intro-flash" aria-hidden="true" onAnimationEnd={onGone} style={{ background: NOTSTROM_INTRO.flashColor }} />;
}
