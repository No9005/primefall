import { expect, test } from "@playwright/test";

test("the Prime Zone pill shows from the start of Planning with three empty pips", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("round")).toHaveText("ROUND 1");

  const pill = page.getByTestId("prime-progress");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("PRIME ZONE");
  await expect(pill).toHaveAttribute("aria-label", "PRIME ZONE, 0 of 3");
  await expect(pill.locator(".prime-pip")).toHaveCount(3);
  await expect(pill.locator(".prime-pip-filled")).toHaveCount(0);
});
