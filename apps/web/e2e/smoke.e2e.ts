import { expect, test, type Locator, type Page } from "@playwright/test";

/** Collects uncaught page errors and console errors; the test fails if any occurred. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // The app has no favicon yet, so the browser's automatic request for it is a 404; not what this test looks for.
    if (message.location().url.endsWith("/favicon.ico")) return;
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** True when the canvas shows more than one colour, that is, the board is drawn and not blank. */
async function canvasIsDrawn(page: Page, canvas: Locator): Promise<boolean> {
  const png = await canvas.screenshot();
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 7) {
      colours.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      if (colours.size > 12) return true;
    }
    return false;
  }, png.toString("base64"));
}

test("the blank-board check fails on a blank canvas", async ({ page }) => {
  await page.setContent(`<canvas id="blank" width="200" height="100" style="background:#12161c"></canvas>`);
  expect(await canvasIsDrawn(page, page.locator("#blank"))).toBe(false);
});

test("start a match, play a Move card onto a tile, Commit", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.getByTestId("round")).toHaveText(/^Round 1\//);
  const canvas = page.locator(".board canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvasIsDrawn(page, canvas)).toBe(true);

  // Tap flow: card, "Move" in the detail sheet, then a tile. Which tiles are legal is the game's call, so tap
  // a grid of points over the board until the card shows up in the queue.
  const hand = page.getByRole("list", { name: "Hand" });
  const queue = page.getByRole("region", { name: "Queue" });
  const box = (await canvas.boundingBox())!;
  // The hand is a fan of overlapping cards; the last one is fully visible.
  await hand.getByRole("button").last().click();
  await page.getByRole("dialog", { name: /details$/ }).getByRole("button", { name: /^Move/ }).click();
  // Arming a Move zooms the camera on the Hero; wait for that, then tap the lit tiles right of the Hero.
  await expect(page.getByRole("button", { name: "Fit board" })).toBeVisible();
  const lit = [
    [0.6, 0.38],
    [0.5, 0.5],
    [0.55, 0.45],
    [0.45, 0.55],
    [0.65, 0.33],
  ];
  let queued = false;
  for (const [x, y] of lit) {
    if (queued) break;
    await page.mouse.click(box.x + box.width * x!, box.y + box.height * y!);
    queued = (await queue.getByRole("button", { name: /^Remove action/ }).count()) > 0;
  }
  expect(queued, "a card was queued on a legal tile").toBe(true);

  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByTestId("round")).toHaveText(/^Round 2\//, { timeout: 20_000 });

  expect(errors).toEqual([]);
});
