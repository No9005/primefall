import { describe, expect, it } from "vitest";
import { describeRules, GAME_NAME } from "./index";
import { LOCAL_HOST_BACKEND } from "./local-host";
import { SERVER_ENTRY } from "./server";

describe("game-core entry points", () => {
  it("describes the rules package from the shared entry point", () => {
    expect(describeRules()).toContain(GAME_NAME);
  });

  it("lets the local host build on the server entry point", () => {
    expect(LOCAL_HOST_BACKEND).toBe(SERVER_ENTRY);
  });
});
