export type CalloutKind = "number" | "word";
export type CalloutTone = "teal" | "amber" | "red" | "gold";

/** CSS classes of a callout: the kind picks the keyframes (see styles.css), the tone the colour. */
export function calloutClassName(kind: CalloutKind, tone: CalloutTone): string {
  return `callout-${kind} callout-tone-${tone}`;
}

/** The animation length as the custom property the stylesheet reads; never shorter than 1 ms. */
export function calloutStyleVars(durationMs: number): Record<string, string> {
  return { "--callout-ms": `${Math.max(1, Math.round(durationMs))}ms` };
}
