import type { Page } from "@playwright/test";

/** From the start screen into a match as the Bruiser: Play, the Hero Select (tap the Bruiser), Start. */
export async function startMatch(page: Page): Promise<void> {
  await page.getByTestId("play-classic").click();
  await page.getByTestId("hero-bruiser").click();
  await page.getByRole("button", { name: "NEXT" }).click();
  await waitForBoard(page);
}

/** The board scene has drawn its tiles and Heroes (the stage's seam, ADR 0026 rule 10; no pixels are read). */
export async function waitForBoard(page: Page): Promise<void> {
  await page.locator('[data-scene="board"][data-scene-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
}
