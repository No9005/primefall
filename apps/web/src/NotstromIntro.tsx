import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";
import { NOTSTROM_INTRO, NOTSTROM_INTRO_DURATION_MS, notstromIntroSheetUrl, frameAt, locateFrame } from "./notstrom-intro";
import "./notstrom-intro.css";

/** Loads the sprite sheets of the Notstrom Intro into the browser's cache, so that it can start at once (the start screen asks for this). */
export function preloadNotstromIntro(): void {
  for (let sheet = 0; sheet < NOTSTROM_INTRO.sheets.length; sheet++) new Image().src = notstromIntroSheetUrl(sheet);
}

interface NotstromIntroProps {
  /** Called once: with true when the Notstrom Intro ran to its end (its flash follows), with false when the player skipped it. */
  onDone: (playedToEnd: boolean) => void;
}

function loadSheet(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

/** The Notstrom Intro, drawn picture by picture from its sprite sheets onto a canvas of 640 x 296 pixels; a tap skips it. */
export function NotstromIntro({ onDone }: NotstromIntroProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  const finish = (playedToEnd: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (!playedToEnd) gameAudio.stopNotstromIntroCue();
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
    Promise.all(NOTSTROM_INTRO.sheets.map((_, sheet) => loadSheet(notstromIntroSheetUrl(sheet)))).then(
      (sheets) => {
        if (cancelled) return;
        const start = performance.now();
        let drawn = -1;
        const tick = (now: number) => {
          const elapsed = now - start;
          const index = frameAt(elapsed);
          if (index !== drawn) {
            const { sheet, column, row } = locateFrame(index);
            context.drawImage(sheets[sheet]!, column * NOTSTROM_INTRO.width, row * NOTSTROM_INTRO.height, NOTSTROM_INTRO.width, NOTSTROM_INTRO.height, 0, 0, NOTSTROM_INTRO.width, NOTSTROM_INTRO.height);
            drawn = index;
          }
          if (elapsed >= NOTSTROM_INTRO_DURATION_MS) finish(true);
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
    // The Notstrom Intro starts once; `finish` only reads refs.
  }, []);

  return (
    <section className="notstrom-intro" aria-label="The way to the Notstrom" data-testid="notstrom-intro" onPointerDown={() => finish(false)}>
      <canvas ref={canvas} className="notstrom-intro-stage" width={NOTSTROM_INTRO.width} height={NOTSTROM_INTRO.height} />
    </section>
  );
}

/** The flash at the end of the Notstrom Intro, which fades out over the screen that follows it. */
export function NotstromIntroFlash({ onGone }: { onGone: () => void }) {
  return <div className="notstrom-intro-flash" data-testid="notstrom-intro-flash" aria-hidden="true" onAnimationEnd={onGone} style={{ background: NOTSTROM_INTRO.flashColor }} />;
}
