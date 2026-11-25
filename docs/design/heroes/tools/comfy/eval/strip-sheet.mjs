// A numbered contact sheet of a strip (frames side by side in one png).
//   node strip-sheet.mjs <strip png> <frames> <columns> <scale> <out png>
// Tilly's original hangar strips are kept in `archive/tilly-tests/original-hangar-strips/`.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , file, frames, cols, scale, out] = process.argv;
if (!out) throw new Error('usage: strip-sheet.mjs <strip png> <frames> <columns> <scale> <out png>');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const result = await page.evaluate(async ({ u, frames, cols, scale }) => {
  const img = new Image(); img.src = u; await img.decode();
  const fw = img.width / frames, fh = img.height, rows = Math.ceil(frames / cols);
  const c = document.createElement('canvas'); c.width = cols * fw * scale; c.height = rows * fh * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#556'; g.fillRect(0, 0, c.width, c.height); g.font = 'bold 14px sans-serif';
  for (let i = 0; i < frames; i++) {
    const x = (i % cols) * fw * scale, y = Math.floor(i / cols) * fh * scale;
    g.drawImage(img, i * fw, 0, fw, fh, x, y, fw * scale, fh * scale);
    g.fillStyle = '#fff'; g.fillText(String(i), x + 4, y + 16);
  }
  return { data: c.toDataURL('image/png'), w: img.width, h: img.height };
}, { u: 'data:image/png;base64,' + readFileSync(file).toString('base64'), frames: Number(frames), cols: Number(cols), scale: Number(scale) });
writeFileSync(out, Buffer.from(result.data.slice(result.data.indexOf(',') + 1), 'base64'));
console.log(`${result.w} x ${result.h} px, ${frames} frames of ${result.w / frames} px`);
await browser.close();
