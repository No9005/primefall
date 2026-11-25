// Pastes a part of one picture into another, pixel exact: a rectangle of the overlay (mirrored if asked, scaled with nearest neighbour), with the colour of the
// overlay's flat page keyed out so that only the part itself lands on the base.
//   node paste.mjs <base png> <overlay png> <out png> <src x,y,w,h> <dest x,y> [scale] [mirror] [tolerance]
// `dest` is where the top left corner of the (mirrored, scaled) part lands in the base. The page colour is taken from the overlay's pixel (10, 10); every pixel within
// `tolerance` (default 40, a distance in RGB) of it becomes transparent.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , baseFile, overlayFile, outFile, src, dest, scale = '1', mirror = 'no', tolerance = '40'] = process.argv;
if (!dest) throw new Error('usage: paste.mjs <base png> <overlay png> <out png> <src x,y,w,h> <dest x,y> [scale] [mirror] [tolerance]');
const url = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const png = await page.evaluate(async ({ base, overlay, src, dest, scale, mirror, tolerance }) => {
  const load = async u => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const [B, O] = [await load(base), await load(overlay)];
  const [sx, sy, sw, sh] = src.split(',').map(Number), [dx, dy] = dest.split(',').map(Number), S = Number(scale);
  const probe = document.createElement('canvas'); probe.width = O.width; probe.height = O.height;
  const pg = probe.getContext('2d', { willReadFrequently: true }); pg.drawImage(O, 0, 0);
  const key = pg.getImageData(10, 10, 1, 1).data;
  const part = document.createElement('canvas'); part.width = sw; part.height = sh;
  const g = part.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  if (mirror === 'mirror') { g.translate(sw, 0); g.scale(-1, 1); }
  g.drawImage(O, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = g.getImageData(0, 0, sw, sh);
  for (let i = 0; i < data.data.length; i += 4) {
    const d = Math.hypot(data.data[i] - key[0], data.data[i + 1] - key[1], data.data[i + 2] - key[2]);
    if (d < Number(tolerance)) data.data[i + 3] = 0;
  }
  g.putImageData(data, 0, 0);
  const c = document.createElement('canvas'); c.width = B.width; c.height = B.height;
  const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; cg.drawImage(B, 0, 0);
  cg.drawImage(part, Math.round(dx), Math.round(dy), Math.round(sw * S), Math.round(sh * S));
  return c.toDataURL('image/png');
}, { base: url(baseFile), overlay: url(overlayFile), src, dest, scale, mirror, tolerance });
writeFileSync(outFile, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
await browser.close();
