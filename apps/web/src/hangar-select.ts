import { HeroClass } from "game-core";

// The Hero Select in the hangar of the Notstrom (the design canvas boards "Hangar: Max, Tilly and Kit with idle, tap each to select and
// deselect" and "tighter crop"). Each of the three Heroes lives in a small state machine of animation clips; this file is that machine
// and the table of the clips. The picture of the hangar and the layout are in `HeroSelectScreen.tsx` and `hangar-select.css`.

/** The three Heroes, left to right, by the letter the clip files use: Max (Bruiser), Tilly (Controller), Kit (Assassin). */
export const HANGAR_HEROES = ["max", "tilly", "kit"] as const;
export type HangarHero = (typeof HANGAR_HEROES)[number];

export const HERO_OF: Record<HangarHero, HeroClass> = { max: HeroClass.Bruiser, tilly: HeroClass.Controller, kit: HeroClass.Assassin };
export const HANGAR_HERO_OF: Record<HeroClass, HangarHero> = { [HeroClass.Bruiser]: "max", [HeroClass.Controller]: "tilly", [HeroClass.Assassin]: "kit" };

export type ClipName = "idle" | "tolift" | "act" | "toidle" | "selecti" | "select" | "hold" | "desel";

/** A clip: a strip of `frames` frames played in `seconds`; `file` is in `assets/hangar/clips/`. */
export interface Clip {
  file: string;
  frames: number;
  seconds: number;
}

/** What a Hero is doing: a clip, or the short bridge (two frames of its own) that links a pose in the middle of an action to the ready pose. */
export type Mode = ClipName | "bridge";

/** The size of one frame in design pixels (the hangar is drawn at 960 x 444). */
export const FRAME: Record<HangarHero, { width: number; height: number }> = {
  max: { width: 482.3, height: 284.3 },
  tilly: { width: 345.2, height: 294.5 },
  kit: { width: 345.2, height: 299.5 },
};

export const CLIPS: Record<HangarHero, Partial<Record<ClipName, Clip>>> = {
  max: {
    idle: { file: "max-idle.png", frames: 40, seconds: 2.0 },
    tolift: { file: "max-tolift.png", frames: 10, seconds: 0.7 },
    act: { file: "max-act.png", frames: 18, seconds: 1.8 },
    toidle: { file: "max-toidle.png", frames: 8, seconds: 0.55 },
    selecti: { file: "max-selecti.png", frames: 20, seconds: 1.2 },
    select: { file: "max-select.png", frames: 32, seconds: 2.0 },
    hold: { file: "max-hold.png", frames: 40, seconds: 2.0 },
    desel: { file: "max-desel.png", frames: 5, seconds: 0.4 },
  },
  tilly: {
    idle: { file: "tilly-idle.png", frames: 40, seconds: 2.0 },
    tolift: { file: "tilly-tolift.png", frames: 2, seconds: 0.12 },
    act: { file: "tilly-act.png", frames: 27, seconds: 2.7 },
    toidle: { file: "tilly-toidle.png", frames: 2, seconds: 0.12 },
    select: { file: "tilly-select.png", frames: 23, seconds: 1.5 },
    selecti: { file: "tilly-selecti.png", frames: 30, seconds: 1.8 },
    hold: { file: "tilly-hold.png", frames: 88, seconds: 4.4 },
    desel: { file: "tilly-desel.png", frames: 15, seconds: 1.0 },
  },
  kit: {
    idle: { file: "kit-idle.png", frames: 36, seconds: 3.6 },
    act: { file: "kit-act.png", frames: 42, seconds: 2.9 },
    select: { file: "kit-select.png", frames: 29, seconds: 1.5 },
    hold: { file: "kit-hold.png", frames: 110, seconds: 5.5 },
    desel: { file: "kit-desel.png", frames: 14, seconds: 0.9 },
  },
};

/**
 * The bridge from a moment of an action into the ready pose: a strip of `frames` frames, two for each of the `frames / 2` moments of the
 * action. `entry` is the moment to use (the one the action is at), or `undefined` for "the moment that fits the frame of the clip".
 */
export interface Bridge {
  file: string;
  frames: number;
  entry?: number;
}

export const BRIDGES: Record<HangarHero, Partial<Record<"idle" | "act", Bridge>>> = {
  max: { act: { file: "max-bridge-act.png", frames: 36 } },
  tilly: { act: { file: "tilly-bridge-act.png", frames: 54 } },
  kit: { act: { file: "kit-bridge.png", frames: 84 }, idle: { file: "kit-bridge.png", frames: 84, entry: 0 } },
};

/** The clips that lead into and out of the action: Max and Tilly lift into it and drop out of it, Kit goes straight in. */
export const TRANSITIONS: Record<HangarHero, [ClipName | undefined, ClipName | undefined]> = {
  max: ["tolift", "toidle"],
  tilly: ["tolift", "toidle"],
  kit: [undefined, undefined],
};

/** How long each of the two frames of a bridge stands. */
export const BRIDGE_FRAME_MS = 85;

/** The clips that are looped; the others play once and rest on their last frame (until the next one starts). */
export const isLooped = (mode: ClipName): boolean => mode === "idle" || mode === "act" || mode === "hold";

/** What the screen needs to draw a Hero. */
export interface PlayerState {
  mode: Mode;
  /** In a bridge: the moment of the action, which of its two frames, and the clip it came from. */
  bridgeEntry: number;
  bridgeHalf: 0 | 1;
  bridgeFrom: "idle" | "act";
}

/** Where a Hero is: the ready pose and everything leading into it count as selected; the way back (`desel`) does not. */
export const isSelectedMode = (mode: Mode): boolean => mode === "select" || mode === "hold" || mode === "bridge" || mode === "selecti";

