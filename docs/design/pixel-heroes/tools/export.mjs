// Renders the pixel-art Heroes into sprite sheets for PixiJS. Run from the repository root:
//   node docs/design/pixel-heroes/tools/export.mjs
// It needs a Chromium that Playwright can start (the one the e2e tests use). Set PLAYWRIGHT_CHROMIUM_PATH to use another.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const assets = join(root, 'apps', 'web', 'public', 'assets', 'pixel-heroes');
const overviewDir = join(here, '..', 'overview');
const reference = join(here, '..', 'reference');

// The concept page of each Hero and the index of the chosen design in its VARIANTS list.
const HEROES = [
  { name: 'bruiser', concepts: 'concepts-bruiser.html', variant: 3 },
  { name: 'controller', concepts: 'concepts-controller.html', variant: 0 },
  { name: 'assassin', concepts: 'concepts-assassin.html', variant: 4 }
];

function loadChromium() {
  try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; }
}
const pngBytes = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

async function buildPage(browser) {
  const tail = await readFile(join(here, 'export-tail.js'), 'utf8');
  let script = 'const RIGS = {};\n';
  for (const hero of HEROES) {
    const rig = await readFile(join(here, 'rigs', hero.name + '.js'), 'utf8');
    script += 'RIGS.' + hero.name + ' = (() => {\n' + rig + '\n' + tail + '\n})();\n';
  }
  script += await readFile(join(here, 'export-page.js'), 'utf8');
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: script });
  return page;
}

async function exportSheets(page, hero) {
  const dir = join(assets, hero.name);
  await mkdir(dir, { recursive: true });
  const result = await page.evaluate(name => exportHero(name), hero.name);
  for (const clip of result.clips) {
    await writeFile(join(dir, clip.name + '.png'), pngBytes(clip.png));
    await writeFile(join(dir, clip.name + '.json'), JSON.stringify(clip.json) + '\n');
  }
  await writeFile(join(dir, 'clips.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  await writeFile(join(overviewDir, hero.name + '.png'), pngBytes(await page.evaluate(name => overview(name), hero.name)));
  const frames = result.manifest.clips.reduce((sum, clip) => sum + clip.frames, 0);
  const unique = result.clips.reduce((sum, clip) => sum + clip.uniqueFrames, 0);
  console.log(hero.name + ': ' + result.clips.length + ' clips, ' + frames + ' frames, ' + unique + ' packed images');
}

// The standing figure and the portrait come from the concept page, where they are drawn pixel by pixel.
async function exportFigure(browser, hero) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(join(reference, hero.concepts)).href);
  const images = await page.evaluate(index => {
    const draw = (sprite, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      paint(c.getContext('2d'), sprite, 0, 0);
      return c.toDataURL('image/png');
    };
    const v = VARIANTS[index];
    return { figure: draw(buildSprite(v), W, H), portrait: draw(buildPortrait(v), 36, 36) };
  }, hero.variant);
  await writeFile(join(assets, hero.name, 'figure.png'), pngBytes(images.figure));
  await writeFile(join(assets, hero.name, 'portrait.png'), pngBytes(images.portrait));
  await page.close();
}

const browser = await loadChromium().launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  await mkdir(overviewDir, { recursive: true });
  const page = await buildPage(browser);
  for (const hero of HEROES) {
    await exportSheets(page, hero);
    await exportFigure(browser, hero);
  }
} finally {
  await browser.close();
}
