import { readFileSync } from "node:fs";

// A small tolerant CSS reader for the tests that check the style sheets (text-legibility.test.ts, touch-targets.test.ts):
// rule blocks with their declarations, @media flattened, @keyframes skipped. Not a general CSS parser.

export interface Rule {
  selectors: string[];
  decls: Map<string, string>;
}

function parseDecls(body: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const part of body.split(";")) {
    const colon = part.indexOf(":");
    if (colon > 0) decls.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return decls;
}

export function parseRules(css: string): Rule[] {
  const found: Rule[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const header = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (depth > 0 && j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (header.startsWith("@media")) found.push(...parseRules(body));
    else if (!header.startsWith("@")) found.push({ selectors: header.split(",").map((s) => s.trim().replace(/\s+/g, " ")), decls: parseDecls(body) });
    i = j;
  }
  return found;
}

/** A source file next to the tests, as text. */
export const readSource = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

/** The rules of the given style sheets, comments removed. */
export function loadRules(files: string[]): Rule[] {
  return files.flatMap((file) => parseRules(readSource(file).replace(/\/\*[\s\S]*?\*\//g, "")));
}
