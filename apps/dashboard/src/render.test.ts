import { describe, expect, it } from "vitest";
import { fixtureStatus } from "./fixture.ts";
import { formatAge, renderError, renderStatus } from "./render.ts";

const NOW = "2026-11-03T12:05:00Z";

describe("renderStatus", () => {
  it("renders the five blocks in order", () => {
    const html = renderStatus(fixtureStatus(), NOW);
    const ids = [...html.matchAll(/<section id="(\w+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["up", "running", "waiting", "triage", "done"]);
    expect(html).toContain("ready to merge");
    expect(html).toContain("Data is 5 min old");
    expect(html).toContain("held by");
  });

  it("escapes titles", () => {
    const status = fixtureStatus();
    status.doneToday[0]!.title = "<script>alert(1)</script>";
    expect(renderStatus(status, NOW)).not.toContain("<script>");
  });

  it("shows the hint when the token is missing", () => {
    const status = { ...fixtureStatus(), tokenMissing: true };
    expect(renderStatus(status, NOW)).toContain("No GITHUB_TOKEN");
  });
});

describe("renderError", () => {
  it("shows an error state", () => {
    expect(renderError("the function answered 502")).toContain("could not be loaded");
  });
});

describe("formatAge", () => {
  it("uses minutes, hours and days", () => {
    expect([formatAge(5), formatAge(120), formatAge(3000)]).toEqual(["5 min", "2 h", "2 d"]);
  });
});
