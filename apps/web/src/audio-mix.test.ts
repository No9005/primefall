import { describe, expect, it } from "vitest";
import { CUE_PRIORITY, distanceGain, FAR_GAIN, Priority, pickVariant, SfxLimiter, VoiceDirector, type VoiceRequest } from "./audio-mix";

const line = (heroId: string, startMs: number, patch: Partial<VoiceRequest> = {}): VoiceRequest => ({
  heroId,
  tile: { col: 5, row: 5 },
  startMs,
  durationMs: 1000,
  priority: Priority.Normal,
  ...patch,
});

describe("importance of the sounds", () => {
  it("gives a hit and the end of a match more weight than a step", () => {
    expect(CUE_PRIORITY.attackHit.sfx).toBeGreaterThan(CUE_PRIORITY.step.sfx);
    expect(CUE_PRIORITY.matchEnd.voice).toBe(Priority.Critical);
    expect(CUE_PRIORITY.exhausted.voice).toBe(Priority.Critical);
    expect(CUE_PRIORITY.cardPitched.voice).toBe(Priority.Ambient);
  });
});

describe("a Hero's voice", () => {
  it("does not speak again before its cooldown is over", () => {
    const director = new VoiceDirector();
    expect(director.request(line("kit", 0)).play).toBe(true);
    // The line ends at 1000 ms; the Hero is silent until 5000 ms.
    expect(director.request(line("kit", 3000)).play).toBe(false);
    expect(director.request(line("kit", 4900)).play).toBe(false);
    expect(director.request(line("kit", 5100)).play).toBe(true);
  });

  it("is not held up by the cooldown of another Hero", () => {
    const director = new VoiceDirector();
    director.request(line("kit", 0));
    expect(director.request(line("max", 1500)).play).toBe(true);
  });

  it("breaks the cooldown for a line that is far more important, or critical", () => {
    const director = new VoiceDirector();
    director.request(line("kit", 0, { priority: Priority.Minor }));
    expect(director.request(line("kit", 2000, { priority: Priority.Normal })).play).toBe(false);
    expect(director.request(line("kit", 2000, { priority: Priority.Important })).play).toBe(true);
    const next = new VoiceDirector();
    next.request(line("kit", 0, { priority: Priority.Important }));
    expect(next.request(line("kit", 2000, { priority: Priority.Critical })).play).toBe(true);
  });

  it("speaks one line at a time: a more important line cuts the one that runs, a weaker one is dropped", () => {
    const director = new VoiceDirector();
    const first = director.request(line("kit", 0, { durationMs: 3000, priority: Priority.Normal }));
    expect(director.request(line("kit", 500, { priority: Priority.Normal })).play).toBe(false);
    const cutting = director.request(line("kit", 500, { priority: Priority.Critical }));
    expect(cutting.play).toBe(true);
    expect(cutting.cut).toEqual([first.id]);
  });

  it("lets at most two Heroes speak at once near each other", () => {
    const director = new VoiceDirector();
    expect(director.request(line("kit", 0)).play).toBe(true);
    expect(director.request(line("max", 100)).play).toBe(true);
    expect(director.request(line("tilly", 200)).play).toBe(false);
  });

  it("makes room for a more important line by cutting the quietest near speaker", () => {
    const director = new VoiceDirector();
    director.request(line("kit", 0, { priority: Priority.Important }));
    const quiet = director.request(line("max", 100, { priority: Priority.Minor }));
    const decision = director.request(line("tilly", 200, { priority: Priority.Important }));
    expect(decision.play).toBe(true);
    expect(decision.cut).toEqual([quiet.id]);
  });

  it("does not count Heroes that are far apart", () => {
    const director = new VoiceDirector();
    director.request(line("kit", 0, { tile: { col: 0, row: 0 } }));
    director.request(line("max", 0, { tile: { col: 1, row: 0 } }));
    expect(director.request(line("tilly", 100, { tile: { col: 12, row: 0 } })).play).toBe(true);
  });

  it("counts a line only while it runs", () => {
    const director = new VoiceDirector();
    director.request(line("kit", 0));
    director.request(line("max", 0));
    expect(director.request(line("tilly", 1500)).play).toBe(true);
  });
});

describe("the effects", () => {
  const effect = (assetId: string, startMs: number, priority: number) => ({ assetId, startMs, durationMs: 500, priority });

  it("does not start the same effect twice at the same instant", () => {
    const limiter = new SfxLimiter();
    expect(limiter.request(effect("step-1", 0, Priority.Ambient)).play).toBe(true);
    expect(limiter.request(effect("step-1", 30, Priority.Ambient)).play).toBe(false);
    expect(limiter.request(effect("step-1", 120, Priority.Ambient)).play).toBe(true);
  });

  it("keeps the important effects when the mix is full", () => {
    const limiter = new SfxLimiter({ maxAtOnce: 2, minRepeatMs: 0 });
    const step = limiter.request(effect("step", 0, Priority.Ambient));
    limiter.request(effect("cover", 0, Priority.Minor));
    expect(limiter.request(effect("brush", 100, Priority.Ambient)).play).toBe(false);
    const hit = limiter.request(effect("hit", 100, Priority.Important));
    expect(hit.play).toBe(true);
    expect(hit.cut).toEqual([step.id]);
  });
});

describe("variants and distance", () => {
  it("never picks the same variant twice in a row", () => {
    const variants = ["a", "b", "c"];
    let last: string | undefined;
    for (let step = 0; step < 50; step += 1) {
      const next = pickVariant(variants, last, () => (step % 7) / 7);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it("plays the only variant again", () => {
    expect(pickVariant(["a"], "a", () => 0.5)).toBe("a");
  });

  it("is loud near the player and quiet but audible far away", () => {
    const player = { col: 0, row: 0 };
    expect(distanceGain(player, { col: 3, row: 2 })).toBe(1);
    expect(distanceGain(player, { col: 9, row: 0 })).toBeGreaterThan(FAR_GAIN);
    expect(distanceGain(player, { col: 9, row: 0 })).toBeLessThan(1);
    expect(distanceGain(player, { col: 30, row: 0 })).toBe(FAR_GAIN);
  });
});
