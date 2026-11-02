import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const github = path.join(import.meta.dirname, "..", "..", "..", ".github");

function yamlFiles(): string[] {
  const workflows = readdirSync(path.join(github, "workflows")).map((name) => path.join(github, "workflows", name));
  const actions = readdirSync(path.join(github, "actions")).map((name) => path.join(github, "actions", name, "action.yml"));
  return [...workflows, ...actions];
}

describe("workflow files", () => {
  // In YAML a ` #` inside a one-line plain scalar starts a comment, so `run: node x "Review #7"` is cut off after
  // `"Review` and the step fails with a shell syntax error (this broke the factory once). Use a block scalar (`run: |`).
  it.each(yamlFiles())("has no one-line run command that contains ' #': %s", (file) => {
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => /^\s*(- )?run: [^|>].* #/.test(line));
    expect(offenders).toEqual([]);
  });
});
