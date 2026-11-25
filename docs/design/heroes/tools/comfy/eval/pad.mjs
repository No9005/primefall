// Adds room around a picture, filled with the colour of one of its pixels (the flat page of a generated picture), so that an edit can draw something
// that reaches beyond the old frame (for example an arm that arches over a head).
//   node pad.mjs <in png> <out png> <top> <right> <bottom> <left> [sample:x,y]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , inFile, outFile, top, right, bottom, left, sample = 'sample:10,10'] = process.argv;
if (!left) throw new Error('usage: pad.mjs <in png> <out png> <top> <right> <bottom> <left> [sample:x,y]');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ url, pad, sample }) => {
  const img = new Image(); img.src = url; await img.decode();
  const [t, r, b, l] = pad;
  const probe = document.createElement('canvas'); probe.width = img.width; probe.height = img.height;
  const pg = probe.getContext('2d', { willReadFrequently: true }); pg.drawImage(img, 0, 0);
  const [sx, sy] = sample.slice(7).split(',').map(Number), p = pg.getImageData(sx, sy, 1, 1).data;
  const c = document.createElement('canvas'); c.width = img.width + l + r; c.height = img.height + t + b;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, l, t);
  return { png: c.toDataURL('image/png'), w: c.width, h: c.height };
}, { url: 'data:image/png;base64,' + readFileSync(inFile).toString('base64'), pad: [top, right, bottom, left].map(Number), sample });
writeFileSync(outFile, Buffer.from(data.png.slice(data.png.indexOf(',') + 1), 'base64'));
console.log(`${data.w} x ${data.h}`);
await browser.close();
