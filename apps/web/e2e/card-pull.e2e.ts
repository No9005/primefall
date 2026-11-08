import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { startMatch } from "./start-match";

// The card pull (issue 267): a real pointer drag from the Hand opens the faces, a release in the middle parks the card
// with the faces open, a low release puts it back.

const faces = (page: Page) => page.getByRole("group", { name: "Use card as" });
const removeButtons = (page: Page) => page.getByRole("region", { name: "Queue" }).getByRole("button", { name: /^Remove action/ });

async function startPlanning(page: Page) {
  // Count native drags that reach a card: there must be none.
  await page.addInitScript(() => {
    (window as unknown as { dragStarts: number }).dragStarts = 0;
    window.addEventListener("dragstart", () => ((window as unknown as { dragStarts: number }).dragStarts += 1), true);
  });
  await page.goto("/");
  await startMatch(page);
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");
  const hand = page.getByRole("list", { name: "Hand" });
  await expect(hand.getByRole("button").last()).toBeEnabled();
  await page.waitForTimeout(1500); // the draw animation
  return hand;
}

const dragStarts = (page: Page) => page.evaluate(() => (window as unknown as { dragStarts: number }).dragStarts);

/** A point on the visible fan: `fraction` of the way along its width, `dy` px below its top edge. */
async function fanPoint(hand: Locator, fraction: number, dy: number) {
  const box = (await hand.boundingBox())!;
  return { x: box.x + box.width * fraction, y: box.y + dy };
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * step) / 4, from.y + ((to.y - from.y) * step) / 4);
  }
  if (release) await page.mouse.up();
}

test.use({ viewport: { width: 844, height: 390 } });

test("a drag up from the first card opens the faces, a release in the middle parks the card, a tap on a face queues the use", async ({ page }) => {
  const hand = await startPlanning(page);
  await mouseDrag(page, await fanPoint(hand, 0.08, 30), { x: 400, y: 215 });
  await expect(faces(page)).toBeVisible();
  await expect(page.locator(".pull-card.parked")).toBeVisible();
  await expect(faces(page)).toHaveCSS("opacity", "1");
  await faces(page).getByRole("button", { name: /^Pitch/ }).click();
  await expect(faces(page)).toHaveCount(0);
  expect(await dragStarts(page)).toBe(0);
});

test("the same from the last card", async ({ page }) => {
  const hand = await startPlanning(page);
  await mouseDrag(page, await fanPoint(hand, 0.95, 30), { x: 400, y: 215 });
  await expect(faces(page)).toBeVisible();
  await faces(page).getByRole("button", { name: /^Pitch/ }).click();
  await expect(faces(page)).toHaveCount(0);
});

test("a drag that starts in the top band at the left end of the fan grabs the card", async ({ page }) => {
  const hand = await startPlanning(page);
  for (const [fraction, dy] of [[0.02, 2], [0.2, 4]] as const) {
    const start = await fanPoint(hand, fraction, dy);
    await mouseDrag(page, start, { x: 400, y: 215 });
    await expect(faces(page)).toBeVisible();
    await page.mouse.click(700, 60); // outside the faces: the card goes back
    await expect(faces(page)).toHaveCount(0);
  }
});

test("a text selection started over the Hand does not break later drags (no pointercancel)", async ({ page }) => {
  const hand = await startPlanning(page);
  await mouseDrag(page, await fanPoint(hand, 0.5, 2), { x: await (async () => (await fanPoint(hand, 0.9, 2)).x)(), y: 340 });
  await mouseDrag(page, await fanPoint(hand, 0.08, 30), { x: 400, y: 215 });
  await expect(faces(page)).toBeVisible();
  expect(await dragStarts(page)).toBe(0);
});

test("a release low in the Hand area puts the card back", async ({ page }) => {
  const hand = await startPlanning(page);
  await mouseDrag(page, await fanPoint(hand, 0.08, 30), { x: 200, y: 330 });
  await expect(faces(page)).toHaveCount(0);
  await expect(removeButtons(page)).toHaveCount(0);
  await expect(page.getByTestId("pulled-card")).toHaveCount(0);
});

test("the parked card goes back when it is tapped", async ({ page }) => {
  const hand = await startPlanning(page);
  await mouseDrag(page, await fanPoint(hand, 0.08, 30), { x: 400, y: 215 });
  await expect(faces(page)).toBeVisible();
  await page.locator(".pull-card.parked").click();
  await expect(faces(page)).toHaveCount(0);
});

test.describe("with touch", () => {
  test.use({ hasTouch: true });

  async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", point?: { x: number; y: number }) {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [{ x: point.x, y: point.y }] : [] });
  }

  test("a touch drag up from the first card parks it in the middle with the faces open; a low release puts it back", async ({ page }) => {
    const hand = await startPlanning(page);
    const cdp = await page.context().newCDPSession(page);
    const from = await fanPoint(hand, 0.08, 30);
    await touch(cdp, "touchStart", from);
    for (let step = 1; step <= 8; step += 1) await touch(cdp, "touchMove", { x: from.x + step * 30, y: from.y - step * 18 });
    await touch(cdp, "touchEnd");
    await expect(faces(page)).toBeVisible();
    await faces(page).getByRole("button", { name: /^Pitch/ }).click();
    await expect(faces(page)).toHaveCount(0);

    const second = await fanPoint(hand, 0.9, 30);
    await touch(cdp, "touchStart", second);
    for (let step = 1; step <= 4; step += 1) await touch(cdp, "touchMove", { x: second.x, y: second.y - step * 5 });
    await touch(cdp, "touchEnd");
    await expect(faces(page)).toHaveCount(0);
    expect(await dragStarts(page)).toBe(0);
  });
});
