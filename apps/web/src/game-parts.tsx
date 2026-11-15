import { type CardDefinition, type HeroClass } from "game-core";
import { type ReactNode, type Ref, useState } from "react";
import type { Point } from "./card-drag";
import { DesignedCard } from "./card-design";
import { type Face, type FaceView } from "./card-pull";
import { HERO_BASICS } from "./hero-basics";
import { CardUse, cardFace } from "./planning-selection";
import { pullOffset, ReleaseOutcome, releaseOutcome } from "./target-pick";

// The card face and the drop targets of the game, shared by the screens so that a change to one
// changes the other.

/** The width of the card while it is pressed, of the floating card under the finger, and of each face in the row of uses. */
export const PULLED_CARD_WIDTH = 184;
export const FLOATING_CARD_WIDTH = 100;
export const FACE_CARD_WIDTH = 138;

/** The face of a use as a designed card: the card itself for its Primary effect, the Hero's own Pitch and Move card for the others. */
function FaceCard({ card, face, heroClass }: { card: CardDefinition; face: FaceView; heroClass: HeroClass }) {
  const basics = HERO_BASICS[heroClass];
  if (face.face === CardUse.Primary) return <DesignedCard card={card} width={FACE_CARD_WIDTH} />;
  const look = face.face === CardUse.Pitch ? basics.pitch : basics.move;
  const standard = { name: look.name, type: card.type, energyCost: 0, effects: [] };
  return <DesignedCard card={standard} width={FACE_CARD_WIDTH} standard={face.face === CardUse.Pitch ? "Pitch" : "Move"} cost={face.face === CardUse.Pitch ? "+1" : 0} art={look.art} />;
}

/**
 * A card pressed or pulled out of the Hand. Pressed, it is shown big in the middle of the free board area. Pulled or
 * opened, the uses of the card show in a row of designed cards: its own effect (it costs Energy) on the left, then Pitch,
 * then Move. A use is chosen by tap or by dropping the card on it (`data-face` is how the drop finds it); tapping
 * anywhere else puts the card back.
 */
export function PulledCard({
  card,
  heroClass,
  faces,
  floatingAt,
  reveal,
  onFace,
  onOutside,
}: {
  card: CardDefinition;
  heroClass: HeroClass;
  faces: FaceView[] | undefined;
  /** Where the finger is while the card is dragged: the small card floats there. */
  floatingAt: Point | undefined;
  /** How much of the faces shows (0 to 1) while the card is dragged. */
  reveal: number;
  onFace: (face: Face) => void;
  /** The card goes back into the Hand: a tap outside the faces. */
  onOutside: () => void;
}) {
  const floating = floatingAt ? { left: floatingAt.x - FLOATING_CARD_WIDTH / 2, top: floatingAt.y - 70 } : undefined;
  // With the faces open and the finger up, the row is all there is: the card itself is one of its faces.
  const showsCard = faces === undefined || floating !== undefined;
  return (
    <div className="pull" data-testid="pulled-card">
      <div className="pull-backdrop" onClick={onOutside} />
      {showsCard && (
        <div className={`pull-card card${floating ? " floating" : ""}`} aria-label={`${card.name} held`} style={floating}>
          <DesignedCard card={card} width={floating ? FLOATING_CARD_WIDTH : PULLED_CARD_WIDTH} />
        </div>
      )}
      {faces && (
        <div className="pull-faces" role="group" aria-label="Use card as" style={{ opacity: reveal }}>
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
              <FaceCard card={card} face={face} heroClass={heroClass} />
              {face.reason && <span className="face-reason">{face.reason}</span>}
            </button>
          ))}
          <span className="pull-hint">Tap outside to put the card back</span>
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
