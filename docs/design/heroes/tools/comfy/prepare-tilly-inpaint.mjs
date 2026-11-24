// Makes the inputs of the Tilly pose workflows (tilly-pose-inpaint.json, tilly-pose-controlnet.json) and copies them into ComfyUI's input folder:
//   node docs/design/heroes/tools/comfy/prepare-tilly-inpaint.mjs [<comfyui input folder>]
// `tilly-source.png` is Tilly's idle frame of the hangar atlas on a flat grey page of 1024 x 1024 (SDXL does not like transparency), scaled 8x.
// The masks are white where the model may repaint: `arms` (her left arm and the third arm, the right half of the frame), `upper` (everything above
// her hips), `arm3` (the space above her shoulders where the third arm moves) and `figure` (the whole figure box, for a new pose with the ControlNet
// workflow). A mask much larger than the part to change makes the inpaint workflow paint a whole new figure. `tilly-blank.png` is a flat grey page.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..', '..');
const atlas = join(root, 'apps', 'web', 'public', 'assets', 'hangar', 'atlas');
const inputDir = process.argv[2] ?? join(process.env.HOME, 'claude-home', 'code', 'ComfyUI', 'input');
const chromium = (() => { try { return require('@playwright/test').chromium; } catch { return require('playwright').chromium; } })();

const json = JSON.parse(await readFile(join(atlas, 'tilly.json'), 'utf8'));
const sheet = 'data:image/png;base64,' + (await readFile(join(atlas, 'tilly.png'))).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  const out = await page.evaluate(async ({ json, sheet }) => {
    const img = new Image(); img.src = sheet; await img.decode();
    const SIZE = 1024, Z = 8, FW = 136, FH = 116, FEET = { x: 58, y: 112 };
    const ox = Math.round(SIZE / 2 - FEET.x * Z), oy = Math.round(SIZE - 30 - FEET.y * Z);   // the feet 30 px above the bottom, her middle on the page's middle
    const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; };
    const source = canvas(), g = source.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE);
    const name = json.animations['tilly.idle'][0], f = json.frames[name];
    g.drawImage(img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, ox + f.spriteSourceSize.x * Z, oy + f.spriteSourceSize.y * Z, f.frame.w * Z, f.frame.h * Z);
    const mask = (x0, y0, x1, y1) => {
      const c = canvas(), m = c.getContext('2d'); m.fillStyle = '#000'; m.fillRect(0, 0, SIZE, SIZE);
      m.fillStyle = '#fff'; m.fillRect(ox + x0 * Z, oy + y0 * Z, (x1 - x0) * Z, (y1 - y0) * Z);
      return c.toDataURL('image/png');
    };
    return { source: source.toDataURL('image/png'), arms: mask(60, 0, FW, 104), upper: mask(0, 0, FW, 78), arm3: mask(44, 0, 124, 72), figure: mask(-30, 0, 136, 116), blank: (() => { const c = canvas(), b = c.getContext('2d'); b.fillStyle = '#808080'; b.fillRect(0, 0, SIZE, SIZE); return c.toDataURL('image/png'); })() };
  }, { json, sheet });
  await mkdir(inputDir, { recursive: true });
  for (const [key, file] of [['source', 'tilly-source.png'], ['arms', 'tilly-mask-arms.png'], ['upper', 'tilly-mask-upper.png'], ['arm3', 'tilly-mask-arm3.png'], ['figure', 'tilly-mask-figure.png'], ['blank', 'tilly-blank.png']]) {
    await writeFile(join(inputDir, file), Buffer.from(out[key].slice(out[key].indexOf(',') + 1), 'base64'));
    console.log('wrote', join(inputDir, file));
  }
} finally {
  await browser.close();
}
