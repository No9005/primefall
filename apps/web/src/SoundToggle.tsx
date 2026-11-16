import { useSyncExternalStore } from "react";
import { gameAudio } from "./audio";

/** The mute switch: on every screen, in a corner. The choice is kept for the next visit. */
export function SoundToggle() {
  const muted = useSyncExternalStore(gameAudio.subscribe, () => gameAudio.isMuted);
  return (
    <button type="button" className="sound-toggle" aria-pressed={muted} aria-label={muted ? "Sound is off, turn it on" : "Sound is on, turn it off"} data-testid="sound-toggle" onClick={() => gameAudio.setMuted(!muted)}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
        {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
    </button>
  );
}
