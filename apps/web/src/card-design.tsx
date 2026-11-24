import type { CardDefinition } from "game-core";
import { CardType } from "game-core";
import type { CSSProperties } from "react";
import { cardArtUrl } from "./card-art";
import { cardTextOf, type TextRun } from "./card-text";

// A card as designed (docs/design/cards/README.md): 300 x 420 px with the cost orb at the top left, the name ribbon, the
// picture window with the type tag, and the text box with the flavour line. It is drawn at design size and scaled to
// `width`, so the Hand, the pulled card and the parked card are one drawing.

export const CARD_DESIGN_WIDTH = 300;
export const CARD_DESIGN_HEIGHT = 420;

/** Height of a card `width` wide. */
export const cardHeightFor = (width: number): number => (width * CARD_DESIGN_HEIGHT) / CARD_DESIGN_WIDTH;

interface DesignedCardProps {
  card: Pick<CardDefinition, "name" | "type" | "energyCost" | "effects">;
  /** The width in CSS px the card is shown at. */
  width: number;
  /** A standard use (Move, Pitch, Wait): shown in steel grey with this label as its type. */
  standard?: string;
  /** The number in the cost orb of a standard card (0 for Move and Wait, +1 for Pitch). */
  cost?: string | number;
  /** The picture file of a standard card, which is not in the Deck list. */
  art?: string;
}

function Runs({ runs }: { runs: readonly TextRun[] }) {
  return (
    <>
      {runs.map((run, i) => (typeof run === "string" ? <span key={i}>{run}</span> : <b key={i} className={`cd-${run.keyword}`}>{run.text}</b>))}
    </>
  );
}

function cardKind(standard: string | undefined, type: CardType): "action" | "attack" | "utility" {
  if (standard) return "action";
  return type === CardType.Attack ? "attack" : "utility";
}

/** The designed card. Decorative: the button or the pulled card around it carries the name for assistive technology. */
export function DesignedCard({ card, width, standard, cost, art }: DesignedCardProps) {
  const kind = cardKind(standard, card.type);
  const picture = art ?? cardArtUrl(card.name);
  const { runs, flavor } = cardTextOf(card);
  return (
    <span className="cd-box" aria-hidden="true" style={{ width, height: cardHeightFor(width) }}>
      <span className={`cd cd-${kind}`} style={{ "--cd-scale": width / CARD_DESIGN_WIDTH } as CSSProperties}>
        <span className="cd-cost">{standard ? (cost ?? 0) : card.energyCost}</span>
        <span className="cd-title"><span>{card.name}</span></span>
        <span className="cd-art">
          {picture ? <img src={picture} alt="" draggable={false} /> : <span className="cd-rays" />}
          <span className="cd-type">{standard ?? (kind === "attack" ? "Attack" : "Utility")}</span>
        </span>
        <span className="cd-body">
          <span className="cd-text"><Runs runs={runs} /></span>
          {flavor && <span className="cd-flavor">{flavor}</span>}
        </span>
      </span>
    </span>
  );
}
