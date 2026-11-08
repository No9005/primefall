import { expect, test, type Page } from "@playwright/test";
import { startMatch } from "./start-match";

const energy = (page: Page) => page.getByTestId("energy");
const removeButtons = (page: Page) => page.getByRole("region", { name: "Queue" }).getByRole("button", { name: /^Remove action/ });

async function startPlanning(page: Page) {
  await page.goto("/");
  await startMatch(page);
  await expect(page.getByTestId("round")).toHaveText("ROUND 1");
  const hand = page.getByRole("list", { name: "Hand" });
  await expect(hand.getByRole("button").last()).toBeEnabled();
  return hand;
}

/** Pulls the card at `position` from the Hand and chooses its Pitch face. */
async function pitch(page: Page, position: number) {
  await page.getByRole("list", { name: "Hand" }).getByRole("button").nth(position).click();
  await page.getByRole("group", { name: "Use card as" }).getByRole("button", { name: /^Pitch/ }).click();
}

test("a Pitch can be undone: the Energy goes back and the card can be used again", async ({ page }) => {
  const hand = await startPlanning(page);
  const card = hand.getByRole("button").last();
  await expect(energy(page)).toHaveAttribute("aria-label", "Energy: 0 available");

  await pitch(page, (await hand.getByRole("button").count()) - 1);
  await expect(energy(page)).toHaveAttribute("aria-label", "Energy: 1 available");
  await expect(card).toHaveClass(/used/);
  await expect(card).toContainText("tap to undo");

  await page.getByRole("button", { name: "Undo Pitch" }).click();
  await expect(energy(page)).toHaveAttribute("aria-label", "Energy: 0 available");
  await expect(page.getByRole("button", { name: "Undo Pitch" })).toHaveCount(0);
  await expect(card).not.toHaveClass(/used/);
  await expect(card).not.toContainText("Pitch 1");

  // The freed card can be pulled and used again, for example as a Pitch again (the classic mode has no Block).
  await card.click();
  await page.getByRole("group", { name: "Use card as" }).getByRole("button", { name: /^Pitch/ }).click();
  await expect(energy(page)).toHaveAttribute("aria-label", "Energy: 1 available");
});

test("taking back a Pitch the Queue needs flags the action and disables Commit until it is pitched again", async ({ page }) => {
  // The match seed is the first Date.now() of the page. Seed 6 deals the Bruiser Bulwark (1 Energy, on the own Hero) first.
  await page.addInitScript(() => {
    const realNow = Date.now;
    let first = true;
    Date.now = () => (first ? ((first = false), 6) : realNow());
  });
  const hand = await startPlanning(page);
  const cards = hand.getByRole("button");
  await expect(cards.first().locator(".card-name")).toHaveText("Bulwark");

  const pitchedPosition = (await cards.count()) - 1;
  await pitch(page, pitchedPosition);
  await cards.first().click();
  await page.getByRole("group", { name: "Use card as" }).getByRole("button", { name: /^Primary/ }).click();
  await page.waitForTimeout(600); // the camera frames the Hero
  const box = (await page.locator(".board canvas").boundingBox())!;
  for (const [x, y] of [[0.5, 0.5], [0.45, 0.5], [0.5, 0.45], [0.55, 0.5], [0.5, 0.55], [0.4, 0.4], [0.6, 0.6]] as const) {
    if ((await removeButtons(page).count()) > 0) break;
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await expect(removeButtons(page)).toHaveCount(1);

  const queue = page.getByRole("region", { name: "Queue" });
  const commit = page.getByRole("button", { name: "Commit" });
  await expect(commit).toBeEnabled();

  // Take the Pitch back (tapping the pitched card works too): the action stays in the Queue, is flagged, and Commit is disabled.
  await cards.nth(pitchedPosition).click();
  await expect(removeButtons(page)).toHaveCount(1);
  await expect(queue.locator(".queue-row.invalid")).toContainText(/Energy/);
  await expect(commit).toBeDisabled();

  // Pitching a card again makes the Queue affordable.
  await pitch(page, pitchedPosition);
  await expect(queue.locator(".queue-row.invalid")).toHaveCount(0);
  await expect(commit).toBeEnabled();
});
