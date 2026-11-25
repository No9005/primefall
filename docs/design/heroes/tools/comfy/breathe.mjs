// Breathing idle for the pixel-art Tilly, made from the single cleaned picture (no model): rows of the picture are moved and squeezed with easing curves,
// sampled with nearest neighbour, so the palette and the hard pixels stay exact. Feet stay fixed; the upper body rises on the inhale (the torso stretches),
// sinks below its rest on the exhale (it squashes); head, hair and the long arm follow through on a damped spring and overshoot.
//   node breathe.mjs <tilly-clean.png> <out dir> [frames=40]
// Writes <out dir>/frames/f00.png ..., sheet.png (all frames side by side, 4x) and prints the numbers. Looks and amounts are constants below.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , inFile, outDir, framesArg] = process.argv;
if (!outDir) throw new Error('usage: breathe.mjs <tilly-clean.png> <out dir> [frames]');
const FRAMES = Number(framesArg ?? 40);
// Rows of tilly-clean.png (209 x 315): neck / shoulders / belt / hips.
const P = { neck: 112, shoulder: 122, hip: 200, chestTop: 118, chestBottom: 190, centreX: 78,
  rise: 11,         // px the shoulders go up at the full inhale (the head goes up by this plus the follow-through)
  squash: 0.6,      // the exhale sinks to this fraction of the rise below rest
  chestX: 6,        // px the chest widens at each side at the full inhale
  lag: 4.0, damping: 0.25, followThrough: 6.0, // head, hair and arm: spring lag in frames, damping ratio, extra px of overshoot
  padTop: 22, padSide: 6 };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const out = await page.evaluate(async ({ url, FRAMES, P }) => {
  const img = new Image(); img.src = url; await img.decode();
  const W = img.width, H = img.height, OW = W + 2 * P.padSide, OH = H + P.padTop;
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const sg = src.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
  const sd = sg.getImageData(0, 0, W, H).data;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  // The drive: a breath cycle, 40 % inhale (fast, eased), 60 % exhale (slower), below rest at the bottom.
  const drive = p => { const q = p % 1, lo = -P.squash;
    return q < 0.4 ? lo + (1 - lo) * (1 - Math.cos(Math.PI * q / 0.4)) / 2 : 1 - (1 - lo) * (1 - Math.cos(Math.PI * (q - 0.4) / 0.6)) / 2; };
  // The follower: a damped spring chasing the drive; the loop is taken from the settled fourth cycle.
  const w0 = 2 * Math.PI / (P.lag * 2 * Math.PI / 6.283) / 1, wn = 2 * Math.PI / (P.lag * 4), steps = 20, dt = 1 / steps;
  let x = drive(0), v = 0; const follow = [];
  for (let c = 0; c < 5; c++) for (let f = 0; f < FRAMES; f++) { for (let s = 0; s < steps; s++) { const a = wn * wn * (drive((f + s / steps) / FRAMES) - x) - 2 * P.damping * wn * v; v += a * dt; x += v * dt; } if (c === 4) follow.push(x); }
  const frames = [], sheet = document.createElement('canvas'); const K = 4; sheet.width = Math.min(FRAMES, 10) * OW * K; sheet.height = Math.ceil(FRAMES / 10) * OH * K;
  const sh = sheet.getContext('2d'); sh.imageSmoothingEnabled = false; sh.fillStyle = '#556'; sh.fillRect(0, 0, sheet.width, sheet.height);
  const rows = [];
  for (let f = 0; f < FRAMES; f++) {
    const b = drive(f / FRAMES), fo = follow[f];
    const o = document.createElement('canvas'); o.width = OW; o.height = OH; const og = o.getContext('2d'); const od = og.createImageData(OW, OH);
    let lift = 0;
    for (let y = 0; y < OH; y++) {
      const yy = y - P.padTop; // row in the source picture
      // upward shift of this output row: the torso stretches with the breath, head and arm add the spring's overshoot
      const body = P.rise * smooth(P.hip, P.shoulder, yy) * b;
      const head = P.followThrough * smooth(P.shoulder, P.neck, yy) * (fo - b);
      const up = body + head, sy = Math.round(yy + up);
      const chest = P.chestX * b * Math.sin(Math.PI * smooth(P.chestTop - 10, P.chestTop + 10, yy) * (1 - smooth(P.chestBottom - 10, P.chestBottom + 10, yy)));
      if (yy === P.shoulder) lift = up;
      if (sy < 0 || sy >= H) continue;
      for (let x = 0; x < OW; x++) {
        const xx = x - P.padSide, cx = P.centreX, scale = 1 / (1 + chest / 40), sx = Math.round(cx + (xx - cx) * scale);
        if (sx < 0 || sx >= W) continue;
        const i = (sy * W + sx) * 4, j = (y * OW + x) * 4;
        od.data[j] = sd[i]; od.data[j + 1] = sd[i + 1]; od.data[j + 2] = sd[i + 2]; od.data[j + 3] = sd[i + 3];
      }
    }
    og.putImageData(od, 0, 0); frames.push(o.toDataURL('image/png'));
    sh.drawImage(o, (f % 10) * OW * K, Math.floor(f / 10) * OH * K, OW * K, OH * K);
    rows.push({ f, drive: +b.toFixed(2), follow: +fo.toFixed(2), shoulderLiftPx: +lift.toFixed(1) });
  }
  return { frames, sheet: sheet.toDataURL('image/png'), rows, size: [OW, OH] };
}, { url: 'data:image/png;base64,' + readFileSync(inFile).toString('base64'), FRAMES, P });
mkdirSync(join(outDir, 'frames'), { recursive: true });
const save = (name, data) => writeFileSync(name, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
out.frames.forEach((d, i) => save(join(outDir, 'frames', `f${String(i).padStart(2, '0')}.png`), d));
save(join(outDir, 'sheet.png'), out.sheet);
console.log(`${FRAMES} frames of ${out.size.join(' x ')} px`);
console.log(out.rows.filter(r => r.f % 4 === 0).map(r => `f${r.f}: drive ${r.drive}, follow ${r.follow}, shoulders up ${r.shoulderLiftPx} px`).join('\n'));
await browser.close();
