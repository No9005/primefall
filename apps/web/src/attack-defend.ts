import { findTiles, type GridPosition, HeroClass, MatchEndReason, MatchMode, type MatchModeSetting, type MatchResult, REACTOR_DECK, SquadId, type SquadView, TileKind } from "game-core";
import { computeCamera, gridToWorld } from "./board-layout";

// What the web app shows for the Attack and Defend mode (docs/design/attack-defend): the role of the player, its texts,
// the pills of the HUD, the end screen and the layout of the side screen preview. Rules live in game-core; this only reads the view.

export type Role = "attack" | "defend";

/** The player is always the Left Squad (App.tsx); the other Squad has the opposite role. */
const PLAYER_SQUAD = SquadId.Left;

export const ROLE_LABELS: Record<Role, string> = { attack: "ATTACK", defend: "DEFEND" };

/** The mode a match starts in for a chosen role: the player's Squad is the Attacker or the Defender. */
export function modeForRole(role: Role): MatchModeSetting {
  return { kind: MatchMode.AttackAndDefend, defender: role === "defend" ? PLAYER_SQUAD : SquadId.Right };
}

/** The role a start parameter names (`?role=defend`, with `?hero=`); anything else is none. */
export function parseRole(value: string | null | undefined): Role | undefined {
  return value === "attack" || value === "defend" ? value : undefined;
}

/** The role of the player in a match: none in the classic mode. */
export function roleOf(view: SquadView): Role | undefined {
  if (!view.attackAndDefend) return undefined;
  return view.attackAndDefend.defender === view.squad ? "defend" : "attack";
}

export const SIDE_TAGLINES: Record<Role, string> = { attack: "Take the Prime Zone", defend: "Hold the Prime Zone" };

/** The text under the role buttons of the side screen. */
export const SIDE_TEXTS: Record<Role, string> = {
  attack:
    "Start at your Spawn. Take the Prime Zone: you need at least as many Heroes in it as the Defender, a tie is yours. Control it for 3 Resolutions or Exhaust all three Defenders.",
  // 9 is the default Defender Round limit (DEFENDER_ROUND_LIMIT in game-core host.ts); the Defender wins only by holding out, never by Exhausting the Attackers.
  defend: "Start in the Prime Zone. Hold out for 9 Rounds. You lose if all three of your Heroes are Exhausted or the Attacker controls the Zone for 3 Resolutions.",
};

/** The goal line of the role banner. */
export function roleGoal(role: Role, roundLimit: number): string {
  return role === "attack" ? "Control the Prime Zone for 3 Resolutions" : `Hold out for ${roundLimit} Rounds`;
}

/** "ZONE: YOURS" / "ZONE: CONTESTED" / "ZONE: ENEMY" in the pill of the Defender. */
export type DefenderZone = "yours" | "contested" | "enemy";

export function defenderZone(zone: { own: boolean; enemy: boolean }, attackerProgress: number): DefenderZone {
  if (zone.own && zone.enemy) return "contested";
  if (zone.enemy || attackerProgress > 0) return "enemy";
  return "yours";
}

/** "8 ROUNDS LEFT". */
export function roundsLeftText(roundsLeft: number): string {
  return `${roundsLeft} ${roundsLeft === 1 ? "ROUND" : "ROUNDS"} LEFT`;
}

/** "ROUND 5 / 12" in the Round pill of this mode. */
export function roundPillText(round: number, roundLimit: number): string {
  return `ROUND ${round} / ${roundLimit}`;
}

/** The end screen of this mode: the lines of the design. */
export interface EndTexts {
  youWere: string;
  headline: "VICTORY" | "DEFEAT";
  reason: string;
  detail: string;
}

export function endTexts(result: MatchResult, role: Role, roundLimit: number): EndTexts {
  const won = result.winner === PLAYER_SQUAD;
  let reason: string;
  if (result.reason === MatchEndReason.DefenceHeld) reason = `Defence held · ${roundLimit} Rounds played`;
  else if (result.reason === MatchEndReason.PrimeZoneHeld) reason = "Prime Zone controlled for 3 Resolutions";
  else reason = role === "defend" ? "All your Heroes were Exhausted" : "All Defender Heroes Exhausted";
  const detail = won && role === "attack" ? `Won in Round ${result.round}` : `Reached Round ${result.round} of ${roundLimit}`;
  return { youWere: `YOU WERE: ${ROLE_LABELS[role]}`, headline: won ? "VICTORY" : "DEFEAT", reason, detail };
}

