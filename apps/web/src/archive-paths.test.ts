import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Agents and tools find the archive (sources the game does not load, see archive/README.md) by the paths that documents, skills and code
// name. A path that points nowhere sends an agent searching, and the old root folder `audio-source/` must not come back.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCANNED = [".claude", "docs", "apps/web/src", "apps/web/scripts", "apps/web/public/assets", "archive/README.md", "CLAUDE.md"];
const TEXT = /\.(md|ts|tsx|json|mjs|js|py|sh)$/;
// Generated or very large folders that name no paths a reader follows.
const SKIP = new Set(["node_modules", "dist", "overview", "ids", "plans", "layers", "stems", "pieces", "midi-layers"]);

function textFiles(entry: string): string[] {
  const full = path.join(ROOT, entry);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [entry];
  return readdirSync(full, { withFileTypes: true }).flatMap((child) => {
    if (SKIP.has(child.name)) return [];
    const relative = path.posix.join(entry, child.name);
    if (child.isDirectory()) return textFiles(relative);
    return TEXT.test(child.name) ? [relative] : [];
  });
}

const files = SCANNED.flatMap(textFiles);
const mentions = files.flatMap((file) => {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  return [...text.matchAll(/(?<![\w/.-])archive\/[\w./*<>-]+/g)].map((match) => ({ file, mentioned: match[0].replace(/[.,;:)]+$/, "") }));
});

describe("paths into the archive", () => {
  it("scans documents, skills and code", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(mentions.length).toBeGreaterThan(10);
  });

  it("all name something that exists", () => {
    const missing = mentions.filter(({ mentioned }) => !mentioned.includes("<") && !mentioned.includes("*") && !existsSync(path.join(ROOT, mentioned)));
    expect(missing.map(({ file, mentioned }) => `${file}: ${mentioned}`)).toEqual([]);
  });

  it("do not use the old root folder audio-source/", () => {
    // The archive's own README lists its folders by their names inside it, and this file names the pattern.
    const exempt = new Set(["archive/README.md", "apps/web/src/archive-paths.test.ts"]);
    const old = files.filter((file) => !exempt.has(file) && /(?<![\w/-])audio-source\//.test(readFileSync(path.join(ROOT, file), "utf8")));
    expect(old).toEqual([]);
  });
});
