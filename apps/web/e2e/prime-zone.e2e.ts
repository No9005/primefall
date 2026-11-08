import { expect, test } from "@playwright/test";
import { startMatch } from "./start-match";

test("the Zone pill shows both Victory Point scores from the start of Planning, and the Round as n / 15", async ({ page }) => {
  await page.goto("/");
  await startMatch(page);
  await expect(page.getByTestId("round")).toHaveText("ROUND 1 / 15");

  const pill = page.getByTestId("prime-progress");
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute("aria-label", "Victory Points, you 0, enemy 0");
  await expect(pill.locator(".prime-vp-score")).toHaveText(["0", "0"]);
  await expect(pill.locator(".prime-pip")).toHaveCount(0);
});
