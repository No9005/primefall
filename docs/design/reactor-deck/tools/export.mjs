// Draws and packs the Reactor Deck tileset "Notstrom" for PixiJS and builds two maps from it as a check.
// Run from the repository root:
//   node docs/design/reactor-deck/tools/export.mjs
// It needs a Chromium that Playwright can start (the one the e2e tests use). Set PLAYWRIGHT_CHROMIUM_PATH to use another.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const assets = join(root, 'apps', 'web', 'public', 'assets', 'reactor-deck');
const overview = join(here, '..', 'overview');

// The Reactor Deck as in packages/game-core/src/reactor-deck.ts, and what the layout does not say by itself.
const REACTOR_DECK = [
  '###############################', '#.............................#', '#...H...HH...HH.HH...HH...H...#', '#.............XXX.............#',
  '#.....HH..##.HXXXH.##..HH.....#', '#.............H.H.............#', '#....#######HH...HH#######....#', '#S............PPP............S#',
  '#S............PPP............S#', '#S............PPP............S#', '#....#######HH...HH#######....#', '#.............H.H.............#',
  '#.....HH..##.HXXXH.##..HH.....#', '#.............XXX.............#', '#...H...HH...HH.HH...HH...H...#', '#.............................#', '###############################'
];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const DECK_EXTRAS = {
  breaches: [7, 8, 9].flatMap(r => [[0, r], [30, r]]),
  broken: [[0, 6], [0, 10], [30, 6], [30, 10]],
  ground: range(5, 11).flatMap(r => [-3, -2, -1, 31, 32, 33].map(c => [c, r, Math.abs(r - 8) > 2 || c < -1 || c > 31]))
    .concat([6, 7, 8, 9, 10].flatMap(r => [[0, r, false], [30, r, false]])),
  guides: range(2, 12).concat(range(18, 28)).map(c => [c, 8, 'col']),
  ring: [15, 8], core: [15, 8], breachLights: [[1, 8, -10], [29, 8, 10]],
  texts: [
    { face: 'south', c: 3, r: 0, id: 'hangar_06' }, { face: 'south', c: 13, r: 0, id: 'deck_c' }, { face: 'south', c: 21, r: 0, id: 'cargo_02' },
    { face: 'south', c: 5, r: 6, id: 'reactor_right' }, { face: 'south', c: 19, r: 6, id: 'reactor_left' },
    { face: 'south', c: 5, r: 10, id: 'coolant_2' }, { face: 'south', c: 19, r: 10, id: 'caution_plasma' },
    { face: 'east', c: 0, r: 5, id: 'airlock' }, { face: 'east', c: 0, r: 15, id: 'bay_03' }
  ]
};
// A layout that does not exist in the game, to show that the same tiles build something else:
// a smaller room, the Prime Zone off centre and 2 by 2, one breach in the top wall, Full Cover, a guide line with a bend.
const OTHER = [
  '##################', '#..H.....#.......#', '#........#..XX...#', '#..PP....#..XX...#', '#..PP..F.....H...#', '#........#.......#',
  '####..####..H....#', '#.........#......#', '#..H..F...#...S..#', '#.............S..#', '##################'
];
const OTHER_EXTRAS = {
  breaches: [[13, 0], [14, 0]], broken: [[12, 0], [15, 0]],
  ground: [[12, -1, true], [13, -1, false], [14, -1, false], [15, -1, true], [13, -2, true], [14, -2, true], [12, 0, false], [13, 0, false], [14, 0, false], [15, 0, false]],
  guides: range(5, 8).map(r => [14, r, 'row']).concat(range(5, 13).map(c => [c, 4, 'col'])), deadGuides: .25,
  core: [3, 3], breachLights: [[13, 1, 8]],
  texts: [{ face: 'south', c: 1, r: 6, id: 'bay_03' }, { face: 'east', c: 9, r: 3, id: 'deck_c' }, { face: 'south', c: 1, r: 0, id: 'caution_plasma' }]
};

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
  await page.addScriptTag({ content: await readFile(join(here, 'tileset.js'), 'utf8') });
  await page.addScriptTag({ content: await readFile(join(here, 'assemble.js'), 'utf8') });

  const atlas = await page.evaluate(() => buildAtlas());
  await writeFile(join(assets, 'notstrom.png'), pngBytes(atlas.png));
  await writeFile(join(assets, 'notstrom.json'), JSON.stringify(atlas.json) + '\n');
  await writeFile(join(assets, 'tileset.json'), JSON.stringify(atlas.tileset, null, 2) + '\n');

  // From here on only the three written files are used, as the game would use them.
  const pictures = await page.evaluate(async ({ png, json, tileset, maps }) => {
    const image = new Image(); image.src = png; await image.decode();
    const big = (cv, scale) => { const c = document.createElement('canvas'); c.width = cv.width * scale; c.height = cv.height * scale; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#07090c'; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
    const sheet = document.createElement('canvas'); sheet.width = image.width; sheet.height = image.height; sheet.getContext('2d').drawImage(image, 0, 0);
    return { atlas: big(sheet, 2), maps: maps.map(m => big(assemble(image, json, tileset, m.layout, m.extras), 2)) };
  }, { png: atlas.png, json: atlas.json, tileset: atlas.tileset, maps: [{ layout: REACTOR_DECK, extras: DECK_EXTRAS }, { layout: OTHER, extras: OTHER_EXTRAS }] });
  await writeFile(join(overview, 'atlas.png'), pngBytes(pictures.atlas));
  await writeFile(join(overview, 'reactor-deck.png'), pngBytes(pictures.maps[0]));
  await writeFile(join(overview, 'other-layout.png'), pngBytes(pictures.maps[1]));
  console.log('tileset: ' + Object.keys(atlas.json.frames).length + ' frames, sheet ' + atlas.json.meta.size.w + ' x ' + atlas.json.meta.size.h);
} finally {
  await browser.close();
}
