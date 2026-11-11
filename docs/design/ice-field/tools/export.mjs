// Draws and packs the snow map tileset "Polarnacht" for PixiJS and builds two maps from it as a check.
// Run from the repository root:
//   node docs/design/ice-field/tools/export.mjs
// It needs a Chromium that Playwright can start (the one the e2e tests use). Set PLAYWRIGHT_CHROMIUM_PATH to use another.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const assets = join(root, 'apps', 'web', 'public', 'assets', 'ice-field');
const overview = join(here, '..', 'overview');

// There is no snow map in the game data yet. This layout is a placeholder of the size of the Reactor Deck.
const FIELD = [
  '###############################', '#......##...........##........#', '#..H...........C..H........H..#', '#.....F...........F.....F.....#',
  '#D...........HH.HH...........D#', '#......###...........###......#', '#..H.....#..H.....H..#.....H..#', '#S............PPP............S#',
  '#S.....F......PPP......F.....S#', '#S............PPP............S#', '#..H.....#..H.....H..#.....H..#', '#......###...........###......#',
  '#EEEEEEEEEEEEEEEEEEEEEEEEEEEEE#', '#.....F......HH.HH......F.....#', '#..H........H..R..H........H..#', '#......##...........##........#', '###############################'
].map(row => row.replace('C', '.'));
const FIELD_EXTRAS = {
  pools: [[4, 2, 0], [24, 3, 1], [10, 8, 2], [20, 8, 0], [5, 14, 1], [26, 13, 2], [11, 3, 1], [20, 14, 0]],
  capsule: [15, 2], salvage: [16, 3], debris: [[13, 1], [12, 3], [17, 1]],
  gate: [15, 8], generator: [17, 9], ring: [15, 8], sled: [15, 12]
};
// A second layout, to show that the same tiles build something else: a narrow pass, the route with a bend,
// the Prime Zone 2 by 2, the capsule in the open.
const OTHER = [
  '####################', '#....#.......H.....#', '#.S..#..PP.........#', '#.S.....PP...F..D..#', '#....H.......#######', '#............#.....#',
  '####..EEEEEEE...R..#', '#.....E..H.........#', '#..H..E......H..S..#', '#.....E.........S..#', '####################'
];
const OTHER_EXTRAS = { pools: [[10, 5, 1], [3, 8, 2]], capsule: [10, 8], salvage: [11, 9], debris: [[8, 7], [12, 7]], gate: [8, 2], generator: [10, 3], sled: [8, 6] };

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
  await writeFile(join(assets, 'polarnacht.png'), pngBytes(atlas.png));
  await writeFile(join(assets, 'polarnacht.json'), JSON.stringify(atlas.json) + '\n');
  await writeFile(join(assets, 'tileset.json'), JSON.stringify(atlas.tileset, null, 2) + '\n');
  await writeFile(join(assets, 'snow-near.png'), pngBytes(atlas.snowNear));
  await writeFile(join(assets, 'snow-far.png'), pngBytes(atlas.snowFar));
  await writeFile(join(assets, 'aurora.png'), pngBytes(atlas.aurora));

  // From here on only the written files are used, as the game would use them.
  const pictures = await page.evaluate(async ({ png, json, tileset, maps, capsule }) => {
    const image = new Image(); image.src = png; await image.decode();
    const big = (cv, scale, sx = 0, sy = 0, sw = cv.width, sh = cv.height) => { const c = document.createElement('canvas'); c.width = sw * scale; c.height = sh * scale; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = tileset.sky; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, sx, sy, sw, sh, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
    const sheet = document.createElement('canvas'); sheet.width = image.width; sheet.height = image.height; sheet.getContext('2d').drawImage(image, 0, 0);
    const built = maps.map(m => assemble(image, json, tileset, m.layout, m.extras));
    // the close-up of the capsule: the same picture, cut out around its tile
    const rows = maps[0].layout.length, cx = rows * 16 + 130 + (capsule[0] - capsule[1]) * 16, cy = 130 + (capsule[0] + capsule[1]) * 8 + 8;
    return { atlas: big(sheet, 2), maps: built.map(b => big(b, 2)), capsule: big(built[0], 4, cx - 92, cy - 70, 160, 104) };
  }, { png: atlas.png, json: atlas.json, tileset: atlas.tileset, maps: [{ layout: FIELD, extras: FIELD_EXTRAS }, { layout: OTHER, extras: OTHER_EXTRAS }], capsule: FIELD_EXTRAS.capsule });
  await writeFile(join(overview, 'atlas.png'), pngBytes(pictures.atlas));
  await writeFile(join(overview, 'field.png'), pngBytes(pictures.maps[0]));
  await writeFile(join(overview, 'other-layout.png'), pngBytes(pictures.maps[1]));
  await writeFile(join(overview, 'capsule.png'), pngBytes(pictures.capsule));
  console.log('tileset: ' + Object.keys(atlas.json.frames).length + ' frames, sheet ' + atlas.json.meta.size.w + ' x ' + atlas.json.meta.size.h);
} finally {
  await browser.close();
}
