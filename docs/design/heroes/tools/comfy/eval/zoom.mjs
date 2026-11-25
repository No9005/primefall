// A few frames of a hangar atlas clip at 6x, all layers, for a close look.
//   node zoom.mjs <atlas png> <atlas json> <clip> <out png> <frame> [<frame> ...]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , atlasPng, atlasJson, clip, out, ...frames] = process.argv;
if (frames.length === 0) throw new Error('usage: zoom.mjs <atlas png> <atlas json> <clip> <out png> <frame> [<frame> ...]');
const b64 = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const json = JSON.parse(readFileSync(atlasJson, 'utf8'));
const hero = Object.keys(json.animations)[0].split('.')[0];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ atlas, json, clip, frames, hero }) => {
  const A = new Image(); A.src = atlas; await A.decode();
  const Z = 6, W = 136, H = 116, step = W * Z * 0.6;
  const c = document.createElement('canvas'); c.width = frames.length * step; c.height = H * Z;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#556'; g.fillRect(0, 0, c.width, c.height);
  frames.forEach((i, k) => {
    for (const name of [`${hero}.${clip}.fx_back`, `${hero}.${clip}`, `${hero}.${clip}.fx_front`]) {
      const list = json.animations[name]; if (!list) continue;
      const f = json.frames[list[i]];
      g.drawImage(A, f.frame.x, f.frame.y, f.frame.w, f.frame.h, k * step - 20 * Z + f.spriteSourceSize.x * Z, f.spriteSourceSize.y * Z, f.frame.w * Z, f.frame.h * Z);
    }
  });
  return c.toDataURL('image/png');
}, { atlas: b64(atlasPng), json, clip, frames: frames.map(Number), hero });
writeFileSync(out, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
await browser.close();
