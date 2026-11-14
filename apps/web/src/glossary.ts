// The entries of the in-game glossary screen: every mark, status, symbol and zone look the player meets. Pure data.
// The picture of an entry is not an image: `glossary-pictures.ts` draws a `scene` with the board's own drawing code and the
// glossary screen renders a `hud` entry with the HUD's own components and styles.

export enum GlossaryGroup {
  Heroes = "Heroes",
  Numbers = "Numbers",
  Board = "Board",
  Hud = "HUD",
}

export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = [GlossaryGroup.Heroes, GlossaryGroup.Numbers, GlossaryGroup.Board, GlossaryGroup.Hud];

/** The pictures drawn with Pixi on a small board. */
export type SceneName =
  | "shield"
  | "plannedBlock"
  | "slow"
  | "marked"
  | "hidden"
  | "hiddenSeen"
  | "ghost"
  | "exhaustion"
  | "overdrive"
  | "attackBonus"
  | "plannedIcons"
  | "crossfire"
  | "charge"
  | "closeAndCharge"
  | "deckDamage"
  | "longRangeBonus"
  | "shieldLoss"
  | "blocked"
  | "outOfRange"
  | "tooClose"
  | "halfCoverTag"
  | "knockback"
  | "pull"
  | "cover"
  | "placedCover"
  | "enemyPlacedCover"
  | "destroyedCover"
  | "zoneEmpty"
  | "zoneOurs"
  | "zoneContested"
  | "zoneEnemy"
  | "outposts"
  | "scoutArea"
  | "scannedArea";

/** The pictures made of the HUD's own components. */
export type HudName = "scorePill" | "timerPill" | "queue" | "deckPile" | "resolutionBar" | "commentary";

export type GlossaryPicture = { scene: SceneName } | { hud: HudName };

