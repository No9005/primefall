import { AttackFailReason, EventKind, type MatchEvent } from "game-core";

/** Whose Hero acted: your Hero, an ally or an enemy. It sets the colour of the entry's left border. */
export type CommentarySide = "own" | "ally" | "enemy";

/** One card of the Resolution commentary: what a Hero did in the Tick and what it caused. */
export interface CommentaryEntry {
  side: CommentarySide;
  title: string;
  detail: string;
}

/** At most this many entries are drawn at once. */
export const MAX_COMMENTARY_ENTRIES = 4;

export interface CommentaryNames {
  /** The Hero class name, with "Enemy " in front for an enemy. */
  nameOf: (heroId: string) => string;
  sideOf: (heroId: string) => CommentarySide;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function hitDetail(damage: number, absorbed: number): string {
  if (damage > 0 && absorbed > 0) return `The Shield absorbs ${absorbed}, ${plural(damage, "card")} burn${damage === 1 ? "s" : ""} from the Deck`;
  if (absorbed > 0) return `The Shield absorbs ${absorbed} damage: no card burns`;
  return `Hits for ${damage}: ${plural(damage, "card")} burn${damage === 1 ? "s" : ""} from the Deck`;
}

const MISS_REASONS: Record<AttackFailReason, string> = {
  [AttackFailReason.NotVisible]: "target not visible",
  [AttackFailReason.TargetExhausted]: "target is already Exhausted",
  [AttackFailReason.OutOfRange]: "target is out of Range",
  [AttackFailReason.TooClose]: "target is closer than the Minimum Range",
  [AttackFailReason.NoLineOfSight]: "no Line of Sight to the target",
  [AttackFailReason.FullCover]: "target is behind Full Cover",
  [AttackFailReason.EmptyTile]: "nobody stands on the tile",
};

/** A missed Attack with its reason; an event without one (an old replay) falls back to the general sentence. */
function missDetail({ card, reason }: MatchEvent): string {
  const what = card ?? "The Attack";
  return reason ? `${what} misses: ${MISS_REASONS[reason]}` : `${what} misses: the target is not allowed when it fires`;
}

/**
 * The commentary of one Tick, built from the events the Squad perceives, in the order of the events.
 * The steps of one Move make one entry. Events that only follow from another action (Hidden ends, a shuffle,
 * a used Slow, ignored Cover reduction) get no entry of their own. Allied and enemy Waits are not listed.
 */
export function buildCommentary(events: readonly MatchEvent[], { nameOf, sideOf }: CommentaryNames): CommentaryEntry[] {
  const entries: CommentaryEntry[] = [];
  const moves = new Map<string, CommentaryEntry>();
  const add = (heroId: string, action: string, detail: string, targetId?: string) => {
    const on = targetId === undefined ? "" : ` on ${nameOf(targetId)}`;
    entries.push({ side: sideOf(heroId), title: `${nameOf(heroId)}  ·  ${action}${on}`, detail });
  };

  for (const event of events) {
    const { heroId, targetId } = event;
    switch (event.kind) {
      case EventKind.Step:
        if (!moves.has(heroId)) {
          add(heroId, "Move", "Walks to the marked tile");
          moves.set(heroId, entries[entries.length - 1]!);
        }
        break;
      case EventKind.MoveBlocked: {
        const detail = "Stops: a Hero, a Wall or a conflict is in the way";
        const walked = moves.get(heroId);
        if (walked) walked.detail = detail;
        else add(heroId, "Move", detail);
        break;
      }
      case EventKind.ShieldGained:
        add(heroId, "Block", `Shield ${event.amount ?? 0} until it is hit`);
        break;
      case EventKind.AttackHit:
        add(heroId, "Attack", hitDetail(event.damage ?? 0, event.absorbed ?? 0), targetId);
        break;
      case EventKind.AttackFailed:
        add(heroId, "Attack", missDetail(event), targetId);
        break;
      case EventKind.ActionFailed:
        add(heroId, "Action", "The card cannot be used: nothing happens");
        break;
      case EventKind.SlowApplied:
        add(heroId, "Slow", "Its next Move 2 becomes a Move 1", targetId);
        break;
      case EventKind.MarkedApplied:
        add(heroId, "Mark", "Marked: Hidden and Cover do not protect it", targetId);
        break;
      case EventKind.HiddenGained:
        add(heroId, "Hide", "Hidden from the enemy Squad until it attacks");
        break;
      case EventKind.CoverPlaced:
        add(heroId, "Place Cover", "Half Cover appears on the marked tile");
        break;
      case EventKind.CoverDestroyed:
        add(heroId, "Breach", "The Cover on the marked tile is destroyed");
        break;
      case EventKind.AreaRevealed:
        add(heroId, "Scout Drone", "The marked area is revealed");
        break;
      case EventKind.Knockback:
        add(heroId, "Knockback", "Is pushed back one tile");
        break;
      case EventKind.Pull:
        add(heroId, "Pull", "Is pulled one tile toward the Bruiser");
        break;
      case EventKind.Charged:
        add(heroId, "Charge", "Rushes at the enemy: Shield 1 and +1 damage at Range 1");
        break;
      case EventKind.AttackBonusGained:
        add(heroId, "Adrenal Surge", `Gains +${event.amount ?? 0} Attack for the rest of the match`);
        break;
      case EventKind.Wait:
        if (sideOf(heroId) === "own") add(heroId, "Wait", "Holds position, no Energy used");
        break;
      case EventKind.Exhausted:
        add(heroId, "Exhausted", "Out of cards: Exhausted");
        break;
      default:
        break;
    }
  }
  return entries;
}
