import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";
import { FILM, FILM_DURATION_MS, filmSheetUrl, frameAt, locateFrame } from "./intro-film";
import "./intro.css";

/** Loads the sprite sheets of the film into the browser's cache, so that it can start at once (the start screen asks for this). */
export function preloadIntro(): void {
  for (let sheet = 0; sheet < FILM.sheets.length; sheet++) new Image().src = filmSheetUrl(sheet);
}

interface NotstromIntroProps {
  /** Called once: with true when the film ran to its end (its flash follows), with false when the player skipped it. */
  onDone: (playedToEnd: boolean) => void;
}

function loadSheet(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

/** The film, drawn picture by picture from its sprite sheets onto a canvas of 640 x 296 pixels; a tap skips it. */
export function NotstromIntro({ onDone }: NotstromIntroProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  const finish = (playedToEnd: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (!playedToEnd) gameAudio.stopFilmCue();
    done.current(playedToEnd);
  };

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) {
      finish(false);
      return;
    }
    context.imageSmoothingEnabled = false;
    let cancelled = false;
    let handle = 0;
    Promise.all(FILM.sheets.map((_, sheet) => loadSheet(filmSheetUrl(sheet)))).then(
      (sheets) => {
        if (cancelled) return;
        const start = performance.now();
        let drawn = -1;
        const tick = (now: number) => {
          const elapsed = now - start;
          const index = frameAt(elapsed);
          if (index !== drawn) {
            const { sheet, column, row } = locateFrame(index);
            context.drawImage(sheets[sheet]!, column * FILM.width, row * FILM.height, FILM.width, FILM.height, 0, 0, FILM.width, FILM.height);
            drawn = index;
          }
          if (elapsed >= FILM_DURATION_MS) finish(true);
          else handle = requestAnimationFrame(tick);
        };
        handle = requestAnimationFrame(tick);
      },
      () => finish(false),
    );
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
    // The film starts once; `finish` only reads refs.
  }, []);

  return (
    <section className="intro" aria-label="The way to the Notstrom" data-testid="intro" onPointerDown={() => finish(false)}>
      <canvas ref={canvas} className="intro-stage" width={FILM.width} height={FILM.height} />
    </section>
  );
}

/** The flash at the end of the film, which fades out over the screen that follows it. */
export function IntroFlash({ onGone }: { onGone: () => void }) {
  return <div className="intro-flash" data-testid="intro-flash" aria-hidden="true" onAnimationEnd={onGone} style={{ background: FILM.flashColor }} />;
}