export interface GlossaryEntry {
  /** The term of GLOSSARY.md where the game has one. */
  name: string;
  group: GlossaryGroup;
  /** One or two lines. */
  text: string;
  /** Set for an entry that exists only in a mode of the game. */
  mode?: string;
  picture: GlossaryPicture;
}

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  {
    name: "Shield",
    group: GlossaryGroup.Heroes,
    text: "A blue crystal above the head for each Shield point and a bubble in front of the Hero. Each absorbed hit takes a crystal; at zero the bubble breaks.",
    picture: { scene: "shield" },
  },
  {
    name: "Planned Block",
    group: GlossaryGroup.Heroes,
    text: "Hollow dashed crystals above your own Hero while its Queue holds a Block; the tag is the Tick of the Block.",
    mode: "Attack and Defend only: the classic mode has no Block.",
    picture: { scene: "plannedBlock" },
  },
  {
    name: "Slow",
    group: GlossaryGroup.Heroes,
    text: "A violet ground field and three downward chevrons above the head, until the end of the next Resolution.",
    picture: { scene: "slow" },
  },
  {
    name: "Marked",
    group: GlossaryGroup.Heroes,
    text: "A red reticle locks on, with the tag MARKED, until the end of the next Resolution. The enemy Squad sees a Marked Hero, also a Hidden one.",
    picture: { scene: "marked" },
  },
  {
    name: "Hidden",
    group: GlossaryGroup.Heroes,
    text: "Your own Hidden Hero is drawn translucent. The enemy Squad does not see it until it attacks or is Marked.",
    picture: { scene: "hidden" },
  },
  {
    name: "Hidden, seen by a drone",
    group: GlossaryGroup.Heroes,
    text: "A Scout Drone area shows a Hidden enemy: translucent, a cyan ring inside the red one, an eye and the tag HIDDEN · SEEN. It is shown, not unmasked.",
    picture: { scene: "hiddenSeen" },
  },
  {
    name: "Ghost",
    group: GlossaryGroup.Heroes,
    text: "An enemy that left your sight: a faded red figure with a dashed ring and the tag last seen, at the tile where you saw it last.",
    picture: { scene: "ghost" },
  },
  {
    name: "Exhaustion",
    group: GlossaryGroup.Heroes,
    text: "An Exhausted Hero is grey and slumped and is out of the match; its Deck pile shows a red skull. It leaves Half Cover on its tile.",
    picture: { scene: "exhaustion" },
  },
  {
    name: "Overdrive",
    group: GlossaryGroup.Heroes,
    text: "A gold glow, two gold rings rising from the ground and the tag OVERDRIVE before the action. The effect itself is the Overdrive side of the card.",
    picture: { scene: "overdrive" },
  },
  {
    name: "Attack bonus",
    group: GlossaryGroup.Heroes,
    text: "A small gold badge with a double chevron and +1 above the Hero, from Adrenal Surge in Overdrive. It stays until Exhaustion.",
    picture: { scene: "attackBonus" },
  },
  {
    name: "Planned Wait and card on itself",
    group: GlossaryGroup.Heroes,
    text: "Above your own Hero a grey chip for each planned action without a line on the board: Wait (hourglass) and a card played on the Hero itself, numbered by Tick.",
    picture: { scene: "plannedIcons" },
  },
  {
    name: "Crossfire",
    group: GlossaryGroup.Heroes,
    text: "The second hit on a Hero by another attacker within one Tick carries the tag CROSSFIRE +1 above the damage number.",
    picture: { scene: "crossfire" },
  },
  {
    name: "Charge",
    group: GlossaryGroup.Heroes,
    text: "The Bruiser rushes at the enemy with speed streaks behind it, ends next to it and gains Shield 1 for the Round (tag SHIELD 1 · THIS ROUND).",
    picture: { scene: "charge" },
  },
  {
    name: "Close and Charge bonus",
    group: GlossaryGroup.Numbers,
    text: "Tags above the damage number say where extra damage comes from: CLOSE +1 for a close-range effect, CHARGE +1 for the first hit at Range 1 after a Charge.",
    picture: { scene: "closeAndCharge" },
  },
  {
    name: "Deck Damage",
    group: GlossaryGroup.Numbers,
    text: "A red number rises over the Hero and fades: the cards its Deck lost.",
    picture: { scene: "deckDamage" },
  },
  {
    name: "Long-range bonus",
    group: GlossaryGroup.Numbers,
    text: "Gold number: the Deck Damage includes the bonus of a long-range hit.",
    picture: { scene: "longRangeBonus" },
  },
  {
    name: "Shield loss",
    group: GlossaryGroup.Numbers,
    text: "Blue number: the hit was absorbed by Shield, one point per crystal.",
    picture: { scene: "shieldLoss" },
  },
  {
    name: "Blocked",
    group: GlossaryGroup.Numbers,
    text: "Grey word: the attack was stopped on the way, for example by Full Cover.",
    picture: { scene: "blocked" },
  },
  {
    name: "Out of range",
    group: GlossaryGroup.Numbers,
    text: "Grey words: the target was beyond the Range of the card, the attack missed.",
    picture: { scene: "outOfRange" },
  },
  {
    name: "Too close",
    group: GlossaryGroup.Numbers,
    text: "Grey words: the target was inside the Minimum Range of the card, the attack missed.",
    picture: { scene: "tooClose" },
  },
  {
    name: "Half Cover tag",
    group: GlossaryGroup.Numbers,
    text: "A tag beside the number: Half Cover on the target's tile reduced the hit.",
    picture: { scene: "halfCoverTag" },
  },
  {
    name: "Knockback",
    group: GlossaryGroup.Numbers,
    text: "The Hero slides back and the tag shows how many tiles.",
    picture: { scene: "knockback" },
  },
  {
    name: "Pull",
    group: GlossaryGroup.Numbers,
    text: "The Hero slides towards the caster with a tether and two echoes behind it (tag PULLED), then a ring and the tag PULL 2.",
    picture: { scene: "pull" },
  },
  {
    name: "Cover",
    group: GlossaryGroup.Board,
    text: "A shield mark sits on each piece: Half Cover (low, reduces a hit by 1, does not block sight) and Full Cover (tall, blocks attacks and sight from the firing direction).",
    picture: { scene: "cover" },
  },
  {
    name: "Placed Cover",
    group: GlossaryGroup.Board,
    text: "Cover a Hero built: striped bars with four teal corner marks, which say it is your Squad's and that it stays until it is destroyed. At most three per Squad; the chip COVER 3 / 3 counts them, and the oldest goes when a fourth is placed (aiming it: OLDEST · GOES).",
    picture: { scene: "placedCover" },
  },
  {
    name: "Enemy Placed Cover",
    group: GlossaryGroup.Board,
    text: "Cover the enemy built that you have seen stays on the map with red corner marks and the tag ENEMY COVER. You only know of it once you have seen the tile.",
    picture: { scene: "enemyPlacedCover" },
  },
  {
    name: "Destroyed Cover",
    group: GlossaryGroup.Board,
    text: "After Breach Charge or Wrecking Blow the Cover is gone and a scorched outline stays on the tile.",
    picture: { scene: "destroyedCover" },
  },
  {
    name: "Prime Zone: empty",
    group: GlossaryGroup.Board,
    text: "White and faint while nobody is in it.",
    picture: { scene: "zoneEmpty" },
  },
  {
    name: "Prime Zone: ours",
    group: GlossaryGroup.Board,
    text: "Teal when your Squad controls it; a ring runs over it once per Resolution.",
    picture: { scene: "zoneOurs" },
  },
  {
    name: "Prime Zone: contested",
    group: GlossaryGroup.Board,
    text: "Amber when both Squads have Heroes in it and neither controls it.",
    picture: { scene: "zoneContested" },
  },
  {
    name: "Prime Zone: enemy",
    group: GlossaryGroup.Board,
    text: "Red when the enemy Squad controls it.",
    picture: { scene: "zoneEnemy" },
  },
  {
    name: "Outpost",
    group: GlossaryGroup.Board,
    text: "An amber tile. The Squad that controls it earns a Victory Point per Resolution.",
    mode: "Classic mode.",
    picture: { scene: "outposts" },
  },
  {
    name: "Scout Drone area",
    group: GlossaryGroup.Board,
    text: "The drone circles over the area and sends scan rays down (tag SCOUT DRONE · ANYWHERE). Fog tiles lift in cyan; enemies in it are seen. Two dots count the Resolutions left; then the fog closes.",
    picture: { scene: "scoutArea" },
  },
  {
    name: "Scanned area",
    group: GlossaryGroup.Board,
    text: "A dashed amber outline with an amber sweep and the tag SCANNED · n (the Resolutions left) round an area the enemy Scout Drone scans. You see that it is scanned, not who looks or what is seen.",
    picture: { scene: "scannedArea" },
  },
  {
    name: "Score pill",
    group: GlossaryGroup.Hud,
    text: "Victory Points, yours then the enemy's, and a dot for each zone: Outpost, Prime Zone, Outpost. A dot is teal when you control the zone, red for the enemy, amber when contested.",
    mode: "Classic mode.",
    picture: { hud: "scorePill" },
  },
  {
    name: "Round and timer",
    group: GlossaryGroup.Hud,
    text: "The Round and the planning time left; LOCKED while the Resolution plays. The time turns amber at 10 s and red at 5 s.",
    picture: { hud: "timerPill" },
  },
  {
    name: "Queue",
    group: GlossaryGroup.Hud,
    text: "The selected Hero's four slots, Tick 1 on top, filled with the action and its target. The current Tick is lit while the Resolution plays.",
    picture: { hud: "queue" },
  },
  {
    name: "Deck pile",
    group: GlossaryGroup.Hud,
    text: "The cards left in the Deck, with the Discard and Exile counts above. Deck Damage burns the top card; Exhaustion shows a red skull.",
    picture: { hud: "deckPile" },
  },
  {
    name: "Resolution bar",
    group: GlossaryGroup.Hud,
    text: "RESOLUTION · TICK n / 3 in teal along the top while the Ticks play; RESOLUTION COMPLETE at the end.",
    picture: { hud: "resolutionBar" },
  },
  {
    name: "Commentary",
    group: GlossaryGroup.Hud,
    text: "One entry per action of the Tick; the bar is gold for your allies, red for the enemy and teal for the selected Hero. The text names the action and its result.",
    picture: { hud: "commentary" },
  },
];
