// Renders the hangar clips of a Hero into the hangar atlas (apps/web/public/assets/hangar/atlas/<hero>.png and .json). Run from the repository root:
//   node docs/design/heroes/tools/export-hangar.mjs controller [--preview <folder>]
// Only Tilly (controller) has her clips defined for now (tools/hangar-controller.js). It needs a Chromium that Playwright can start.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const HEROES = { controller: { atlas: 'tilly', clips: 'hangar-controller.js' } };

// The hangar frame is 136 x 116 with the feet at (58, 112), as the strips it replaces: the map frame (136 x 104, feet at 58, 86) with more room above the Hero.
const FRAME_LINE = /const SW = 136, SH = 104, OX = 58, OY = 86/;

const [, , heroName, ...flags] = process.argv;
const hero = HEROES[heroName];
if (!hero) throw new Error('usage: export-hangar.mjs controller [--preview <folder>]');
const previewDir = flags[0] === '--preview' ? flags[1] : undefined;
const pngBytes = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const chromium = (() => { try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; } })();

async function buildScript() {
  const rig = (await readFile(join(here, 'rigs', heroName + '.js'), 'utf8'));
  if (!FRAME_LINE.test(rig)) throw new Error('the rig no longer has the frame constants this exporter replaces');
  const tail = (await readFile(join(here, 'export-tail.js'), 'utf8')).replace(/\nreturn \{ EXPORT_CLIPS[^\n]*\};\s*$/, '\n');
  const clips = await readFile(join(here, hero.clips), 'utf8');
  const page = await readFile(join(here, 'export-page.js'), 'utf8');
  const hangarPage = await readFile(join(here, 'export-hangar-page.js'), 'utf8');
  const body = rig.replace(FRAME_LINE, 'const SW = 136, SH = 116, OX = 58, OY = 112') + '\n' + tail + '\n' + clips +
    '\nreturn { LAYERS, layerCtx, renderLayers, SW, SH, OX, OY, HANGAR_EXPORT };';
  return 'const RIGS = {};\nRIGS.' + heroName + ' = (() => {\n' + body + '\n})();\n' + page + '\n' + hangarPage;
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.setContent('<!doctype html><html><body style="margin:0;background:#556"></body></html>');
  await page.addScriptTag({ content: await buildScript() });
  const result = await page.evaluate(([rigName, hero]) => exportHangar(rigName, hero), [heroName, hero.atlas]);
  const out = join(root, 'apps', 'web', 'public', 'assets', 'hangar', 'atlas');
  await mkdir(out, { recursive: true });
  await writeFile(join(out, hero.atlas + '.png'), pngBytes(result.png));
  await writeFile(join(out, hero.atlas + '.json'), JSON.stringify(result.json) + '\n');
  console.log(hero.atlas + ': ' + Object.keys(result.json.animations).length + ' animations, ' + result.uniqueFrames + ' packed images, ' + result.json.meta.size.w + ' x ' + result.json.meta.size.h);
  if (previewDir) {
    await mkdir(previewDir, { recursive: true });
    const sheet = 'data:image/png;base64,' + Buffer.from(pngBytes(result.png)).toString('base64');
    for (const name of Object.keys(result.json.animations).filter(n => !/\.fx_/.test(n))) {
      const shot = await page.evaluate(async ({ sheet, json, name, cols }) => {
        const img = new Image(); img.src = sheet; await img.decode();
        const list = [name, name + '.fx_back', name + '.fx_front'].filter(n => json.animations[n]);
        const n = json.animations[name].length, fw = 136, fh = 116, rows = Math.ceil(n / cols);
        const c = document.createElement('canvas'); c.width = cols * fw; c.height = rows * fh; const g = c.getContext('2d');
        g.fillStyle = '#556'; g.fillRect(0, 0, c.width, c.height); g.font = '10px sans-serif';
        for (let i = 0; i < n; i++) {
          const x = (i % cols) * fw, y = Math.floor(i / cols) * fh;
          for (const layer of [list[1] && list[1].endsWith('fx_back') ? list[1] : null, name, list.find(l => l.endsWith('fx_front'))]) {
            if (!layer) continue;
            const f = json.frames[json.animations[layer][i]];
            g.drawImage(img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, x + f.spriteSourceSize.x, y + f.spriteSourceSize.y, f.frame.w, f.frame.h);
          }
          g.fillStyle = '#fff'; g.fillText(String(i), x + 2, y + 10);
        }
        return c.toDataURL('image/png');
      }, { sheet, json: result.json, name, cols: 8 });
      await writeFile(join(previewDir, name.replace('.', '-') + '.png'), pngBytes(shot));
    }
  }
} finally {
  await browser.close();
}
