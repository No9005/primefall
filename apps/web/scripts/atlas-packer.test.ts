import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_ATLAS_SIDE, parseAtlas } from "../src/atlas";
import { BRIDGES, CLIPS, HANGAR_HEROES } from "../src/hangar-select";
import { ATLAS_FOLDER, atlasPaths, checkAtlases, decodePng, encodePng, HANGAR_FOLDER, type Image, jobsOf, packAtlas, packHero, STRIP_FOLDER, untrimFrame } from "./atlas-packer";

const strip = (file: string) => decodePng(readFileSync(path.join(STRIP_FOLDER, file)));

const pixel = (r: number, g: number, b: number, a: number) => [r, g, b, a];
function stripOf(frames: number[][][]): Image {
  // One 3 x 2 frame per entry: a list of its 6 pixels.
  const data = new Uint8Array(frames.length * 3 * 2 * 4);
  frames.forEach((frame, index) => frame.forEach((rgba, i) => data.set(rgba, ((Math.floor(i / 3) * frames.length * 3) + index * 3 + (i % 3)) * 4)));
  return { width: frames.length * 3, height: 2, data };
}

describe("atlas packer", () => {
  it("trims, dedupes and keeps every frame recoverable", () => {
    const clear = pixel(0, 0, 0, 0);
    const red = pixel(255, 0, 0, 255);
    const lone = [clear, red, clear, clear, clear, clear];
    const image = stripOf([lone, [clear, clear, clear, clear, clear, clear], lone]);
    const packed = packAtlas("max", [{ animation: "max.a", file: "x", frames: 3, durationMs: 300 }], () => image);
    const names = packed.data.animations["max.a"] as string[];
    expect(names[0]).toBe(names[2]);
    expect(Object.keys(packed.data.frames)).toHaveLength(2);
    const sheet = decodePng(packed.png);
    names.forEach((name, index) => {
      const whole = untrimFrame(sheet, packed.data.frames[name] as never);
      const original = Buffer.from(image.data.buffer).subarray(0);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) expect(Array.from(whole.data.subarray((y * 3 + x) * 4, (y * 3 + x) * 4 + 4))).toEqual(Array.from(original.subarray((y * image.width + index * 3 + x) * 4, (y * image.width + index * 3 + x) * 4 + 4)));
    });
  });

  it("round-trips a PNG", () => {
    const image: Image = { width: 2, height: 2, data: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) };
    expect(decodePng(encodePng(image))).toEqual(image);
  });

  it("is deterministic: the same strips give identical files", () => {
    const first = packHero("kit");
    const second = packHero("kit");
    expect(second.json).toBe(first.json);
    expect(second.png.equals(first.png)).toBe(true);
  });
});

describe("hangar atlases", () => {
  const atlas = (hero: (typeof HANGAR_HEROES)[number]) => parseAtlas(JSON.parse(readFileSync(atlasPaths(hero).json, "utf8")));

  it("match what the strips produce (check mode)", () => {
    expect(checkAtlases()).toEqual([]);
  });

  it("has every clip and bridge with the frame count and duration of the hangar's tables", () => {
    for (const hero of HANGAR_HEROES) {
      const { animations, meta } = atlas(hero);
      for (const [name, clip] of Object.entries(CLIPS[hero])) {
        expect(animations[`${hero}.${name}`], `${hero} ${name}`).toHaveLength(clip.frames);
        expect(meta.clips?.[`${hero}.${name}`]).toEqual({ frames: clip.frames, durationMs: Math.round(clip.seconds * 1000) });
      }
      for (const [name, bridge] of Object.entries(BRIDGES[hero])) {
        expect(animations[`${hero}.bridge.${name}`], `${hero} bridge ${name}`).toHaveLength(bridge.frames);
        expect(meta.clips?.[`${hero}.bridge.${name}`]?.frames).toBe(bridge.frames);
      }
      expect(Object.keys(animations)).toHaveLength(jobsOf(hero).length);
    }
  });

  it("holds every frame of every strip pixel for pixel after untrimming", () => {
    for (const hero of HANGAR_HEROES) {
      const { frames, animations } = atlas(hero);
      const sheet = decodePng(readFileSync(atlasPaths(hero).png));
      for (const job of jobsOf(hero)) {
        const source = strip(job.file);
        const width = source.width / job.frames;
        for (let index = 0; index < job.frames; index++) {
          const whole = untrimFrame(sheet, frames[(animations[job.animation] as string[])[index] as string] as never);
          const expected = new Uint8Array(width * source.height * 4);
          for (let y = 0; y < source.height; y++) expected.set(source.data.subarray((y * source.width + index * width) * 4, (y * source.width + (index + 1) * width) * 4), y * width * 4);
          expect(Buffer.from(whole.data).equals(Buffer.from(expected)), `${job.animation} frame ${index}`).toBe(true);
        }
      }
    }
  });

  it("is smaller in texture memory than the strips", () => {
    for (const hero of HANGAR_HEROES) {
      const files = new Set(jobsOf(hero).map((job) => job.file));
      const strips = [...files].reduce((sum, file) => sum + strip(file).width * strip(file).height * 4, 0);
      const page = atlas(hero).meta.size;
      expect(page.w * page.h * 4, hero).toBeLessThan(strips);
    }
  });

  it("has no atlas page larger than 4096 px on a side, anywhere in the assets", () => {
    const pngs: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".json") && full.includes(`${path.sep}atlas${path.sep}`)) pngs.push(full);
      }
    };
    walk(path.resolve(HANGAR_FOLDER, ".."));
    expect(pngs.length).toBeGreaterThanOrEqual(HANGAR_HEROES.length);
    for (const json of pngs) {
      const { meta } = parseAtlas(JSON.parse(readFileSync(json, "utf8")));
      const image = decodePng(readFileSync(path.join(path.dirname(json), meta.image)));
      expect(Math.max(image.width, image.height), json).toBeLessThanOrEqual(MAX_ATLAS_SIDE);
      expect([image.width, image.height]).toEqual([meta.size.w, meta.size.h]);
    }
  });
});

describe("atlas check mode", () => {
  // Works on a copy, so that parallel tests never see an edited atlas.
  const copy = mkdtempSync(path.join(tmpdir(), "atlas-"));
  const { json, png } = atlasPaths("max", copy);
  const original = { json: readFileSync(atlasPaths("max").json), png: readFileSync(atlasPaths("max").png) };
  beforeEach(() => {
    for (const hero of HANGAR_HEROES) {
      copyFileSync(atlasPaths(hero).json, atlasPaths(hero, copy).json);
      copyFileSync(atlasPaths(hero).png, atlasPaths(hero, copy).png);
    }
  });
  afterAll(() => rmSync(copy, { recursive: true, force: true }));

  it("passes on the committed output", () => {
    expect(checkAtlases(copy)).toEqual([]);
  });

  it("fails when an atlas JSON is edited", () => {
    writeFileSync(json, original.json.toString("utf8").replace('"durationMs":2000', '"durationMs":2100'));
    expect(checkAtlases(copy).join()).toContain("max.json");
  });

  it("fails when an atlas picture is edited", () => {
    const image = decodePng(original.png);
    image.data[0] = (image.data[0] as number) ^ 1;
    writeFileSync(png, encodePng(image));
    expect(checkAtlases(copy).join()).toContain("max.png");
  });

  it("keeps the committed files where the packer writes them", () => {
    expect(ATLAS_FOLDER).toContain(path.join("assets", "hangar", "atlas"));
  });
});
