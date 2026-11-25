// Draws rough shapes onto a picture, as a sketch for an inpaint pass that refines it (inpaint.mjs, denoise about 0.5 to 0.65).
//   node paint.mjs <in png> <out png> <op> [<op> ...]
// Ops (pixels of the picture): `rect:x,y,w,h,colour`, `line:x1,y1,x2,y2,width,colour`, `circle:x,y,r,colour`, `outlined:x1,y1,x2,y2,width,colour` (a line with a dark 4 px outline).
// Colours are css colours without a comma, so `#8f9aa3` or `gray`; use `rgb` only as `#rrggbb`.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , inFile, outFile, ...ops] = process.argv;
if (!outFile || ops.length === 0) throw new Error('usage: paint.mjs <in png> <out png> <op> [...]');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ url, ops }) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.lineCap = 'butt';
  const stroke = (x1, y1, x2, y2, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  for (const op of ops) {
    const [kind, rest] = [op.slice(0, op.indexOf(':')), op.slice(op.indexOf(':') + 1)]; const p = rest.split(',');
    const n = p.map(Number);
    if (kind === 'rect') { g.fillStyle = p[4]; g.fillRect(n[0], n[1], n[2], n[3]); }
    else if (kind === 'line') stroke(n[0], n[1], n[2], n[3], n[4], p[5]);
    else if (kind === 'outlined') { stroke(n[0], n[1], n[2], n[3], n[4] + 8, '#17110d'); stroke(n[0], n[1], n[2], n[3], n[4], p[5]); }
    else if (kind === 'circle') { g.fillStyle = p[3]; g.beginPath(); g.arc(n[0], n[1], n[2], 0, Math.PI * 2); g.fill(); }
    else throw new Error('unknown op ' + kind);
  }
  return c.toDataURL('image/png');
}, { url: 'data:image/png;base64,' + readFileSync(inFile).toString('base64'), ops });
writeFileSync(outFile, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
await browser.close();
