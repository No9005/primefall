// Renders poses of the Controller rig as pose guides for the ControlNet of tilly-pose-controlnet.json, 1024 x 1024 on flat grey, scaled 8x:
//   node docs/design/heroes/tools/comfy/render-pose-guides.mjs [<spec> ...]
// A spec is `hangar:<clip>:<frame>` (a frame of a hangar clip of hangar-controller.js, e.g. hangar:act:13) or `rig:<clip>:<ms>` (a moment of a
// clip of the rig, e.g. rig:pulse:620). The pictures go to ComfyUI's input folder as `tilly-guide-<clip>-<frame or ms>.png`. With no spec a set
// of different poses is rendered. A new pose is a clip of the rig (tools/rigs/controller.js, tools/hangar-controller.js): draw it there first.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)), tools = join(here, '..');
const inputDir = process.env.COMFY_INPUT ?? join(process.env.HOME, 'claude-home', 'code', 'ComfyUI', 'input');
const chromium = (() => { try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; } })();
const specs = process.argv.length > 2 ? process.argv.slice(2) : ['hangar:idle:0', 'hangar:act:0', 'hangar:act:13', 'hangar:act:22', 'hangar:hold:0', 'rig:pulse:620', 'rig:tag:730', 'rig:slow:680', 'rig:drone:800'];

// The same page as export-hangar.mjs builds (the rig with the hangar frame, export-tail.js and hangar-controller.js), but it also returns the rig's clips.
const FRAME_LINE = /const SW = 136, SH = 104, OX = 58, OY = 86/;
const rig = await readFile(join(tools, 'rigs', 'controller.js'), 'utf8');
const tail = (await readFile(join(tools, 'export-tail.js'), 'utf8')).replace(/\nreturn \{ EXPORT_CLIPS[^\n]*\};\s*$/, '\n');
const hangar = await readFile(join(tools, 'hangar-controller.js'), 'utf8');
const script = 'const RIG = (() => {\n' + rig.replace(FRAME_LINE, 'const SW = 136, SH = 116, OX = 58, OY = 112') + '\n' + tail + '\n' + hangar +
  '\nreturn { LAYERS, layerCtx, renderLayers, HANGAR_EXPORT, CLIPS, SW, SH };\n})();\n' +
  `function guide(spec) {
    const [kind, name, at] = spec.split(':'), n = Number(at);
    let clip, t;
    if (kind === 'hangar') {
      const d = RIG.HANGAR_EXPORT.list.find(c => c.name === name); if (!d) throw new Error('no hangar clip ' + name);
      clip = d.clip; t = d.from + (d.to - d.from) * (d.loop ? n / d.frames : n / Math.max(1, d.frames - 1));
    } else {
      clip = RIG.CLIPS.find(c => c.id === name); if (!clip) throw new Error('no rig clip ' + name); t = n;
    }
    RIG.renderLayers({ clip, t0: t, loop: false, dur: 1 }, 0, 0);
    const Z = 8, SIZE = 1024, c = document.createElement('canvas'); c.width = c.height = SIZE;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE);
    const ox = Math.round(SIZE / 2 - 58 * Z), oy = Math.round(SIZE - 30 - 112 * Z);
    for (const layer of ['fx_back', 'figure', 'fx_front']) g.drawImage(RIG.layerCtx[layer].canvas, 0, 0, RIG.SW, RIG.SH, ox, oy, RIG.SW * Z, RIG.SH * Z);
    return c.toDataURL('image/png');
  }`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: script });
  await mkdir(inputDir, { recursive: true });
  for (const spec of specs) {
    const url = await page.evaluate(s => guide(s), spec);
    const file = join(inputDir, 'tilly-guide-' + spec.split(':').slice(1).join('-') + '.png');
    await writeFile(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    console.log(spec, '->', file);
  }
} finally {
  await browser.close();
}
