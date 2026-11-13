import { expect, test, type Page } from "@playwright/test";

// "Play again" on the end screen opens the Hero Select of the same mode (issue 414).

/** Saves a finished match: the running match's snapshot gets a result, and Resume shows the end screen. */
async function resumeFinishedMatch(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.match"))).not.toBeNull();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("primefall.match") ?? "");
    saved.match.result = { winner: "left", reason: "allHeroesExhausted", round: saved.match.round, deckTotals: { left: 10, right: 0 } };
    localStorage.setItem("primefall.match", JSON.stringify(saved));
  });
  await page.reload();
  await page.getByTestId("resume").click();
  await expect(page.getByTestId("end-screen")).toBeVisible();
}

test("Play again opens the Hero Select; the next match uses the new Hero; Back leads to the start screen", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("play-classic").click();
  await page.getByTestId("hero-bruiser").click();
  await page.getByRole("button", { name: "START" }).click();
  await resumeFinishedMatch(page);

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("hero-select")).toBeVisible();
  await page.getByRole("button", { name: "BACK" }).click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.getByTestId("resume")).toHaveCount(0);

  await page.getByTestId("play-classic").click();
  await page.getByTestId("hero-assassin").click();
  await page.getByRole("button", { name: "START" }).click();
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.playerHero"))).toBe("assassin");
});

test("in Attack and Defend, Play again opens the Hero Select of the same role", async ({ page }) => {
  await page.goto("/?role=attack&hero=bruiser");
  await page.getByTestId("play-attack-defend").click();
  await resumeFinishedMatch(page);

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("hero-select")).toBeVisible();
  await page.getByTestId("hero-controller").click();
  await page.getByRole("button", { name: "START" }).click();
  await expect(page.getByTestId("round")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.playerHero"))).toBe("controller");
});
