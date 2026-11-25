// A self-contained HTML page that plays a guide clip and its restyled result side by side (pause and play button).
//   node player.mjs <result folder> <out html> <clip label> <frames> <ms per frame>
// Same inputs as flicker.mjs. Open the html in a browser; it carries its own pictures.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , dir, out, clip, count, ms] = process.argv;
const N = Number(count), MS = Number(ms), guideDir = process.env.COMFY_INPUT ?? process.env.HOME + '/claude-home/code/ComfyUI/input';
if (!dir || !out || !clip || !N || !MS) throw new Error('usage: player.mjs <result folder> <out html> <clip label> <frames> <ms per frame>');
const url = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const guides = [], results = [];
for (let i = 0; i < N; i++) { guides.push(url(`${guideDir}/tilly-guide-${clip}-${i}.png`)); results.push(url(`${dir}/${clip}-${i}-big-seed1.png`)); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
// two strips of N frames, the figure cropped, at half of the 8x render
const strips = await page.evaluate(async ({ guides, results }) => {
  const CROP = [60, 30, 840, 990], W = 210, H = 240;
  const strip = async list => {
    const c = document.createElement('canvas'); c.width = W * list.length; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    for (const [i, u] of list.entries()) { const im = new Image(); im.src = u; await im.decode(); g.drawImage(im, ...CROP, i * W, 0, W, H); }
    return c.toDataURL('image/png');
  };
  return [await strip(guides), await strip(results)];
}, { guides, results });
await browser.close();

writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>${clip}: guide and restyled</title>
<body style="margin:0;background:#1a1d22;color:#cfd8dc;font:14px system-ui;padding:16px">
<h3>${clip}, ${N} frames at ${MS} ms: guide (left) and restyled (right)</h3>
<canvas id="a" width="210" height="240"></canvas> <canvas id="b" width="210" height="240"></canvas>
<p><button id="t">pause</button> frame <span id="n">0</span></p>
<script>
const imgs=[new Image(),new Image()];imgs[0].src='${strips[0]}';imgs[1].src='${strips[1]}';
const cs=['a','b'].map(id=>document.getElementById(id).getContext('2d'));let f=0,run=true,last=performance.now();
document.getElementById('t').onclick=e=>{run=!run;e.target.textContent=run?'pause':'play'};
function tick(){const now=performance.now();if(run&&now-last>=${MS}){last=now;f=(f+1)%${N};}
 cs.forEach((g,i)=>{g.imageSmoothingEnabled=false;g.clearRect(0,0,210,240);g.drawImage(imgs[i],f*210,0,210,240,0,0,210,240);});
 document.getElementById('n').textContent=f;requestAnimationFrame(tick);}
Promise.all(imgs.map(i=>i.decode())).then(()=>requestAnimationFrame(tick));
</script>`);
