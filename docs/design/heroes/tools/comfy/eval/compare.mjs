// An original strip against an atlas clip, frame by frame (strip on top, atlas below with all its layers, 7 columns, 1.5x).
//   node compare.mjs <strip png> <atlas png> <atlas json> <clip> <frames> <out png>
// The atlas is a hangar atlas (apps/web/public/assets/hangar/atlas/tilly.*); frames are 136 x 116 px. Get an original strip from Git, for example
// `git show 3f0c734:archive/hangar/strips/tilly-act.png > tilly-act.png`.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , stripFile, atlasPng, atlasJson, clip, count, out] = process.argv;
if (!out) throw new Error('usage: compare.mjs <strip png> <atlas png> <atlas json> <clip> <frames> <out png>');
const b64 = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const json = JSON.parse(readFileSync(atlasJson, 'utf8'));
const hero = Object.keys(json.animations)[0].split('.')[0];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ strip, atlas, json, clip, N, hero }) => {
  const load = async u => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const [S, A] = [await load(strip), await load(atlas)];
  const Z = 1.5, W = 136, H = 116, cols = 7, rows = Math.ceil(N / cols);
  const c = document.createElement('canvas'); c.width = cols * W * Z; c.height = rows * 2 * H * Z;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#556'; g.fillRect(0, 0, c.width, c.height); g.font = 'bold 13px sans-serif';
  for (let i = 0; i < N; i++) {
    const x = (i % cols) * W * Z, y = Math.floor(i / cols) * 2 * H * Z;
    g.drawImage(S, i * W, 0, W, H, x, y, W * Z, H * Z);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + H * Z, W * Z, H * Z);
    for (const name of [`${hero}.${clip}.fx_back`, `${hero}.${clip}`, `${hero}.${clip}.fx_front`]) {
      const list = json.animations[name]; if (!list) continue;
      const f = json.frames[list[i]];
      g.drawImage(A, f.frame.x, f.frame.y, f.frame.w, f.frame.h, x + f.spriteSourceSize.x * Z, y + H * Z + f.spriteSourceSize.y * Z, f.frame.w * Z, f.frame.h * Z);
    }
    g.fillStyle = '#fff'; g.fillText(String(i), x + 4, y + 15);
  }
  return c.toDataURL('image/png');
}, { strip: b64(stripFile), atlas: b64(atlasPng), json, clip, N: Number(count), hero });
writeFileSync(out, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
await browser.close();
