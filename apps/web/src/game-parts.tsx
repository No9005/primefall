import type { CardDefinition } from "game-core";
import { type ReactNode, type Ref, useState } from "react";
import type { Face, FaceView } from "./card-pull";
import { cardFace, type ModeFace } from "./planning-selection";
import { pullOffset, ReleaseOutcome, releaseOutcome } from "./target-pick";

// The card face and the drop targets of the game, shared by Planning and the Tutorial so that a change to one
// changes the other.

/** The inside of a Hand card: name, cost, type and effect text, and optionally how the card is used right now. */
export function CardFace({ card, use }: { card: CardDefinition; use?: string }) {
  const face = cardFace(card);
  return (
    <>
      <span className="card-name">{card.name}</span>
      <span className="card-cost">{card.energyCost}</span>
      <span className="card-type">{face.type}</span>
      <span className="card-text">{face.effectText}</span>
      {use && <span className="card-use">{use}</span>}
    </>
  );
}

/**
 * A card pressed or pulled out of the Hand: shown large in the middle of the free board area, with the faces of its
 * uses above it once they are shown. A face is chosen by tap or by dropping the card on it (`data-face` is how the
 * drop finds it); tapping anywhere else puts the card back.
 */
export function PulledCard({ card, faces, onFace, onOutside }: { card: CardDefinition; faces: FaceView[] | undefined; onFace: (face: Face) => void; onOutside: () => void }) {
  return (
    <div className="pull" data-testid="pulled-card">
      <div className="pull-backdrop" onClick={onOutside} />
      <div className={`pull-card card${faces ? " parked" : ""}`} aria-label={`${card.name} held`}>
        <CardFace card={card} />
      </div>
      {faces && (
        <div className="pull-faces" role="group" aria-label="Use card as">
          {faces.map((face) => (
            <button
              key={face.face}
              type="button"
              data-face={face.face}
              className={`pull-face${face.face === "overdrive" ? " overdrive" : ""}`}
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

/** One of the two faces of a card with an Overdrive mode. Without `onPick` it is only shown, not pressable. */
export function ModeFaceCard({ card, face, onPick, chosen }: { card: CardDefinition; face: ModeFace; onPick?: (face: ModeFace) => void; chosen?: boolean }) {
  return (
    <button
      type="button"
      className={`card mode-face ${card.type}${face.overdrive ? " overdrive" : ""}${chosen ? " chosen" : ""}`}
      disabled={face.reason !== undefined}
      tabIndex={onPick ? undefined : -1}
      aria-label={`${card.name} ${face.overdrive ? "Overdrive" : "Normal"}`}
      onClick={() => onPick?.(face)}
    >
      <span className="card-name">{card.name}</span>
      <span className="card-cost">{face.energyCost}</span>
      <span className="card-type">{face.overdrive ? "OVERDRIVE" : "NORMAL"}</span>
      <span className="card-text">{face.effectText}</span>
      {face.exiled && <span className="mode-note">Exiled: leaves the game after use</span>}
      {face.reason && <span className="use-reason">{face.reason}</span>}
    </button>
  );
}

/** The Block 2 chip shown while a card is dragged: lit when Block is allowed, active under the dragged card. */
export function BlockChip({ allowed, active, chipRef }: { allowed: boolean; active: boolean; chipRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={chipRef} className={`drop-chip${allowed ? " lit" : " off"}${active ? " active" : ""}`}>
      BLOCK 2
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
