import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRIDGES, CLIPS, HANGAR_HEROES } from "./hangar-select";
import { BRIDGE_SHADOWS, STILL_SHADOWS } from "./hangar-shadows";

const keyframes = readFileSync(new URL("./hangar-shadows.css", import.meta.url), "utf8");
const block = (name: string) => keyframes.slice(keyframes.indexOf(`@keyframes ${name} {`), keyframes.indexOf("\n}", keyframes.indexOf(`@keyframes ${name} {`)));

describe("contact shadows of the Heroes", () => {
  it("has keyframes for every clip and a spot for every frame of every bridge", () => {
    for (const hero of HANGAR_HEROES) {
      for (const clip of Object.keys(CLIPS[hero])) expect(keyframes, `${hero} ${clip}`).toContain(`@keyframes hg-shadow-${hero}-${clip} {`);
      for (const [source, bridge] of Object.entries(BRIDGES[hero])) expect(BRIDGE_SHADOWS[`${hero}-${source}`]?.length, `${hero} bridge ${source}`).toBe(bridge.frames);
    }
  });

  it("puts Kit's shadow on the crate while he sits, takes it away while he jumps and puts it on the floor when his feet are down", () => {
    const select = block("hg-shadow-kit-select");
    const lines = select.split("\n").filter((line) => line.includes("%"));
    expect(lines[0]).toContain("opacity: 1");
    const seated = lines[0]!.match(/top: ([\d.]+)px/)![1]!;
    expect(lines[1]).toContain("opacity: 0");
    const landed = lines[2]!.match(/top: ([\d.]+)px/)![1]!;
    expect(Number(landed)).toBeGreaterThan(Number(seated) + 50);
    const back = block("hg-shadow-kit-desel").split("\n").filter((line) => line.includes("%"));
    expect(back.some((line) => line.includes("opacity: 0"))).toBe(true);
    expect(back[back.length - 1]).toContain(`top: ${seated}px`);
  });

  it("shows Kit's still shadow on the crate when idle and on the floor when chosen", () => {
    const idle = STILL_SHADOWS["kit-idle"]!;
    const hold = STILL_SHADOWS["kit-hold"]!;
    expect(hold[1]).toBeGreaterThan(idle[1] + 50);
    for (const key of ["max-idle", "tilly-idle", "max-hold", "tilly-hold"]) expect(STILL_SHADOWS[key], key).toBeTruthy();
  });
});
