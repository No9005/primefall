import { expect, test, type Page } from "@playwright/test";

// The Hero Select between the start screen and the match (issue 318).

const start = (page: Page) => page.getByRole("button", { name: "START" });

async function openHeroSelect(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("play-classic").click();
  await expect(page.getByTestId("hero-select")).toBeVisible();
}

test("Start is disabled until a Hero is selected; all three Heroes stand idle first", async ({ page }) => {
  await openHeroSelect(page);
  await expect(start(page)).toBeDisabled();
  await expect(page.getByTestId("hero-info")).toContainText("TAP A HERO");
  for (const hero of ["bruiser", "controller", "assassin"]) await expect(page.getByTestId(`hero-${hero}`)).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("hero-controller").click();
  await expect(start(page)).toBeEnabled();
  await expect(page.getByTestId("hero-info")).toContainText("Support.");
});

test("tapping another Hero moves the selection; tapping the selected Hero keeps it", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-bruiser").click();
  await page.getByTestId("hero-assassin").click();
  await expect(page.getByTestId("hero-bruiser")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("hero-assassin")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("hero-assassin").click();
  await expect(page.getByTestId("hero-assassin")).toHaveAttribute("aria-pressed", "true");
});

test("the chosen Hero reaches the match", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-assassin").click();
  await start(page).click();
  await expect(page.getByTestId("round")).toHaveText("ROUND 1");
  // The match is saved with its Player Hero.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.playerHero"))).toBe("assassin");
});

test("Back leads to the start screen", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByRole("button", { name: "BACK" }).click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
});

test("View cards lists the Deck of the selected Hero and closes", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-controller").click();
  await page.getByRole("button", { name: "VIEW CARDS" }).click();
  const list = page.getByTestId("card-list");
  await expect(list).toContainText("CONTROLLER: 12 CARDS");
  await expect(list).toContainText("Pulse Bolt x2");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(list).toBeHidden();
});

test("with reduced motion the Hero Select works without animation errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHeroSelect(page);
  await page.getByTestId("hero-bruiser").click();
  await page.getByTestId("hero-controller").click();
  await expect(start(page)).toBeEnabled();
  expect(errors).toEqual([]);
});