// The side screen preview: the real board on a stage that is PREVIEW_ZOOM times the screen, so it stays sharp, moved by a slow camera.

export const PREVIEW_ZOOM = 1;
/** The screen y the camera looks at: the free band between the role buttons (bottom 138) and the text (top 314). */
const PREVIEW_CENTRE_Y = 226;
/** Where on the route (0 start, 1 end) the camera looks at the two ends of its drift. */
const PREVIEW_DRIFT = [0.35, 0.65] as const;
export const PREVIEW_STAGE = { width: Math.round(844 * PREVIEW_ZOOM), height: Math.round(390 * PREVIEW_ZOOM) };
/** How long one pass of the camera takes, in ms; it goes there and back in a loop. */
export const PREVIEW_MOVE_MS = 4000;

export interface Point {
  x: number;
  y: number;
}

const spawnTilesOf = (left: boolean): GridPosition[] =>
  findTiles(REACTOR_DECK, TileKind.Spawn)
    .filter(({ col }) => col < REACTOR_DECK.width / 2 === left)
    .sort((a, b) => a.row - b.row);

/** The Prime Zone tiles of the column next to a side: where that side's Defenders start (ADR 0022). */
const innerZoneTilesOf = (left: boolean): GridPosition[] => {
  const zone = findTiles(REACTOR_DECK, TileKind.PrimeZone);
  const columns = zone.map(({ col }) => col);
  const sideCol = left ? Math.min(...columns) : Math.max(...columns);
  return zone.filter(({ col }) => col === sideCol).sort((a, b) => a.row - b.row);
};

const HERO_ORDER = [HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin] as const;

export interface PreviewHero {
  id: string;
  heroClass: HeroClass;
  position: GridPosition;
  exhausted: false;
}

export interface PreviewLayout {
  /** The player's Squad and the enemy Squad in their start positions of the role. */
  heroes: PreviewHero[];
  enemies: PreviewHero[];
  /** Stage px of the centre of the own Spawn, the Prime Zone and the enemy Spawn. */
  spawn: Point;
  zone: Point;
  enemySpawn: Point;
  /** The translate of the stage, in screen px, at the two ends of the camera move. */
  from: Point;
  to: Point;
}

const centreOf = (points: Point[]): Point => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });

export function previewLayout(role: Role): PreviewLayout {
  const camera = computeCamera(PREVIEW_STAGE.width, PREVIEW_STAGE.height);
  const toStage = (tile: GridPosition): Point => {
    const world = gridToWorld(tile);
    return { x: world.x * camera.scale + camera.x, y: world.y * camera.scale + camera.y };
  };
  const squad = (tiles: GridPosition[], prefix: string): PreviewHero[] => tiles.map((position, i) => ({ id: `${prefix}${i}`, heroClass: HERO_ORDER[i]!, position, exhausted: false }));
  const spawn = centreOf(spawnTilesOf(true).map(toStage));
  const zone = centreOf(findTiles(REACTOR_DECK, TileKind.PrimeZone).map(toStage));
  const enemySpawn = centreOf(spawnTilesOf(false).map(toStage));
  // The translate that puts a stage point in the free middle of the screen (between the role buttons and the text), x centred.
  const centred = (point: Point): Point => ({ x: 844 / 2 - point.x, y: PREVIEW_CENTRE_Y - point.y });
  // The camera drifts from a view near the start of the route to one near its end; both views have the whole route on screen.
  const [from, to] = role === "attack" ? [spawn, zone] : [zone, enemySpawn];
  const between = (t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  const [start, end] = [between(PREVIEW_DRIFT[0]), between(PREVIEW_DRIFT[1])];
  return {
    heroes: squad(role === "attack" ? spawnTilesOf(true) : innerZoneTilesOf(true), "p"),
    enemies: squad(role === "attack" ? innerZoneTilesOf(false) : spawnTilesOf(false), "e"),
    spawn,
    zone,
    enemySpawn,
    from: centred(start),
    to: centred(end),  };
}
