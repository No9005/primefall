import type { CardDefinition } from "game-core";
import type { ReactNode, Ref } from "react";
import { cardFace, type ModeFace } from "./planning-selection";

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
