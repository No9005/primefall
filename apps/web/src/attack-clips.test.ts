import { EventKind, HeroClass, type MatchEvent } from "game-core";
import { describe, expect, it } from "vitest";
import { ClipPlayer } from "./clip-player";
import { attackClipName, clipOf } from "./hero-clips";
import { buildPlaybackFrames, STEP_MS } from "./playback";

describe("the attack clips", () => {
  it("gives every card without a clip of its own the basic attack of its class", () => {
    expect(attackClipName("Concussion Round")).toBe("attack");
    expect(attackClipName("Ghost Shot")).toBe("attack");
    expect(attackClipName("Long Shot")).toBe("longShot");
    expect(attackClipName("Tag Round")).toBe("tagRound");
    expect(clipOf(HeroClass.Bruiser, "longShot")).toBe(clipOf(HeroClass.Bruiser, "attack"));
  });
});

describe("the ClipPlayer with attacks", () => {
  it("starts a delayed clip at its time, and again for the same clip in a new frame", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0, 1);
    const first = {};
    player.play("hit", 0, 1100, first);
    expect(player.playing).toBe("idle");
    player.update(1099);
    expect(player.playing).toBe("idle");
    player.play("hit", 1099, 1100, first);
    player.update(1100);
    expect(player.playing).toBe("hit");
    player.play("attack", 2000, 0, {});
    player.play("attack", 2000, 0, first);
    expect(player.playing).toBe("attack");
    expect(player.clipTimeMs(2624)).toBeCloseTo(624);
    // The same card in the next frame plays again from its start.
    player.play("attack", 5000, 0, {});
    expect(player.clipTimeMs(5624)).toBeCloseTo(624);
  });

  it("shortens the delay with the clip speed", () => {
    const player = new ClipPlayer(HeroClass.Bruiser, 0, 2);
    player.play("hit", 0, 1000);
    player.update(500);
    expect(player.playing).toBe("hit");
  });
});

describe("the playback of attacks", () => {
  const attack = (kind: EventKind, extra: Partial<MatchEvent> = {}): MatchEvent => ({ kind, tick: 1, heroId: "a", targetId: "t", ...extra });
  const classOf = (id: string) => (id === "a" ? HeroClass.Assassin : HeroClass.Bruiser);

  it("plays the attacker's clip by card and the target's Hit at the impact beat", () => {
    const [frame] = buildPlaybackFrames([attack(EventKind.AttackHit, { card: "Long Shot", damage: 2 })], classOf);
    expect(frame!.clips).toEqual({ a: "longShot", t: "hit" });
    // The Long Shot has no flight: the impact is at the fire beat.
    expect(frame!.delays).toEqual({ t: 1650 });
    // The Tick lasts until the slowest clip has reached its active end: the Hit ends 1350 ms after the impact (3000),
    // the Long Shot stands up again at 3170.
    expect(frame!.holdMs).toBe(3170);
  });

  it("shows the absorb reaction when the Shield took the whole damage, and the Hit otherwise", () => {
    const [absorbed] = buildPlaybackFrames([attack(EventKind.AttackHit, { damage: 0, absorbed: 2 })], classOf);
    expect(absorbed!.clips.t).toBe("absorb");
    const [partly] = buildPlaybackFrames([attack(EventKind.AttackHit, { damage: 1, absorbed: 1 })], classOf);
    expect(partly!.clips.t).toBe("hit");
  });

  it("plays the attacker's clip and nothing on the target for a failed Attack", () => {
    const [frame] = buildPlaybackFrames([attack(EventKind.AttackFailed)], classOf);
    expect(frame!.clips).toEqual({ a: "attack" });
    expect(frame!.holdMs).toBe(1450);
  });

  it("plays Block for a Shield without a card, and not for the Shield of a card", () => {
    const [block] = buildPlaybackFrames([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2 }], classOf);
    expect(block!.clips).toEqual({ a: "block" });
    expect(block!.holdMs).toBe(2900);
    const [bulwark] = buildPlaybackFrames([{ kind: EventKind.ShieldGained, tick: 1, heroId: "a", amount: 2, card: "Bulwark" }], classOf);
    expect(bulwark!.clips).toEqual({});
  });

  it("keeps one step for a frame with only steps, whatever the classes", () => {
    const [frame] = buildPlaybackFrames([{ kind: EventKind.Step, tick: 1, heroId: "a", to: { col: 1, row: 0 } }], classOf);
    expect(frame!.holdMs).toBe(STEP_MS);
  });
});
