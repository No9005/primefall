import { useEffect, useRef } from "react";
import { gameAudio } from "./audio";
import { BURN_MS, burnSchedule, burnSoundMs } from "./deck-burn";
import { GLIMMER, glimmerFrame, glimmerOf, type Glimmer, type Raster } from "./burn-glimmer";

/** The pile of the Deck (`.deck-pile`, 60 x 84 px with a 2 px border): the burning card has its size. */
const CARD = { width: 60, height: 84, border: 2 };
const CARD_BACK = `${import.meta.env.BASE_URL}assets/cards/back.png`;
const TEAL = "#2ec4b6";

interface Burnable {
  card: Raster;
  glimmer: Glimmer;
}

let burnable: Promise<Burnable | undefined> | undefined;

/** The top card of the Deck as pixels (the back of a card in a teal border, as the pile shows it), loaded once. */
function loadBurnable(): Promise<Burnable | undefined> {
  burnable ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = [CARD.width, CARD.height];
      const context = canvas.getContext("2d");
      if (!context) return resolve(undefined);
      context.fillStyle = TEAL;
      context.fillRect(0, 0, CARD.width, CARD.height);
      const inner = { width: CARD.width - 2 * CARD.border, height: CARD.height - 2 * CARD.border };
      context.imageSmoothingQuality = "high";
      context.drawImage(image, CARD.border, CARD.border, inner.width, inner.height);
      const { data } = context.getImageData(0, 0, CARD.width, CARD.height);
      resolve({ card: { width: CARD.width, height: CARD.height, data }, glimmer: glimmerOf(CARD.width, CARD.height) });
    };
    image.onerror = () => resolve(undefined);
    image.src = CARD_BACK;
  });
  return burnable;
}

interface DeckBurnProps {
  /** How many cards burn now. */
  cards: number;
  /** Show the cards; the schedule runs and reports either way. */
  visible: boolean;
  reducedMotion: boolean;
  onLifted: () => void;
  onBurned: () => void;
  /** Every card has burned: the next batch may start. */
  onDone: () => void;
}

/**
 * The top cards of the Deck pile lift off and glimmer away (`burn-glimmer.ts`), each with a red -1. Place it inside the
 * pile (position: relative). It reports each card and the end, so later animations (shuffle, Exhaustion) can queue
 * behind it. The burn sounds once for the whole hit, however many cards burn.
 */
export function DeckBurn({ cards, visible, reducedMotion, onLifted, onBurned, onDone }: DeckBurnProps) {
  const callbacks = useRef({ onLifted, onBurned, onDone });
  callbacks.current = { onLifted, onBurned, onDone };
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let order = 0; order < cards; order++) {
      const { lift, burned } = burnSchedule(order);
      timers.push(setTimeout(() => callbacks.current.onLifted(), lift));
      timers.push(setTimeout(() => callbacks.current.onBurned(), burned));
    }
    timers.push(setTimeout(() => callbacks.current.onDone(), burnSchedule(cards - 1).burned));
    if (visible && !reducedMotion) timers.push(setTimeout(() => gameAudio.playUi("cardBurn"), burnSoundMs()));
    return () => timers.forEach(clearTimeout);
  }, [cards]);

  useEffect(() => {
    if (!visible || reducedMotion) return;
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    void loadBurnable().then((loaded) => {
      if (!loaded || stopped) return;
      const step = (now: number) => {
        for (let order = 0; order < cards; order++) {
          const context = canvases.current[order]?.getContext("2d");
          if (!context) continue;
          const t = (now - started - burnSchedule(order).lift) / BURN_MS;
          context.clearRect(0, 0, CARD.width, CARD.height + GLIMMER.headroom);
          if (t < 0 || t > 1) continue;
          const picture = glimmerFrame(loaded.card, loaded.glimmer, t);
          context.putImageData(new ImageData(picture.data as Uint8ClampedArray<ArrayBuffer>, picture.width, picture.height), 0, 0);
        }
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [cards, visible, reducedMotion]);

  if (!visible) return null;
  return (
    <div className="deck-burn" aria-hidden="true" data-testid="deck-burn">
      {Array.from({ length: cards }, (_, order) => {
        const delay = `${burnSchedule(order).lift}ms`;
        return (
          <div key={order} className={reducedMotion ? "burn-card calm" : "burn-card"} style={{ animationDelay: delay, zIndex: cards - order }}>
            {!reducedMotion && <canvas ref={(element) => void (canvases.current[order] = element)} className="burn-glimmer" width={CARD.width} height={CARD.height + GLIMMER.headroom} />}
            <span className="burn-minus" style={{ animationDelay: delay }}>
              -1
            </span>
          </div>
        );
      })}
    </div>
  );
}
