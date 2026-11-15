// Renders the card pictures from the reference page. Run from the repository root:
//   node docs/design/cards/tools/export.mjs
// It needs a Chromium that Playwright can start (the one the e2e tests use). Set PLAYWRIGHT_CHROMIUM_PATH to use another.
// Writes the art of every card (136 x 104 px) and the card back to apps/web/public/assets/cards/ and a picture of every
// finished card to docs/design/cards/overview/.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const assets = join(root, 'apps', 'web', 'public', 'assets', 'cards');
const overview = join(here, '..', 'overview');
const page = join(here, '..', 'reference', 'card-faces.html');

// The key of a card in the reference page and the file name the game uses (the card's name in kebab case).
const FILES = {
  double: 'buy-one-get-two', close: 'handle-with-care', coffee: 'time-for-coffee', rush: 'express-delivery', hat: 'hard-hat', hook: 'cargo-hook',
  move: 'walk-it-off', pitch: 'overtime', wait: 'smoke-break', 'back-a': 'back',
  // Tilly Turnover
  temp: 'temporary-solution', survey: 'site-survey', demo: 'urban-renewal', heap: 'heavy-metal', price: 'price-tag',
  tmove: 'walk-it-off-tilly', tpitch: 'cannibalize', twait: 'idle-hands'
};

function loadChromium() {
  try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; }
}
const pngBytes = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

const browser = await loadChromium().launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  await mkdir(assets, { recursive: true });
  await mkdir(overview, { recursive: true });
  const tab = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
  tab.on('pageerror', error => { throw error; });
  await tab.goto(pathToFileURL(page).href);
  await tab.waitForSelector('#deck canvas');
  await tab.waitForTimeout(600);   // the web fonts
  const seen = new Set();
  for (const [key, file] of Object.entries(FILES)) {
    const canvas = tab.locator('canvas[data-card="' + key + '"]').first();
    if (key === 'back-a') {
      // The back has its wordmark as text over the pixel art, so the picture is the whole card back.
      const back = tab.locator('.card[data-card="back-a"]').first();
      await back.screenshot({ path: join(assets, file + '.png'), omitBackground: true });
    } else {
      await writeFile(join(assets, file + '.png'), pngBytes(await canvas.evaluate(c => c.toDataURL('image/png'))));
    }
    const card = tab.locator('.card[data-card="' + key + '"]').first();
    // The cost orb and the ribbon reach out of the card, so the picture takes a margin.
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    // The clip of a full-page screenshot is in page coordinates, the box is in the viewport's.
    const scrolled = await tab.evaluate(() => window.scrollY);
    await tab.screenshot({ path: join(overview, file + '.png'), fullPage: true, clip: { x: box.x - 18, y: box.y + scrolled - 18, width: box.width + 36, height: box.height + 36 } });
    seen.add(file);
  }
  console.log('cards: ' + seen.size + ' pictures and ' + seen.size + ' overview images');
} finally {
  await browser.close();
}
