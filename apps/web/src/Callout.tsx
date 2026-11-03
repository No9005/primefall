import { useState, type CSSProperties } from "react";
import { calloutClassName, calloutStyleVars, type CalloutKind, type CalloutTone } from "./callout";

interface CalloutProps {
  kind: CalloutKind;
  text: string;
  tone: CalloutTone;
  durationMs: number;
  onDone?: () => void;
}

/** A big centre text that animates in, holds and fades out. It never takes pointer input; a new text restarts it. */
export function Callout(props: CalloutProps) {
  return (
    <div className="callout" aria-live="polite">
      <CalloutBody key={props.text} {...props} />
    </div>
  );
}

function CalloutBody({ kind, text, tone, durationMs, onDone }: CalloutProps) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      className={calloutClassName(kind, tone)}
      style={calloutStyleVars(durationMs) as CSSProperties}
      onAnimationEnd={() => {
        setDone(true);
        onDone?.();
      }}
    >
      {text}
    </div>
  );
}
