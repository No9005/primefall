import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGES, CLIPS, FRAME, HANGAR_HEROES, type HangarHero, HangarHeroes, HeroPlayer, IDLE_LOOPS, isLooped, type PlayerEnv, RIG_HEROES, tapOrder } from "./hangar-select";

/** A clock the tests move by hand: timers run when the time reaches them. */
function fakeEnv(random: PlayerEnv["random"] = (low) => low): PlayerEnv & { advance: (ms: number) => void } {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => now,
    after: (ms, run) => {
      timers.set(next, { at: now + ms, run });
      return next++;
    },
    cancel: (handle) => void timers.delete(handle as number),
    random,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = target;
    },
  };
}

const png = (path: string) => readFileSync(new URL(`../../../archive/hangar/${path}`, import.meta.url));
const size = (file: Buffer) => ({ width: file.readUInt32BE(16), height: file.readUInt32BE(20) });

describe("hangar Hero Select: the strips", () => {
  it("has a strip of the right size for every clip and bridge", () => {
    for (const hero of HANGAR_HEROES.filter((name) => !RIG_HEROES.includes(name))) {
      const frame = FRAME[hero];
      for (const [name, clip] of Object.entries(CLIPS[hero])) {
        const { width, height } = size(png(`strips/${clip.file}`));
        // The sheets were drawn at 2.54 times the size of the design frame: width and height are in the same ratio for every clip.
        expect(width / clip.frames / (height / frame.height), `${hero} ${name}`).toBeCloseTo(frame.width, 0);
      }
      for (const [name, bridge] of Object.entries(BRIDGES[hero])) {
        const { width, height } = size(png(`strips/${bridge.file}`));
        expect(width / bridge.frames / (height / frame.height), `${hero} bridge ${name}`).toBeCloseTo(frame.width, 0);
      }
    }
  });

  it("loops the idle, the action and the ready pose, and plays the others once", () => {
    expect(["idle", "act", "hold"].every((name) => isLooped(name as "idle"))).toBe(true);
    expect(["tolift", "toidle", "selecti", "select", "desel"].some((name) => isLooped(name as "idle"))).toBe(false);
  });
});

