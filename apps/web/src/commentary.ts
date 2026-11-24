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
};

/** A missed Attack with its reason; an event without one (an old replay) falls back to the general sentence. */
function missDetail({ card, reason }: MatchEvent): string {
  const what = card ?? "The Attack";
  return reason ? `${what} misses: ${MISS_REASONS[reason]}` : `${what} misses: the target is not allowed when it fires`;
}

/** What an event says: the action, the detail, and whether the title names the target Hero ("on Max"). */
interface Say {
  action: string;
  detail: string;
  onTarget?: boolean;
}

/** The events that are one entry each; the steps of a Move, a blocked Move and a Wait need the context and are handled by `buildCommentary`. */
const SAYINGS: Partial<Record<EventKind, (event: MatchEvent) => Say>> = {
  [EventKind.ShieldGained]: (event) => ({ action: "Block", detail: `Shield ${event.amount ?? 0} until it is hit` }),
  [EventKind.AttackHit]: (event) => ({ action: "Attack", detail: hitDetail(event.damage ?? 0, event.absorbed ?? 0), onTarget: true }),
  [EventKind.AttackFailed]: (event) => ({ action: "Attack", detail: missDetail(event), onTarget: true }),
  [EventKind.ActionFailed]: () => ({ action: "Action", detail: "The card cannot be used: nothing happens" }),
  [EventKind.SlowApplied]: () => ({ action: "Slow", detail: "Its next Move covers half the distance", onTarget: true }),
  [EventKind.MarkedApplied]: () => ({ action: "Mark", detail: "Marked: Hidden and Cover do not protect it", onTarget: true }),
  [EventKind.HiddenGained]: () => ({ action: "Hide", detail: "Hidden from the enemy Squad until it attacks" }),
  [EventKind.CoverPlaced]: () => ({ action: "Place Cover", detail: "Half Cover appears on the marked tile" }),
  [EventKind.CoverDestroyed]: () => ({ action: "Urban Renewal", detail: "The Cover on the marked tile is destroyed" }),
  [EventKind.AreaRevealed]: () => ({ action: "Site Survey", detail: "The marked area is revealed" }),
  [EventKind.FieldPlaced]: () => ({ action: "Heavy Metal", detail: "A Scrap Field covers the marked area" }),
  [EventKind.ScrapGained]: () => ({ action: "Scrap", detail: "Scrap: her cards are stronger this Round" }),
  [EventKind.Pull]: (event) =>
    event.card === "Personal Space"
      ? { action: "Push", detail: "Is pushed one tile away" }
      : { action: "Pull", detail: "Is pulled one tile toward the Bruiser" },
  [EventKind.Charged]: () => ({ action: "Express Delivery", detail: "Rushes at the enemy" }),
  [EventKind.Exhausted]: () => ({ action: "Exhausted", detail: "Out of cards: Exhausted" }),
};

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
    if (event.kind === EventKind.Step) {
      if (!moves.has(heroId)) {
        add(heroId, "Move", "Walks to the marked tile");
        moves.set(heroId, entries[entries.length - 1]!);
      }
    } else if (event.kind === EventKind.MoveBlocked) {
      const detail = "Stops: a Hero, a Wall or a conflict is in the way";
      const walked = moves.get(heroId);
      if (walked) walked.detail = detail;
      else add(heroId, "Move", detail);
    } else if (event.kind === EventKind.Wait) {
      if (sideOf(heroId) === "own") add(heroId, "Wait", "Holds position, no Energy used");
    } else {
      const say = SAYINGS[event.kind]?.(event);
      if (say) add(heroId, say.action, say.detail, say.onTarget ? targetId : undefined);
    }
  }
  return entries;
}
