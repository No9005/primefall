// Candidates side by side with labels, 3 columns. The crop defaults to the lower middle of the 1024 px page (where the 8x rig figure stands); LOOK_CROP=x,y,w,h
// changes it (LOOK_CROP=0,0,1024,1024 for a whole page).
//   node look-sheet.mjs <out png> <label>=<png> [<label>=<png> ...]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , out, ...files] = process.argv;
const CROP = (process.env.LOOK_CROP ?? '256,560,560,464').split(',').map(Number);
if (files.length === 0) throw new Error('usage: look-sheet.mjs <out png> <label>=<png> [...]');
const images = files.map(f => { const at = f.indexOf('='); return { label: f.slice(0, at), url: 'data:image/png;base64,' + readFileSync(f.slice(at + 1)).toString('base64') }; });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ images, CROP }) => {
  const W = 420, H = 420, pad = 6, cols = 3, rows = Math.ceil(images.length / cols);
  const c = document.createElement('canvas'); c.width = cols * (W + pad); c.height = rows * (H + pad + 18);
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.font = '14px sans-serif';
  for (const [i, m] of images.entries()) {
    const im = new Image(); im.src = m.url; await im.decode();
    const x = (i % cols) * (W + pad), y = Math.floor(i / cols) * (H + pad + 18);
    g.drawImage(im, ...CROP, x, y + 18, W, H);
    g.fillStyle = '#fff'; g.fillText(m.label, x + 4, y + 13);
  }
  return c.toDataURL('image/png');
}, { images, CROP });
writeFileSync(out, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
await browser.close();
