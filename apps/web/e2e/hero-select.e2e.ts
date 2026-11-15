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

test("each Hero shows its Hero Name and its class", async ({ page }) => {
  await openHeroSelect(page);
  await expect(page.getByTestId("hero-bruiser")).toContainText("MAX OVERLOAD");
  await expect(page.getByTestId("hero-bruiser")).toContainText("BRUISER");
  await expect(page.getByTestId("hero-controller")).toContainText("TILLY TURNOVER");
  await expect(page.getByTestId("hero-assassin")).toContainText("KIT CROSSHAIR");
});

test("the BIO sheet shows the Hero Name, the class, the bio and the line of the selected Hero, and closes", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-controller").click();
  await page.getByRole("button", { name: "BIO" }).click();
  const sheet = page.getByTestId("bio-sheet");
  await expect(sheet).toContainText("TILLY TURNOVER");
  await expect(sheet).toContainText("CONTROLLER");
  await expect(sheet).toContainText("Mech mechanic and tinkerer.");
  await expect(sheet).toContainText("\u201cEverything is a spare part if you squint hard enough.\u201d");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
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
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
  // The match is saved with its Player Hero.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("primefall.playerHero"))).toBe("assassin");
});

test("Back leads to the start screen", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByRole("button", { name: "BACK" }).click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
});

test("CARDS lists the Deck of the selected Hero and closes", async ({ page }) => {
  await openHeroSelect(page);
  await page.getByTestId("hero-controller").click();
  await page.getByRole("button", { name: "CARDS" }).click();
  const list = page.getByTestId("card-list");
  await expect(list).toContainText("CONTROLLER: 10 CARDS");
  await expect(list).toContainText("Site Survey x2");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(list).toBeHidden();
});

test("the background grid patch drifts to the upper left, slowly", async ({ page }) => {
  await openHeroSelect(page);
  const drift = page.locator(".hs-drift");
  const first = await drift.boundingBox();
  await page.waitForTimeout(3000);
  const second = await drift.boundingBox();
  expect(first && second).toBeTruthy();
  expect(second!.x).toBeLessThan(first!.x);
  expect(second!.y).toBeLessThan(first!.y);
  const duration = await drift.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeGreaterThanOrEqual(90);
});

test("with reduced motion the drifting grid patch is not drawn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHeroSelect(page);
  expect(await page.locator(".hs-drift").boundingBox()).toBeNull();
});

for (const [button, testId] of [["BIO", "bio-sheet"], ["CARDS", "card-list"]] as const) {
  test(`the ${button} sheet lies over the title`, async ({ page }) => {
    await openHeroSelect(page);
    await page.getByTestId("hero-controller").click();
    await page.getByRole("button", { name: button }).click();
    const box = await page.locator(".hs-title").boundingBox();
    const overlayHit = await page.evaluate(
      ({ x, y, id }) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit?.closest(`[data-testid="${id}"]`);
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id: testId },
    );
    expect(overlayHit).toBe(true);
    // The title has pointer-events: none, so also compare the stacking orders.
    const [titleZ, overlayZ] = await page.evaluate((id) => {
      const z = (el: Element | null) => Number(getComputedStyle(el!).zIndex);
      return [z(document.querySelector(".hs-title")), z(document.querySelector(`[data-testid="${id}"]`))];
    }, testId);
    expect(overlayZ).toBeGreaterThan(titleZ);
  });
}

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
