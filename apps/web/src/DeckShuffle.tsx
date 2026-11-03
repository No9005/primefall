import { useEffect, useRef } from "react";
import { riffleSide, SHUFFLE_CALM_MS, SHUFFLE_MS, shuffleStackSize } from "./deck-shuffle";

interface DeckShuffleProps {
  /** The real number of cards shuffled; at most 6 card backs are drawn. */
  cards: number;
  /** Show the stack; the timing runs and reports either way. */
  visible: boolean;
  reducedMotion: boolean;
  /** The shuffle starts now: the Discard shows 0. */
  onStart: () => void;
  /** The shuffle has ended: the Deck shows its new total. */
  onDone: () => void;
}

/**
 * The cards of the Discard fly over to the Deck pile and are riffled into it twice. Place it inside the Deck pile
 * (position: relative). With reduced motion only the pile is highlighted for a moment.
 */
export function DeckShuffle({ cards, visible, reducedMotion, onStart, onDone }: DeckShuffleProps) {
  const callbacks = useRef({ onStart, onDone });
  callbacks.current = { onStart, onDone };
  useEffect(() => {
    callbacks.current.onStart();
    const timer = setTimeout(() => callbacks.current.onDone(), reducedMotion ? SHUFFLE_CALM_MS : SHUFFLE_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion]);
  if (!visible) return null;
  if (reducedMotion) return <div className="shuffle-flash" aria-hidden="true" data-testid="deck-shuffle" />;
  return (
    <div className="deck-shuffle" aria-hidden="true" data-testid="deck-shuffle">
      {Array.from({ length: shuffleStackSize(cards) }, (_, index) => (
        <span
          key={index}
          className="shuffle-card"
          style={{ animationDuration: `${SHUFFLE_MS}ms`, zIndex: index, ["--side" as string]: riffleSide(index), ["--lift" as string]: `${-index * 1.5}px` }}
        />
      ))}
    </div>
  );
}