/** The clock of a player: real in the game, a fake in the tests. */
export interface PlayerEnv {
  now: () => number;
  after: (ms: number, run: () => void) => unknown;
  cancel: (handle: unknown) => void;
  /** A whole number from `low` to `high`, both included. */
  random: (low: number, high: number) => number;
}

export const realEnv: PlayerEnv = {
  now: () => Date.now(),
  after: (ms, run) => setTimeout(run, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: (low, high) => low + Math.floor(Math.random() * (high - low + 1)),
};

/**
 * One Hero. It idles, now and then does its action (Max lifts, Tilly tinkers, Kit cleans his rifle), and a tap selects it: from the idle
 * pose into the ready pose, in the middle of an action through a bridge, or, in the transition clips, as soon as they are over. A tap on a
 * selected Hero (also one still on its way into the ready pose) takes the selection back (`desel`, then idle); a tap during `desel`
 * selects it again; a tap during the bridge waits for the ready pose.
 */
export class HeroPlayer {
  state: PlayerState = { mode: "idle", bridgeEntry: 0, bridgeHalf: 0, bridgeFrom: "idle" };
  private startedAt: number;
  private timer: unknown;
  private pending = false;
  private queuedTap = false;
  private disposed = false;

  constructor(
    readonly hero: HangarHero,
    private readonly env: PlayerEnv,
    private readonly onChange: () => void,
  ) {
    this.startedAt = env.now();
  }

  /** Begins the idle after `delay` ms (the three begin at different moments, so that nothing moves in step). */
  begin(delay: number): void {
    this.start("idle", delay);
  }

  /** Stands in the ready pose from the start (the screen opened with this Hero chosen). */
  beginSelected(): void {
    this.start("hold", 0);
  }

  /** Without motion: the idle pose or the ready pose, at once, nothing plays. */
  setStill(selected: boolean): void {
    this.cancelTimer();
    this.set({ mode: selected ? "hold" : "idle", bridgeEntry: 0, bridgeHalf: 0, bridgeFrom: "idle" });
  }

  get selected(): boolean {
    return isSelectedMode(this.state.mode);
  }

  tap(): void {
    const mode = this.state.mode;
    if (mode === "bridge") {
      // A tap during the two frames of the bridge is kept: it takes the selection back as soon as the ready pose begins.
      this.queuedTap = true;
      return;
    }
    const bridgeFrom = mode === "idle" || mode === "act" ? mode : undefined;
    if (this.hero !== "kit" && mode === "idle") this.start("selecti", 0);
    else if (bridgeFrom) this.bridge(bridgeFrom);
    else if (mode === "tolift" || mode === "toidle") this.pending = true;
    else if (mode === "select" || mode === "hold" || mode === "selecti") this.start("desel", 0);
    else if (mode === "desel") this.start("select", 0);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  /** The frame of a looped clip at this moment (the bridge starts from it). */
  frameNow(clip: Clip): number {
    return Math.floor((this.env.now() - this.startedAt) / 1000 / (clip.seconds / clip.frames)) % clip.frames;
  }

  private set(next: PlayerState): void {
    this.state = next;
    if (!this.disposed) this.onChange();
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.env.cancel(this.timer);
    this.timer = undefined;
  }

  private start(mode: ClipName, delay: number): void {
    this.cancelTimer();
    const go = () => {
      this.startedAt = this.env.now();
      this.set({ mode, bridgeEntry: 0, bridgeHalf: 0, bridgeFrom: "idle" });
      const clip = CLIPS[this.hero][mode];
      if (!clip) return;
      const [lift, drop] = TRANSITIONS[this.hero];
      let next: ClipName | undefined;
      let after = clip.seconds * 1000;
      if (mode === "idle") {
        next = lift ?? "act";
        after = clip.seconds * 1000 * this.env.random(2, 3);
      } else if (mode === "tolift") next = "act";
      else if (mode === "act") {
        next = drop ?? "idle";
        after = clip.seconds * 1000 * this.env.random(1, 2);
      } else if (mode === "toidle") next = "idle";
      else if (mode === "selecti" || mode === "select") next = "hold";
      else if (mode === "desel") next = "idle";
      if (next) {
        const following = next;
        this.timer = this.env.after(after, () => this.start(following, 0));
      }
      if (this.pending && (mode === "idle" || mode === "act")) {
        this.pending = false;
        this.env.after(0, () => this.tap());
      }
      if (this.queuedTap && mode === "select") {
        this.queuedTap = false;
        this.env.after(0, () => this.tap());
      }
    };
    if (delay > 0) this.timer = this.env.after(delay, go);
    else go();
  }

  private bridge(from: "idle" | "act"): void {
    const bridge = BRIDGES[this.hero][from];
    const clip = CLIPS[this.hero][from];
    if (!bridge || !clip) return;
    const entries = bridge.frames / 2;
    const entry = bridge.entry ?? Math.floor((this.frameNow(clip) * entries) / clip.frames);
    this.cancelTimer();
    this.set({ mode: "bridge", bridgeEntry: entry, bridgeHalf: 0, bridgeFrom: from });
    this.timer = this.env.after(BRIDGE_FRAME_MS, () => {
      this.set({ mode: "bridge", bridgeEntry: entry, bridgeHalf: 1, bridgeFrom: from });
      this.timer = this.env.after(BRIDGE_FRAME_MS, () => this.start("select", 0));
    });
  }
}

/** Which Hero a tap selects, and which Heroes it sends back: exactly one Hero is chosen at a time. */
export function tapOrder(tapped: HangarHero, selected: readonly HangarHero[]): { release: HangarHero[]; tap: HangarHero } {
  if (selected.includes(tapped)) return { release: [], tap: tapped };
  return { release: selected.filter((hero) => hero !== tapped), tap: tapped };
}
