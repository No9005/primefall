// Frame-to-frame change of a restyled clip against its rig guides, and a contact sheet (guide on top, result below, 8 columns).
//   node flicker.mjs <result folder> <contact sheet png> <clip label> <frames>
// Expects <folder>/<clip>-<i>-big-seed1.png (tilly-poses.mjs) and ComfyUI/input/tilly-guide-<clip>-<i>.png (render-pose-guides.mjs; COMFY_INPUT
// overrides the folder). The change is the mean absolute difference of two following frames (0 to 255, on 1/4 scale), the last against the first
// counts as the loop seam. The restyle adds flicker when its number is above the guide's: ratio 1.0 is no added flicker.
// Prototype from the first manual round: the crop is fixed for the 1024 px, 8x guides; acceptance thresholds are still to be worked out.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , dir, out, clip, count] = process.argv;
const N = Number(count), guideDir = process.env.COMFY_INPUT ?? process.env.HOME + '/claude-home/code/ComfyUI/input';
if (!dir || !out || !clip || !N) throw new Error('usage: flicker.mjs <result folder> <contact sheet png> <clip label> <frames>');
const url = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const guides = [], results = [];
for (let i = 0; i < N; i++) { guides.push(url(`${guideDir}/tilly-guide-${clip}-${i}.png`)); results.push(url(`${dir}/${clip}-${i}-big-seed1.png`)); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
const res = await page.evaluate(async ({ guides, results }) => {
  const CROP = [60, 30, 840, 990], SCALE = 0.25;
  const grab = list => Promise.all(list.map(async u => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = CROP[2] * SCALE; c.height = CROP[3] * SCALE;
    c.getContext('2d').drawImage(img, ...CROP, 0, 0, c.width, c.height);
    return c;
  }));
  const diff = (a, b) => {
    const A = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, B = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < A.length; i += 4) { sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; n++; }
    return sum / n;
  };
  const [g, r] = await Promise.all([grab(guides), grab(results)]);
  const change = list => list.map((c, i) => diff(c, list[(i + 1) % list.length]));
  const W = g[0].width, H = g[0].height, cols = 8, rows = Math.ceil(g.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = cols * W; sheet.height = rows * 2 * H;
  const ctx = sheet.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, sheet.width, sheet.height); ctx.font = '11px sans-serif'; ctx.fillStyle = '#fff';
  g.forEach((c, i) => { const x = (i % cols) * W, y = Math.floor(i / cols) * 2 * H; ctx.drawImage(c, x, y); ctx.drawImage(r[i], x, y + H); ctx.fillText(String(i), x + 3, y + 11); });
  return { guide: change(g), result: change(r), sheet: sheet.toDataURL('image/png') };
}, { guides, results });
const mean = a => a.reduce((x, y) => x + y, 0) / a.length, fixed = x => x.toFixed(2);
console.log(`mean frame-to-frame change (0-255): guide ${fixed(mean(res.guide))}  result ${fixed(mean(res.result))}  ratio ${fixed(mean(res.result) / mean(res.guide))}`);
console.log(`max: result ${fixed(Math.max(...res.result))}  guide ${fixed(Math.max(...res.guide))}   loop seam (last to first): result ${fixed(res.result[N - 1])}  guide ${fixed(res.guide[N - 1])}`);
writeFileSync(out, Buffer.from(res.sheet.slice(res.sheet.indexOf(',') + 1), 'base64'));
await browser.close();
