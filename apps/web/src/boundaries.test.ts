import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

async function lint(filePath: string, code: string) {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  return result?.messages.map((m) => m.message) ?? [];
}

describe("package boundaries (ADR 0017)", () => {
  it("forbids apps/web from importing the server entry point", async () => {
    const messages = await lint("apps/web/src/leak.ts", 'import { SERVER_ENTRY } from "game-core/server";\nconsole.log(SERVER_ENTRY);\n');
    expect(messages.some((m) => m.includes("must not import the server entry point"))).toBe(true);
  });

  it("allows apps/web to import the shared and local-host entry points", async () => {
    const messages = await lint("apps/web/src/ok.ts", 'import { GAME_NAME } from "game-core";\nimport { LOCAL_HOST_ENTRY } from "game-core/local-host";\nconsole.log(GAME_NAME, LOCAL_HOST_ENTRY);\n');
    expect(messages).toEqual([]);
  });

  it("forbids browser APIs and Math.random inside game-core", async () => {
    const messages = await lint("packages/game-core/src/bad.ts", "export const a = window.innerWidth;\nexport const b = Math.random();\n");
    expect(messages.some((m) => m.includes("browser APIs"))).toBe(true);
    expect(messages.some((m) => m.includes("seeded PRNG"))).toBe(true);
  });
});