describe("hangar Hero Select: a Hero", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const player = (hero: HangarHero, env = fakeEnv()) => {
    const changes: string[] = [];
    const made = new HeroPlayer(hero, env, () => changes.push(made.state.mode));
    return { made, env, changes };
  };

  it("idles, lifts into its action, acts and drops back (Max and Tilly), and Kit goes straight into the action", () => {
    const { made, env } = player("max");
    made.begin(0);
    expect(made.state.mode).toBe("idle");
    env.advance(CLIPS.max.idle!.seconds * 1000 * IDLE_LOOPS.max[0]);
    expect(made.state.mode).toBe("tolift");
    env.advance(CLIPS.max.tolift!.seconds * 1000);
    expect(made.state.mode).toBe("act");
    env.advance(CLIPS.max.act!.seconds * 1000);
    expect(made.state.mode).toBe("toidle");
    const kit = player("kit");
    kit.made.begin(0);
    kit.env.advance(CLIPS.kit.idle!.seconds * 1000 * IDLE_LOOPS.kit[0]);
    expect(kit.made.state.mode).toBe("act");
  });

  it("announces every clip as it begins", () => {
    const heard: string[] = [];
    const env = fakeEnv();
    const made = new HeroPlayer("tilly", env, () => undefined, (hero, clip) => heard.push(`${hero}:${clip}`));
    made.begin(0);
    env.advance(CLIPS.tilly.idle!.seconds * 1000 * IDLE_LOOPS.tilly[0] + CLIPS.tilly.tolift!.seconds * 1000 + CLIPS.tilly.act!.seconds * 1000);
    expect(heard).toEqual(["tilly:idle", "tilly:tolift", "tilly:act", "tilly:toidle"]);
  });

  it("plays every action once, after an idle of several loops that differs for each Hero, so that an animation never comes twice in a row", () => {
    const ranges = HANGAR_HEROES.map((hero) => IDLE_LOOPS[hero]);
    for (const [fewest, most] of ranges) {
      expect(fewest).toBeGreaterThanOrEqual(2);
      expect(most).toBeGreaterThan(fewest);
    }
    expect(new Set(ranges.map((range) => range.join("-"))).size).toBe(HANGAR_HEROES.length);
    for (const hero of HANGAR_HEROES) {
      for (const loops of IDLE_LOOPS[hero]) {
        const idleMs = CLIPS[hero].idle!.seconds * 1000;
        const env = fakeEnv((low, high) => (high === IDLE_LOOPS[hero][1] ? loops : low));
        const made = new HeroPlayer(hero, env, () => undefined);
        made.begin(0);
        env.advance(idleMs * loops - 1);
        expect(made.state.mode, `${hero} idles for ${loops} loops`).toBe("idle");
        env.advance(1 + (CLIPS[hero].tolift?.seconds ?? 0) * 1000);
        expect(made.state.mode).toBe("act");
        env.advance(CLIPS[hero].act!.seconds * 1000);
        expect(made.state.mode, `${hero}'s action plays once`).not.toBe("act");
      }
    }
  });

  /** A repeatable pseudo-random source for the simulations. */
  const seeded = (seed: number) => {
    let state = seed;
    return (low: number, high: number) => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return low + Math.floor((state / 4294967296) * (high - low + 1));
    };
  };

  it("never has two Heroes in their action together, and every Hero still acts now and then (twenty minutes, several seeds)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const acted = new Set<string>();
      const heroes = new HangarHeroes(() => undefined, false, seeded(seed), (hero, clip) => void (clip === "act" && acted.add(hero)));
      heroes.start();
      for (let step = 0; step < 12_000; step++) {
        heroes.advance(100);
        const busy = HANGAR_HEROES.filter((hero) => ["tolift", "act", "toidle"].includes(heroes.players[hero].state.mode));
        expect(busy.length, `seed ${seed}, ${step * 100} ms`).toBeLessThanOrEqual(1);
      }
      expect([...acted].sort()).toEqual([...HANGAR_HEROES].sort());
    }
  });

  it("lets the other Heroes only idle, and make no sound, while one is chosen", () => {
    const heard: string[] = [];
    const heroes = new HangarHeroes(() => undefined, false, seeded(7), (hero, clip) => heard.push(`${hero}:${clip}`));
    heroes.start();
    heroes.advance(30_000);
    heroes.tap("max");
    heard.length = 0;
    heroes.advance(CLIPS.max.selecti!.seconds * 1000 + 6000); // whoever was acting has finished
    heard.length = 0;
    for (let step = 0; step < 6000; step++) {
      heroes.advance(100);
      for (const hero of ["tilly", "kit"] as const) expect(heroes.players[hero].state.mode, `${hero} at ${step * 100} ms`).toBe("idle");
    }
    expect(heard.filter((entry) => !entry.startsWith("max:"))).toEqual([]);
    // The choice is taken back: the others may act again.
    heroes.tap("max");
    heroes.advance(CLIPS.max.desel!.seconds * 1000);
    const acted = new Set<string>();
    const watch = new HangarHeroes(() => undefined, false, seeded(7), (hero, clip) => void (clip === "act" && acted.add(hero)));
    watch.start();
    watch.advance(200_000);
    expect(acted.size).toBe(HANGAR_HEROES.length);
  });

  it("begins after its delay, so that the three are not in step", () => {
    const { made, env } = player("tilly");
    made.begin(1400);
    expect(made.state.mode).toBe("idle");
    env.advance(1399);
    expect(made.state.mode).toBe("idle");
  });

  it("is selected from the idle pose through the select-in clip into the ready pose", () => {
    const { made, env } = player("max");
    made.begin(0);
    made.tap();
    expect(made.state.mode).toBe("selecti");
    expect(made.selected).toBe(true);
    env.advance(CLIPS.max.selecti!.seconds * 1000);
    expect(made.state.mode).toBe("hold");
    expect(made.selected).toBe(true);
  });

  it("is selected in the middle of its action through a bridge of two frames", () => {
    const { made, env } = player("tilly");
    made.begin(0);
    env.advance(CLIPS.tilly.idle!.seconds * 1000 * IDLE_LOOPS.tilly[0] + CLIPS.tilly.tolift!.seconds * 1000);
    expect(made.state.mode).toBe("act");
    env.advance(1000);
    made.tap();
    expect(made.state.mode).toBe("bridge");
    expect(made.state.bridgeHalf).toBe(0);
    const entries = BRIDGES.tilly.act!.frames / 2;
    expect(made.state.bridgeEntry).toBeGreaterThanOrEqual(0);
    expect(made.state.bridgeEntry).toBeLessThan(entries);
    env.advance(85);
    expect(made.state.bridgeHalf).toBe(1);
    env.advance(85);
    expect(made.state.mode).toBe("select");
    env.advance(CLIPS.tilly.select!.seconds * 1000);
    expect(made.state.mode).toBe("hold");
  });

  it("waits for the end of a lift or a drop before it takes a tap", () => {
    const { made, env } = player("max");
    made.begin(0);
    env.advance(CLIPS.max.idle!.seconds * 1000 * IDLE_LOOPS.max[0]);
    expect(made.state.mode).toBe("tolift");
    made.tap();
    expect(made.state.mode).toBe("tolift");
    env.advance(CLIPS.max.tolift!.seconds * 1000);
    env.advance(0);
    expect(made.state.mode).toBe("bridge");
  });

  it("takes the selection back with a tap, and selects again with a tap during the way back", () => {
    const { made, env } = player("kit");
    made.beginSelected();
    expect(made.state.mode).toBe("hold");
    made.tap();
    expect(made.state.mode).toBe("desel");
    expect(made.selected).toBe(false);
    env.advance(100);
    made.tap();
    expect(made.state.mode).toBe("select");
    expect(made.selected).toBe(true);
    made.tap();
    env.advance(CLIPS.kit.desel!.seconds * 1000);
    expect(made.state.mode).toBe("idle");
  });

  it("takes the selection back at once while it is still on its way into the ready pose", () => {
    const { made } = player("max");
    made.begin(0);
    made.tap();
    expect(made.state.mode).toBe("selecti");
    made.tap();
    expect(made.state.mode).toBe("desel");
    expect(made.selected).toBe(false);
  });

  it("keeps a tap during its bridge and takes the selection back when the ready pose begins; shows a still pose without motion", () => {
    const { made, env } = player("kit");
    made.begin(0);
    made.tap();
    expect(made.state.mode).toBe("bridge");
    made.tap();
    expect(made.state.mode).toBe("bridge");
    // The two frames take 170 ms; the ready pose begins and the kept tap takes it back in the same moment.
    env.advance(170);
    expect(made.state.mode).toBe("desel");
    expect(made.selected).toBe(false);
    made.setStill(true);
    expect(made.state.mode).toBe("hold");
    env.advance(60_000);
    expect(made.state.mode).toBe("hold");
    made.setStill(false);
    expect(made.state.mode).toBe("idle");
  });

  it("stops telling the screen after it is disposed", () => {
    const { made, env, changes } = player("max");
    made.begin(0);
    const before = changes.length;
    made.dispose();
    env.advance(60_000);
    expect(changes.length).toBe(before);
  });
});

describe("hangar Hero Select: one Hero at a time", () => {
  it("sends the chosen Hero back when another is tapped, and only takes a tapped chosen Hero back itself", () => {
    expect(tapOrder("tilly", ["max"])).toEqual({ release: ["max"], tap: "tilly" });
    expect(tapOrder("max", ["max"])).toEqual({ release: [], tap: "max" });
    expect(tapOrder("kit", [])).toEqual({ release: [], tap: "kit" });
  });
});
