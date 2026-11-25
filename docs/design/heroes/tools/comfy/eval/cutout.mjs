// The two picture steps around the pixel clean-up of a generated figure on a flat page (see pixel-cleanup.mjs).
//   node cutout.mjs flatten <in png> <out png> <tolerance> [<x,y,w,h> ...]   every pixel within `tolerance` (RGB distance) of the page colour (the pixel at 10,10)
//                                                                              becomes exactly that colour; the rectangles are filled with it (floor shadow and the like)
//   node cutout.mjs key <in png> <out png> <tolerance> [<margin>]              the page colour becomes transparent and the picture is cropped to the figure plus `margin` px;
//                                                                              prints the size and the number of colours
//   node cutout.mjs preview <in png> <out png> <scale> [<colour>]               the picture scaled by whole numbers with nearest neighbour on a flat colour (default #556), to look at
//   node cutout.mjs trim <in png> <out png> <luma> <x,y,w,h> [...]            on a keyed (transparent) picture: inside the rectangles, edge pixels (next to a transparent one) that are
//                                                                              brighter than `luma` (0 to 255) are made transparent, once; the dark outline stays. Removes page-coloured fringe.
//   node cutout.mjs erase <in png> <out png> 0 <x,y,w,h> [...]                 on a keyed picture: the pixels inside the rectangles become transparent (single stray pixels)
// Flatten first, quantise, then key: keying a picture that still has the page's noise leaves ragged edges.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , mode, inFile, outFile, tolerance, ...rest] = process.argv;
if (!['flatten', 'key', 'preview', 'trim', 'erase'].includes(mode) || !outFile || tolerance === undefined) throw new Error('usage: cutout.mjs flatten|key <in png> <out png> <tolerance> [...]');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const result = await page.evaluate(async ({ url, mode, tol, rest }) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  if (mode === 'preview') {
    const k = Number(tol), p = document.createElement('canvas'); p.width = img.width * k; p.height = img.height * k;
    const pg = p.getContext('2d'); pg.imageSmoothingEnabled = false; pg.fillStyle = rest[0] ?? '#556'; pg.fillRect(0, 0, p.width, p.height); pg.drawImage(img, 0, 0, p.width, p.height);
    return { png: p.toDataURL('image/png'), info: `${p.width} x ${p.height} px` };
  }
  if (mode === 'erase') {
    for (const r of rest) { const [x, y, w, h] = r.split(',').map(Number); g.clearRect(x, y, w, h); }
    return { png: c.toDataURL('image/png'), info: `${rest.length} rectangles erased` };
  }
  if (mode === 'trim') {
    const data = g.getImageData(0, 0, c.width, c.height), d = data.data, W = c.width, H = c.height, kill = [];
    const clear = (x, y) => x < 0 || y < 0 || x >= W || y >= H || d[(y * W + x) * 4 + 3] === 0;
    for (const r of rest) {
      const [rx, ry, rw, rh] = r.split(',').map(Number);
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] === 0 || (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) <= tol) continue;
        if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) kill.push(i);
      }
    }
    for (const i of kill) d[i + 3] = 0;
    g.putImageData(data, 0, 0);
    return { png: c.toDataURL('image/png'), info: `${kill.length} edge pixels removed` };
  }
  const data = g.getImageData(0, 0, c.width, c.height), d = data.data, bg = [d[(10 * c.width + 10) * 4], d[(10 * c.width + 10) * 4 + 1], d[(10 * c.width + 10) * 4 + 2]];
  const near = i => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) <= tol;
  if (mode === 'flatten') {
    for (let i = 0; i < d.length; i += 4) if (near(i)) { d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; }
    g.putImageData(data, 0, 0);
    g.fillStyle = `rgb(${bg.join(',')})`;
    for (const r of rest) { const [x, y, w, h] = r.split(',').map(Number); g.fillRect(x, y, w, h); }
    return { png: c.toDataURL('image/png'), info: `page colour rgb(${bg.join(',')})` };
  }
  const margin = Number(rest[0] ?? 2);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; const colours = new Set();
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (near(i)) { d[i + 3] = 0; continue; }
    colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  g.putImageData(data, 0, 0);
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin); x1 = Math.min(c.width - 1, x1 + margin); y1 = Math.min(c.height - 1, y1 + margin);
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { png: out.toDataURL('image/png'), info: `${out.width} x ${out.height} px (cropped from ${c.width} x ${c.height} at ${x0},${y0}), ${colours.size} colours` };
}, { url: 'data:image/png;base64,' + readFileSync(inFile).toString('base64'), mode, tol: Number(tolerance), rest });
writeFileSync(outFile, Buffer.from(result.png.slice(result.png.indexOf(',') + 1), 'base64'));
console.log(result.info);
await browser.close();
