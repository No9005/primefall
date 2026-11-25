// Pixel clean-up of a generated figure on a flat page, the way the community does it: flat page first, then grid detection, downscale and palette reduction
// (ComfyUI-PixelArt-Detector, workflow pixel-cleanup.json), then the page keyed out and the figure cropped.
//   node pixel-cleanup.mjs --in <png> --out <png> [--colors 24] [--tol 36] [--clear "x,y,w,h;x,y,w,h"] [--margin 2] [--preview 6]
// `--tol` is the RGB distance from the page colour (the pixel at 10,10) that counts as page; `--clear` rectangles are painted with the page colour first (a floor shadow).
// Writes <out> (transparent png at the detected pixel size), <out>.flat.png (the flattened input) and <out>.preview.png (scaled for the eye). ComfyUI must be running.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const server = (process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const input = flag('--in'), out = flag('--out');
if (!input || !out) throw new Error('usage: pixel-cleanup.mjs --in <png> --out <png> [--colors 24] [--tol 36] [--clear "x,y,w,h;..."] [--margin 2] [--preview 6]');
const colors = Number(flag('--colors', '24')), tol = flag('--tol', '36'), margin = flag('--margin', '2'), preview = flag('--preview', '6');
const clear = (flag('--clear', '') ?? '').split(';').filter(Boolean);
const outPath = resolve(out), flatPath = outPath + '.flat.png', rawPath = outPath + '.grid.png';

const cutout = (...cutoutArgs) => {
  const run = spawnSync(process.execPath, [join(here, 'eval', 'cutout.mjs'), ...cutoutArgs], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || 'cutout.mjs failed');
  return run.stdout.trim();
};
const api = async (path, init) => {
  const response = await fetch(server + path, init);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response;
};
await api('/system_stats').catch(() => { throw new Error(`ComfyUI is not reachable at ${server} (start it with start-comfyui.sh)`); });
await mkdir(dirname(outPath), { recursive: true });

console.log('flatten:', cutout('flatten', resolve(input), flatPath, tol, ...clear));
const form = new FormData();
form.append('image', new Blob([await readFile(flatPath)], { type: 'image/png' }), 'cleanup-source.png'); form.append('overwrite', 'true');
await api('/upload/image', { method: 'POST', body: form });

const flow = JSON.parse(await readFile(join(here, 'pixel-cleanup.json'), 'utf8'));
flow['10'].inputs.image = 'cleanup-source.png'; flow['11'].inputs.reduce_palette_max_colors = colors;
const { prompt_id: id } = await (await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: flow }) })).json();
let entry;
while (!(entry = (await (await api(`/history/${id}`)).json())[id]) || !entry.status?.completed) {
  if (entry?.status?.status_str === 'error') throw new Error(JSON.stringify(entry.status.messages.at(-1)));
  await new Promise(r => setTimeout(r, 500));
}
const image = entry.outputs['12'].images[0];
await writeFile(rawPath, Buffer.from(await (await api(`/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${image.type}`)).arrayBuffer()));
const size = await readFile(rawPath);
console.log(`grid: ${size.readUInt32BE(16)} x ${size.readUInt32BE(20)} px after the detector (the input had the size of the flattened picture), palette reduced to at most ${colors} colours`);
console.log('key:', cutout('key', rawPath, outPath, tol, margin));
console.log('preview:', cutout('preview', outPath, outPath + '.preview.png', preview));
console.log('wrote', outPath);
