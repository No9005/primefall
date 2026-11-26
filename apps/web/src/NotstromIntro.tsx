import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";
import { NOTSTROM_INTRO, notstromIntroVideoUrls } from "./notstrom-intro";
import { NOTSTROM_INTRO_SCENE_NAME, notstromIntroScene } from "./notstrom-intro-scene";
import { playableFormat } from "./stage";
import { StageLayer } from "./StageLayer";
import "./notstrom-intro.css";

/** Fetches the film of the Notstrom Intro into the browser's cache, so that it can start at once (the start screen asks for this). */
export function preloadNotstromIntro(): void {
  void fetch(playableFormat(notstromIntroVideoUrls())).catch(() => undefined);
}

interface NotstromIntroProps {
  /** Called once: with true when the Notstrom Intro ran to its end (its flash follows), with false when the player skipped it or it could not play. */
  onDone: (playedToEnd: boolean) => void;
}

/** The Notstrom Intro: the scene "notstrom-intro" plays the film on the stage; this layer over it takes the tap that skips it. */
export function NotstromIntro({ onDone }: NotstromIntroProps) {
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

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
