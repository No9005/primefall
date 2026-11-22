import { expect, test, type Page } from "@playwright/test";

// The Hero Select in the hangar between the start screen and the match (issue 318).

const next = (page: Page) => page.getByRole("button", { name: "NEXT" });

async function openHeroSelect(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("play-classic").click();
  await expect(page.getByTestId("hero-select")).toBeVisible();
}

test("NEXT waits until a Hero is selected; all three Heroes stand idle first", async ({ page }) => {
  await openHeroSelect(page);
  await expect(next(page)).toBeDisabled();
  for (const hero of ["bruiser", "controller", "assassin"]) await expect(page.getByTestId(`hero-${hero}`)).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("hero-controller").click();
  await expect(next(page)).toBeEnabled();
});

test("each Hero is named by its Hero Name and its class", async ({ page }) => {
  await openHeroSelect(page);
  await expect(page.getByTestId("hero-bruiser")).toHaveAccessibleName("Max Overload, Bruiser");
  await expect(page.getByTestId("hero-controller")).toHaveAccessibleName("Tilly Turnover, Controller");
  await expect(page.getByTestId("hero-assassin")).toHaveAccessibleName("Kit Crosshair, Assassin");
});

test("tapping another Hero moves the selection; tapping the selected Hero takes it back", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-bruiser").click();
  await page.getByTestId("hero-assassin").click();
  await expect(page.getByTestId("hero-bruiser")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("hero-assassin")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("hero-assassin").click();
  await expect(page.getByTestId("hero-assassin")).toHaveAttribute("aria-pressed", "false");
  await expect(next(page)).toBeDisabled();
});

test("the chosen Hero reaches the match", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-assassin").click();
  await next(page).click();
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
  // The match is saved with its Player Hero.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.playerHero"))).toBe("assassin");
});

test("Back leads to the start screen", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByRole("button", { name: "BACK" }).click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
});

test("with reduced motion the Hero Select works without animation errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHeroSelect(page);
  await page.getByTestId("hero-bruiser").click();
  await page.getByTestId("hero-controller").click();
  await expect(next(page)).toBeEnabled();
  await expect(page.getByTestId("hero-controller")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("hero-bruiser")).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});
