import { describe, expect, it } from "vitest";
import { LOCAL_HOST_BACKEND } from "./local-host";
import { SERVER_ENTRY } from "./server";

describe("game-core entry points", () => {
  it("lets the local host build on the server entry point", () => {
    expect(LOCAL_HOST_BACKEND).toBe(SERVER_ENTRY);
  });
});
