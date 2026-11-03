import { useEffect, useRef } from "react";
import { burnSchedule } from "./deck-burn";

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
 * The top cards of the Deck pile lift off and burn away, each with a red -1. Place it inside the pile (position:
 * relative). It reports each card and the end, so later animations (shuffle, Exhaustion) can queue behind it.
 */
export function DeckBurn({ cards, visible, reducedMotion, onLifted, onBurned, onDone }: DeckBurnProps) {
  const callbacks = useRef({ onLifted, onBurned, onDone });
  callbacks.current = { onLifted, onBurned, onDone };
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let order = 0; order < cards; order++) {
      const { lift, burned } = burnSchedule(order);
      timers.push(setTimeout(() => callbacks.current.onLifted(), lift));
      timers.push(setTimeout(() => callbacks.current.onBurned(), burned));
    }
    timers.push(setTimeout(() => callbacks.current.onDone(), burnSchedule(cards - 1).burned));
    return () => timers.forEach(clearTimeout);
  }, [cards]);
  if (!visible) return null;
  return (
    <div className="deck-burn" aria-hidden="true" data-testid="deck-burn">
      {Array.from({ length: cards }, (_, order) => {
        const delay = `${burnSchedule(order).lift}ms`;
        return (
          <div key={order} className={`burn-card${reducedMotion ? " calm" : ""}`} style={{ animationDelay: delay }}>
            {!reducedMotion && <span className="burn-flame" style={{ animationDelay: delay }} />}
            {!reducedMotion &&
              [0, 1, 2].map((ember) => (
                <span key={ember} className="burn-ember" style={{ left: `${20 + ember * 30}%`, animationDelay: `${burnSchedule(order).lift + 350 + ember * 120}ms` }} />
              ))}
            <span className="burn-minus" style={{ animationDelay: delay }}>
              -1
            </span>
          </div>
        );
      })}
    </div>
  );
}
