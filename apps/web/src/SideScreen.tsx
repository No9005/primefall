import { type GridPosition, REACTOR_DECK } from "game-core";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { PREVIEW_MOVE_MS, PREVIEW_STAGE, type PreviewLayout, previewLayout, type Point, type Role, ROLE_LABELS, SIDE_TAGLINES, SIDE_TEXTS } from "./attack-defend";
import { Board } from "./Board";
import { SCREEN } from "./HeroSelectScreen";
import type { HeroMarks } from "./shield-marks";
import { zoneLook } from "./vision-effects";
import "./hero-select.css";
import "./side-screen.css";

// The side screen of Attack and Defend (docs/design/attack-defend): the player picks Attack or Defend over a dimmed preview of the board.

const NONE: readonly never[] = [];
const NO_CLIPS = {};
const NO_MARKS: Readonly<Record<string, HeroMarks>> = {};
const BUBBLE: HeroMarks = { rubies: 0, filled: false, ticks: [], bubble: true, icons: [] };
const NEUTRAL_ZONE = zoneLook("neutral", 0);
const noop = () => undefined;
const pickRef = { current: undefined };

/** Every tile of the board: the preview has no Fog of War. */
const ALL_TILES: readonly GridPosition[] = (() => {
  const tiles: GridPosition[] = [];
  REACTOR_DECK.tiles.forEach((line, row) => line.forEach((_, col) => tiles.push({ col, row })));
  return tiles;
})();

function fitScale(): number {
  return Math.min(window.innerWidth / SCREEN.width, window.innerHeight / SCREEN.height);
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M16 9H3M8 4L3 9l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NextArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 9h13M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The dashed arrow between two stage points (a gentle curve, the head on the second point) and the labels, all in stage px. */
function RouteMarks({ role, layout }: { role: Role; layout: PreviewLayout }) {
  const [start, end]: [Point, Point] = role === "attack" ? [layout.spawn, layout.zone] : [layout.enemySpawn, layout.zone];
  const colour = role === "attack" ? "#ff8a3d" : "#e5484d";
  // The head sits short of the Zone's centre, on the side the arrow comes from.
  const direction = Math.sign(end.x - start.x) || 1;
  const tip = { x: end.x - direction * 56, y: end.y - 16 };
  const from = { x: start.x + direction * 36, y: start.y - 12 };
  const bend = { x: (from.x + tip.x) / 2, y: Math.min(from.y, tip.y) - 44 };
  const head = [
    [tip.x - direction * 14, tip.y - 9],
    [tip.x, tip.y],
    [tip.x - direction * 14, tip.y + 9],
  ];
  const label = (text: string, at: Point, style?: CSSProperties) => (
    <span className="sd-label" style={{ left: at.x, top: at.y, ...style }}>
      {text}
    </span>
  );
  const zoneLabel = role === "attack" ? "PRIME ZONE" : "PRIME ZONE · YOUR START";
  return (
    <>
      <svg className="sd-route" width={PREVIEW_STAGE.width} height={PREVIEW_STAGE.height} aria-hidden="true">
        <path d={`M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${tip.x} ${tip.y}`} fill="none" stroke={colour} strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" />
        <path d={`M ${head[0]![0]} ${head[0]![1]} L ${head[1]![0]} ${head[1]![1]} L ${head[2]![0]} ${head[2]![1]}`} fill="none" stroke={colour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Attack: the Zone is the lower end of the route, so its label stands above it. Defend: the enemy Spawn is the lower end. */}
      {role === "attack" && label("YOUR SPAWN", { x: layout.spawn.x, y: layout.spawn.y + 44 })}
      {role === "attack" && label(zoneLabel, { x: layout.zone.x, y: layout.zone.y - 52 })}
      {role === "defend" && label(zoneLabel, { x: layout.zone.x - 40, y: layout.zone.y + 44 })}
      {role === "defend" && label("ENEMY SPAWN", { x: layout.enemySpawn.x + 40, y: layout.enemySpawn.y - 70 })}
      {role === "defend" && label("ATTACKERS COME FROM HERE", { x: layout.enemySpawn.x + 40, y: layout.enemySpawn.y - 52 })}
    </>
  );
}

/** The real board behind the side screen at 50 %, with a slow camera move that loops (the stage moves, the board stays sharp). */
function Preview({ role }: { role: Role }) {
  const layout = useMemo(() => previewLayout(role), [role]);
  const marks = useMemo(() => Object.fromEntries((role === "attack" ? layout.enemies : layout.heroes).map((hero) => [hero.id, BUBBLE])), [role, layout]);
  const stage = useRef<HTMLDivElement>(null);
  // The stage is made new per role, so that switching the role restarts the move.
  const style = {
    width: PREVIEW_STAGE.width,
    height: PREVIEW_STAGE.height,
    "--from-x": `${layout.from.x}px`,
    "--from-y": `${layout.from.y}px`,
    "--to-x": `${layout.to.x}px`,
    "--to-y": `${layout.to.y}px`,
    "--move-ms": `${PREVIEW_MOVE_MS}ms`,
  } as CSSProperties;
  return (
    <div className="sd-preview" data-testid="side-preview" data-role={role}>
      <div className="sd-stage" key={role} ref={stage} style={style}>
        <Board
          overview
          destroyedCover={NONE}
          placedCover={NONE}
          wreckCover={NONE}
          revealedAreas={NONE}
          visibleTiles={ALL_TILES}
          heroes={layout.heroes}
          enemies={layout.enemies}
          selectedId=""
          onSelect={noop}
          targetableIds={NONE}
          onTargetTap={noop}
          hitIds={NONE}
          clips={NO_CLIPS}
          highlights={NONE}
          markers={NONE}
          onTileTap={noop}
          zoneTint={NEUTRAL_ZONE}
          zoneLabels={NONE}
          areaTiles={NONE}
          shotLines={NONE}
          targetLines={NONE}
          marks={{ ...NO_MARKS, ...marks }}
          paths={NONE}
          collisionTiles={NONE}
          pickRef={pickRef}
        />
        <RouteMarks role={role} layout={layout} />
      </div>
      <span className="sd-tag">PREVIEW</span>
    </div>
  );
}

interface SideScreenProps {
  onBack: () => void;
  onNext: (role: Role) => void;
}

export function SideScreen({ onBack, onNext }: SideScreenProps) {
  const [role, setRole] = useState<Role>("attack");
  const [scale, setScale] = useState(fitScale);
  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <section className="hero-select side-screen" aria-label="Choose your side" data-testid="side-screen">
      <div className="hs-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <Preview role={role} />
        <button type="button" className="hs-back" onClick={onBack}>
          <BackArrow />
          <span>BACK</span>
        </button>
        <h1 className="hs-title">CHOOSE YOUR SIDE</h1>
        <span className="hs-chip mode" data-testid="mode-chip">
          ATTACK AND DEFEND
        </span>
        {(["attack", "defend"] as const).map((option) => (
          <button key={option} type="button" className={`sd-role ${option}${role === option ? " selected" : ""}`} aria-pressed={role === option} data-testid={`side-${option}`} onClick={() => setRole(option)}>
            <b>{ROLE_LABELS[option]}</b>
            <span>{SIDE_TAGLINES[option]}</span>
          </button>
        ))}
        <div className={`sd-text ${role}`} data-testid="side-text">
          <h2>{ROLE_LABELS[role]}</h2>
          <p>{SIDE_TEXTS[role]}</p>
        </div>
        <button type="button" className="hs-start sd-next" onClick={() => onNext(role)}>
          <span>NEXT</span>
          <NextArrow />
        </button>
      </div>
    </section>
  );
}
