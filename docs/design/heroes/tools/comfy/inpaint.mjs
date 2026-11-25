// One inpaint edit of a picture with the SDXL inpainting UNet (tilly-inpaint-sdxl.json); everything outside the mask stays as it was.
//   node inpaint.mjs --image <png> --mask "<shape>;<shape>..." --prompt "<text>" --out <png> [--negative "<text>"] [--seed 1] [--denoise 1.0] [--grow 6] [--lora 0.6] [--cfg 6.5]
// A shape is `r:x,y,w,h` (rectangle) or `e:cx,cy,rx,ry` (ellipse), in pixels of the picture; the mask is white where the model may repaint.
// ComfyUI at 127.0.0.1:8188 or COMFYUI_URL (start-comfyui.sh). The picture and the mask are uploaded to its input folder as `edit-source.png` and `edit-mask.png`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const server = (process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const imagePath = flag('--image'), out = flag('--out'), shapes = flag('--mask'), prompt = flag('--prompt');
if (!imagePath || !out || !shapes || !prompt) throw new Error('usage: inpaint.mjs --image <png> --mask "<shapes>" --prompt "<text>" --out <png> [--negative ..] [--seed ..] [--denoise ..] [--grow ..] [--lora ..] [--cfg ..]');

const source = await readFile(resolve(imagePath));
const width = source.readUInt32BE(16), height = source.readUInt32BE(20);   // IHDR of the png

/** A grey-scale png (8 bit) with the shapes white on black. */
function maskPng() {
  const rows = [];
  const parsed = shapes.split(';').map(s => { const [kind, nums] = s.trim().split(':'); return { kind, n: nums.split(',').map(Number) }; });
  const inside = (x, y) => parsed.some(({ kind, n }) => kind === 'r' ? x >= n[0] && x < n[0] + n[2] && y >= n[1] && y < n[1] + n[3] : ((x - n[0]) / n[2]) ** 2 + ((y - n[1]) / n[3]) ** 2 <= 1);
  for (let y = 0; y < height; y++) { const row = Buffer.alloc(width + 1); for (let x = 0; x < width; x++) row[x + 1] = inside(x, y) ? 255 : 0; rows.push(row); }
  const crc = (buf) => { let c, crcTable = crc.t ??= Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); let v = 0xffffffff; for (const b of buf) v = crcTable[(v ^ b) & 255] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); t.copy(out, 4); out.writeUInt32BE(crc(t), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const api = async (path, init) => {
  const response = await fetch(server + path, init);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response;
};
await api('/system_stats').catch(() => { throw new Error(`ComfyUI is not reachable at ${server} (start it with start-comfyui.sh)`); });
const upload = async (name, bytes) => { const form = new FormData(); form.append('image', new Blob([bytes], { type: 'image/png' }), name); form.append('overwrite', 'true'); await api('/upload/image', { method: 'POST', body: form }); };
await upload('edit-source.png', source);
await upload('edit-mask.png', maskPng());

const flow = JSON.parse(await readFile(join(here, 'tilly-inpaint-sdxl.json'), 'utf8'));
flow['10'].inputs.image = 'edit-source.png'; flow['11'].inputs.image = 'edit-mask.png';
flow['8'].inputs.text = prompt;
flow['9'].inputs.text = flag('--negative', 'blurry, photo, realistic, 3d render, extra limbs, deformed hands, text, watermark, gradient background, anti-aliasing, cropped');
flow['19'].inputs.seed = Number(flag('--seed', '1')); flow['19'].inputs.denoise = Number(flag('--denoise', '1.0')); flow['19'].inputs.cfg = Number(flag('--cfg', '6.5'));
flow['12'].inputs.expand = Number(flag('--grow', '6')); flow['3'].inputs.strength_model = Number(flag('--lora', '0.6'));
const { prompt_id: id } = await (await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: flow }) })).json();
let entry;
while (!(entry = (await (await api(`/history/${id}`)).json())[id]) || !entry.status?.completed) {
  if (entry?.status?.status_str === 'error') throw new Error(JSON.stringify(entry.status.messages.at(-1)));
  await new Promise(r => setTimeout(r, 1000));
}
const image = entry.outputs['22'].images[0];
await mkdir(dirname(resolve(out)), { recursive: true });
await writeFile(resolve(out), Buffer.from(await (await api(`/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${image.type}`)).arrayBuffer()));
console.log('wrote', resolve(out));
