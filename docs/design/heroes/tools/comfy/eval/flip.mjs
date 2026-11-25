// Mirrors a picture left to right (a reference picture whose left and right the edit model would copy to the wrong side).
//   node flip.mjs <in png> <out png>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , inFile, outFile] = process.argv;
if (!outFile) throw new Error('usage: flip.mjs <in png> <out png>');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const png = await page.evaluate(async url => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}, 'data:image/png;base64,' + readFileSync(inFile).toString('base64'));
writeFileSync(outFile, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
await browser.close();
