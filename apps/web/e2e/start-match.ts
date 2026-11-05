import type { Page } from "@playwright/test";

/** From the start screen into a match as the Bruiser: Play, the Hero Select (tap the Bruiser), Start. */
export async function startMatch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByTestId("hero-bruiser").click();
  await page.getByRole("button", { name: "START" }).click();
}
