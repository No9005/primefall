// Fills rectangles of a picture with a flat colour, for example to take an unwanted object out of a flat background.
//   node fill.mjs <in png> <out png> <colour | sample:x,y> <x,y,w,h> [<x,y,w,h> ...]
// `sample:x,y` takes the colour of that pixel (the page of a generated picture is flat but not always exactly one colour).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , inFile, outFile, colour, ...rects] = process.argv;
if (!outFile || rects.length === 0) throw new Error('usage: fill.mjs <in png> <out png> <colour | sample:x,y> <x,y,w,h> [...]');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const data = await page.evaluate(async ({ url, colour, rects }) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  let fill = colour;
  if (colour.startsWith('sample:')) { const [x, y] = colour.slice(7).split(',').map(Number); const p = g.getImageData(x, y, 1, 1).data; fill = `rgb(${p[0]},${p[1]},${p[2]})`; }
  g.fillStyle = fill;
  for (const r of rects) { const [x, y, w, h] = r.split(',').map(Number); g.fillRect(x, y, w, h); }
  return { png: c.toDataURL('image/png'), fill };
}, { url: 'data:image/png;base64,' + readFileSync(inFile).toString('base64'), colour, rects });
writeFileSync(outFile, Buffer.from(data.png.slice(data.png.indexOf(',') + 1), 'base64'));
console.log('filled with', data.fill);
await browser.close();
