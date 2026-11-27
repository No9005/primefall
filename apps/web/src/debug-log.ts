// An on-screen log for finding faults on a phone, where there is no console: it is on only with `?debug=1` in the address and costs nothing without it.

const MAX_LINES = 60;

const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
const lines: string[] = [];
let overlay: HTMLPreElement | undefined;

/** Adds a line (with the milliseconds since the page was loaded) to the on-screen log. */
export function debugLog(message: string): void {
  if (!enabled) return;
  lines.push(`${Math.round(performance.now())} ${message}`);
  if (lines.length > MAX_LINES) lines.shift();
  if (!overlay) {
    overlay = document.createElement("pre");
    overlay.setAttribute("data-testid", "debug-log");
    overlay.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;margin:0;padding:4px;z-index:99999;pointer-events:none;overflow:hidden;white-space:pre-wrap;font:9px/1.2 monospace;color:#9f9;text-shadow:0 0 2px #000;";
    document.body.appendChild(overlay);
  }
  overlay.textContent = lines.slice(-MAX_LINES).join("\n");
}

/** Logs the events of a media element (a film) with its position, so that a start at the wrong place or a stall can be read off. */
export function debugMedia(name: string, element: HTMLMediaElement): void {
  if (!enabled) return;
  for (const type of ["loadeddata", "canplay", "play", "playing", "pause", "seeking", "seeked", "waiting", "stalled", "ended", "error"]) {
    element.addEventListener(type, () => debugLog(`${name} ${type} t=${element.currentTime.toFixed(2)} state=${element.readyState}`));
  }
}
