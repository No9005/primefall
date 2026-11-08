import { expect, test, type Page } from "@playwright/test";
import { startMatch } from "./start-match";

// Measures the real DOM: no two visible HUD elements may intersect (issue 266). The constants-based test in
// src/hud-layout.test.ts missed the Wait card over Commit, so this one reads getBoundingClientRect.

const VIEWS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 932, height: 430 },
];

const HUD_SELECTORS = {
  "resolution bar": ".resolution-bar",
  "Prime Zone pill": ".prime-pill",
  "timer pill": ".timer-pill",
  commentary: ".commentary",
  piles: ".piles",
  "Energy pill": ".energy-row",
  Hand: ".hand",
  "Wait card": ".wait-card",
  Queue: ".queue",
  Commit: ".commit",
};

interface Box {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

async function hudBoxes(page: Page): Promise<Box[]> {
  return page.evaluate((selectors) => {
    const boxes: Box[] = [];
    for (const [name, selector] of Object.entries(selectors)) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) boxes.push({ name, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    }
    return boxes;
  }, HUD_SELECTORS);
}

/** The pairs of HUD elements that intersect (touching edges are fine). */
function intersections(boxes: Box[]): string[] {
  const found: string[] = [];
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => {
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) found.push(`${a.name} intersects ${b.name}`);
    }),
  );
  return found;
}

for (const view of VIEWS) {
  test(`no HUD elements overlap at ${view.width} x ${view.height}`, async ({ page }) => {
    await page.setViewportSize(view);
    await page.goto("/?prime=contested");
    await startMatch(page);
    await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
    await expect(page.getByRole("list", { name: "Hand" }).getByRole("button").last()).toBeEnabled();
    await expect(page.getByTestId("prime-progress")).toBeVisible();

    expect(intersections(await hudBoxes(page)), "Planning").toEqual([]);

    // Fill the Queue with Wait actions: the fullest Queue column.
    const wait = page.locator(".wait-card");
    while (await wait.isEnabled()) await wait.click();
    expect(intersections(await hudBoxes(page)), "Planning with a full Queue").toEqual([]);

    await page.getByRole("button", { name: "Commit" }).click();
    await expect(page.getByTestId("resolution-bar")).toBeVisible();
    expect(intersections(await hudBoxes(page)), "RESOLUTION callout").toEqual([]);

    // Mid-Resolution: the commentary is shown.
    await expect(page.getByTestId("commentary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("resolution-bar")).toContainText(/TICK \d \/ \d/);
    expect(intersections(await hudBoxes(page)), "during the Ticks").toEqual([]);
  });
}
