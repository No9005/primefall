// Draws and packs the jungle map tileset for PixiJS and builds two maps from it as a check.
// Run from the repository root:
//   node docs/design/jungle-field/tools/export.mjs
// It needs a Chromium that Playwright can start (the one the e2e tests use). Set PLAYWRIGHT_CHROMIUM_PATH to use another.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const assets = join(root, 'apps', 'web', 'public', 'assets', 'jungle-field');
const overview = join(here, '..', 'overview');

function loadChromium() {
  try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; }
}
const pngBytes = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

const browser = await loadChromium().launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  await mkdir(assets, { recursive: true }); await mkdir(overview, { recursive: true });
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: await readFile(join(here, '..', '..', 'tools', 'pixel-atlas.js'), 'utf8') });
  await page.addScriptTag({ content: await readFile(join(here, 'tileset.js'), 'utf8') });
  await page.addScriptTag({ content: await readFile(join(here, 'assemble.js'), 'utf8') });

  const atlas = await page.evaluate(() => buildAtlas());
  const name = atlas.tileset.name;
  await writeFile(join(assets, name + '.png'), pngBytes(atlas.png));
  await writeFile(join(assets, name + '.json'), JSON.stringify(atlas.json) + '\n');
  await writeFile(join(assets, 'tileset.json'), JSON.stringify(atlas.tileset, null, 2) + '\n');
  await writeFile(join(assets, 'mist.png'), pngBytes(atlas.mist));

  // From here on only the written files are used, as the game would use them.
  const pictures = await page.evaluate(async ({ png, json, tileset }) => {
    const image = new Image(); image.src = png; await image.decode();
    const big = (cv, scale) => { const c = document.createElement('canvas'); c.width = cv.width * scale; c.height = cv.height * scale; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
    const sheet = document.createElement('canvas'); sheet.width = image.width; sheet.height = image.height; sheet.getContext('2d').drawImage(image, 0, 0);
    return { atlas: big(sheet, 2), hollow: big(assemble(image, json, tileset, layoutHollow(false)), 1), village: big(assemble(image, json, tileset, layoutHollow(true)), 1) };
  }, { png: atlas.png, json: atlas.json, tileset: atlas.tileset });
  await writeFile(join(overview, 'atlas.png'), pngBytes(pictures.atlas));
  await writeFile(join(overview, 'hollow.png'), pngBytes(pictures.hollow));
  await writeFile(join(overview, 'village.png'), pngBytes(pictures.village));
  console.log('tileset: ' + Object.keys(atlas.json.frames).length + ' frames, sheet ' + atlas.json.meta.size.w + ' x ' + atlas.json.meta.size.h);
} finally {
  await browser.close();
}
