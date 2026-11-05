import { PRIME_ZONE_WIN_RESOLUTIONS } from "game-core";
import { type CSSProperties, useState } from "react";
import { type DefenderZone, type Role, ROLE_LABELS, roleGoal, roundsLeftText } from "./attack-defend";
import { RESOLUTION_CALLOUT_MS } from "./resolution-hud";

// The HUD elements of Attack and Defend (docs/design/attack-defend): the role label, the centre pill of each role and the role banner.

const ZONE_TEXT: Record<DefenderZone, string> = { yours: "ZONE: YOURS", contested: "ZONE: CONTESTED", enemy: "ZONE: ENEMY" };
const HOLD_BANNER = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("hold") === "banner";
const PIPS =Array.from({ length: PRIME_ZONE_WIN_RESOLUTIONS }, (_, i) => i);

export function RoleLabel({ role }: { role: Role }) {
  return (
    <div className={`role-label ${role}`} data-testid="role-label">
      <i />
      <span>{ROLE_LABELS[role]}</span>
    </div>
  );
}

/** The Attacker's pill: ZONE CONTROL, three pips and n / 3. */
export function AttackerPill({ filled, resolving }: { filled: number; resolving: boolean }) {
  return (
    <div className={`prime-pill role-pill attack${resolving ? " resolving" : ""}`} data-testid="prime-progress" aria-label={`Zone control, ${filled} of ${PRIME_ZONE_WIN_RESOLUTIONS}`}>
      <span className="prime-label">ZONE CONTROL</span>
      <span className="prime-pips">
        {PIPS.map((pip) => (
          <span key={`${pip}-${pip < filled}`} className={pip < filled ? "prime-pip prime-pip-filled" : "prime-pip"} />
        ))}
      </span>
      <span className="pill-count">
        {filled} / {PRIME_ZONE_WIN_RESOLUTIONS}
      </span>
    </div>
  );
}

/** The Defender's pill: HOLD OUT, the Rounds left and the state of the Zone. */
export function DefenderPill({ roundsLeft, zone, resolving }: { roundsLeft: number; zone: DefenderZone; resolving: boolean }) {
  return (
    <div className={`prime-pill role-pill defend${resolving ? " resolving" : ""}`} data-testid="prime-progress" aria-label={`Hold out, ${roundsLeftText(roundsLeft)}, ${ZONE_TEXT[zone]}`}>
      <span className="prime-label">HOLD OUT</span>
      <span className="pill-rounds">{roundsLeftText(roundsLeft)}</span>
      <i className="pill-divider" />
      <span className={`pill-zone ${zone}`}>{ZONE_TEXT[zone]}</span>
    </div>
  );
}

/** The announcement of the role when a match starts: a bar across the screen, shown as long as the RESOLUTION callout. */
export function RoleBanner({ role, roundLimit }: { role: Role; roundLimit: number }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  // ?hold=banner keeps the banner on screen, so that the screenshot tool can look at it.
  const style = { "--callout-ms": `${RESOLUTION_CALLOUT_MS}ms`, ...(HOLD_BANNER && { animation: "none" }) } as CSSProperties;
  return (
    <div className="role-banner-dim" style={style} onAnimationEnd={() => setDone(true)} data-testid="role-banner" aria-live="polite">
      <div className="role-banner">
        <span className="role-banner-small">YOUR ROLE</span>
        <b className={role}>{ROLE_LABELS[role]}</b>
        <span className="role-banner-goal">{roleGoal(role, roundLimit)}</span>
      </div>
    </div>
  );
}
