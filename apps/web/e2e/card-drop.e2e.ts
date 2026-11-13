import { expect, test, type Locator, type Page } from "@playwright/test";
import { startMatch } from "./start-match";

// Dropping a pulled card (issue 410): a release over the Energy pill, a highlighted tile or an enemy Hero uses the
// card there, next to the faces of the card pull (card-pull.e2e.ts).

const faces = (page: Page) => page.getByRole("group", { name: "Use card as" });
const removeButtons = (page: Page) => page.getByRole("region", { name: "Queue" }).getByRole("button", { name: /^Remove action/ });

async function startPlanning(page: Page) {
  // The match seed is the first Date.now() of the page. Seed 6 deals the Bruiser Bulwark (no tile target) first, so
  // the only lit tiles are those of Move 2 around the Hero.
  await page.addInitScript(() => {
    const realNow = Date.now;
    let first = true;
    Date.now = () => (first ? ((first = false), 6) : realNow());
  });
  await page.goto("/");
  await startMatch(page);
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
  const hand = page.getByRole("list", { name: "Hand" });
  await expect(hand.getByRole("button").last()).toBeEnabled();
  await page.waitForTimeout(1500); // the draw animation
  return hand;
}

async function pull(page: Page, hand: Locator, to: { x: number; y: number }) {
  const box = (await hand.boundingBox())!;
  const from = { x: box.x + box.width * 0.08, y: box.y + 30 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) await page.mouse.move(from.x + ((to.x - from.x) * step) / 4, from.y + ((to.y - from.y) * step) / 4);
  await page.mouse.up();
}

test.use({ viewport: { width: 844, height: 390 } });

test("a drop on the Energy pill Pitches the card", async ({ page }) => {
  const hand = await startPlanning(page);
  const energy = page.getByTestId("energy");
  await expect(energy).toHaveAttribute("aria-label", "Energy: 0 available");
  const box = (await energy.boundingBox())!;
  await pull(page, hand, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(energy).toHaveAttribute("aria-label", "Energy: 1 available");
  await expect(faces(page)).toHaveCount(0);
});

test("a drop on a highlighted tile queues Move 2 there; a drop on empty board parks the card", async ({ page }) => {
  const hand = await startPlanning(page);
  const board = (await page.locator(".board canvas").boundingBox())!;
  // Empty board, far from the Hero: nothing is queued, the faces open.
  await pull(page, hand, { x: board.x + 12, y: board.y + 60 });
  await expect(faces(page)).toBeVisible();
  await expect(removeButtons(page)).toHaveCount(0);
  await page.mouse.click(board.x + 12, board.y + 60); // the card goes back

  // The tiles are drawn on a canvas; with the fixed viewport and start (the Squad framed on the 45 by 25 map), a lit tile of Move 2 is at this point, left of the faces.
  await pull(page, hand, { x: board.x + 125, y: board.y + 138 });
  await expect(removeButtons(page)).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Queue" })).toContainText(/Move/);
  await expect(faces(page)).toHaveCount(0);
});
