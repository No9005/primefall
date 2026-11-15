import type { CardDefinition } from "game-core";
import { type ReactNode, type Ref, useState } from "react";
import type { Point } from "./card-drag";
import { DesignedCard } from "./card-design";
import { type Face, type FaceView, REVEAL_SPAN } from "./card-pull";
import { cardFace } from "./planning-selection";
import { pullOffset, ReleaseOutcome, releaseOutcome } from "./target-pick";

// The card face and the drop targets of the game, shared by the screens so that a change to one
// changes the other.

/** The width of the pulled card (it must fit the free board area at 844 x 390) and of the card parked below the faces. */
export const PULLED_CARD_WIDTH = 184;
export const PARKED_CARD_WIDTH = 100;

/**
 * A card pressed or pulled out of the Hand: shown large in the middle of the free board area, with the faces of its
 * uses above it once they are shown. A face is chosen by tap or by dropping the card on it (`data-face` is how the
 * drop finds it); tapping anywhere else puts the card back.
 */
export function PulledCard({
  card,
  faces,
  floatingAt,
  reveal,
  onFace,
  onOutside,
}: {
  card: CardDefinition;
  faces: FaceView[] | undefined;
  /** Where the finger is while the card is dragged: the small card floats there. */
  floatingAt: Point | undefined;
  /** How much of the faces shows (0 to 1) while the card is dragged. */
  reveal: number;
  onFace: (face: Face) => void;
  /** The card goes back into the Hand: a tap outside the faces, a tap on the parked card, or a pull down. */
  onOutside: () => void;
}) {
  const [drag, setDrag] = useState<{ startY: number; offset: number } | undefined>(undefined);
  // Pulling the parked card down fades the faces out like the pull up faded them in.
  const faceOpacity = drag ? 1 - Math.min(1, drag.offset / REVEAL_SPAN) : reveal;
  const floating = floatingAt ? { left: floatingAt.x - 50, top: floatingAt.y - 70, transform: "none" } : undefined;
  return (
    <div className="pull" data-testid="pulled-card">
      <div className="pull-backdrop" onClick={onOutside} />
      <div
        className={`pull-card card${faces ? " parked" : ""}${floating ? " floating" : ""}`}
        aria-label={`${card.name} held`}
        style={floating ?? (drag ? { transform: `translateY(${drag.offset}px)`, transition: "none" } : undefined)}
        onPointerDown={(event) => {
          if (floating) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ startY: event.clientY, offset: 0 });
        }}
        onPointerMove={(event) => drag && setDrag({ ...drag, offset: pullOffset(drag.startY, event.clientY) })}
        onPointerUp={() => {
          if (drag && releaseOutcome(drag.offset) === ReleaseOutcome.Cancel) onOutside();
          else setDrag(undefined);
        }}
        onPointerCancel={() => setDrag(undefined)}
      >
        <DesignedCard card={card} width={faces ? PARKED_CARD_WIDTH : PULLED_CARD_WIDTH} />
      </div>
      {faces && (
        <div className="pull-faces" role="group" aria-label="Use card as" style={{ opacity: faceOpacity }}>
          {faces.map((face) => (
            <button
              key={face.face}
              type="button"
              data-face={face.face}
              className="pull-face"
              aria-disabled={face.reason !== undefined}
              aria-label={face.title}
              onClick={() => face.reason === undefined && onFace(face.face)}
            >
              <span className="face-title">
                {face.title}
                {face.cost !== undefined && <span className="face-cost">{face.cost}</span>}
              </span>
              <span className="face-effect">{face.effect}</span>
              {face.reason && <span className="face-reason">{face.reason}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The used card while its target is picked (issue 208): it floats at the lower middle of the board with the instruction.
 * Pulling it down by more than CANCEL_PULL, or tapping it, cancels the use; a shorter pull springs it back.
 */
export function FloatingCard({ card, instruction, onCancel }: { card: CardDefinition; instruction: string; onCancel: () => void }) {
  const [drag, setDrag] = useState<{ startY: number; offset: number } | undefined>(undefined);
  const face = cardFace(card);
  return (
    <div
      className="floating-card"
      data-testid="floating-card"
      role="button"
      tabIndex={0}
      aria-label={`${card.name}: ${instruction}. Pull down or tap to cancel`}
      style={{ transform: `translateX(-50%) translateY(${drag?.offset ?? 0}px)`, transition: drag ? "none" : undefined }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ startY: event.clientY, offset: 0 });
      }}
      onPointerMove={(event) => drag && setDrag({ ...drag, offset: pullOffset(drag.startY, event.clientY) })}
      onPointerUp={() => {
        if (drag && releaseOutcome(drag.offset) === ReleaseOutcome.Cancel) onCancel();
        else setDrag(undefined);
      }}
      onPointerCancel={() => setDrag(undefined)}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " " || event.key === "Escape") && onCancel()}
    >
      <span className="floating-name">{card.name}</span>
      <span className="floating-type">{face.type}</span>
      <span className="floating-instruction">{instruction}</span>
      <span className="floating-cancel">pull down to cancel</span>
    </div>
  );
}

const ENERGY_CAPACITY = 5;

/** The Energy pill above the Hand, the drop target for Pitch; `lit` while a card is dragged, `active` under the dragged card. */
export function EnergyPill({
  available,
  lit,
  active,
  pillRef,
  title,
  opacity,
}: {
  available: number;
  lit: boolean;
  active: boolean;
  pillRef?: Ref<HTMLDivElement>;
  title?: string;
  opacity?: number;
}): ReactNode {
  return (
    <div
      ref={pillRef}
      className={`energy${lit ? " drop-lit" : ""}${active ? " active" : ""}`}
      style={opacity === undefined ? undefined : { opacity }}
      data-testid="energy"
      aria-label={`Energy: ${available} available`}
      title={title}
    >
      <span className="energy-label">ENERGY</span>
      <span className="energy-dots" aria-hidden="true">
        {Array.from({ length: ENERGY_CAPACITY }, (_, i) => (
          <span key={i} className={`energy-dot${i < available ? " full" : ""}`} />
        ))}
      </span>
      <span className="energy-count">{available}</span>
    </div>
  );
}
