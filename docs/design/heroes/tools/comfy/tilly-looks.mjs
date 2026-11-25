// Step 1 of TESTPLAN.md: candidates for Tilly's look from her description alone, on a flat magenta page (easy to key out later).
//   node docs/design/heroes/tools/comfy/tilly-looks.mjs [--out <folder>] [--only A,B] [--round 1|2]
// Text to image with SDXL and the pixel-art LoRA through the ComfyUI API (127.0.0.1:8188 or COMFYUI_URL); no template picture, no sprite sheet.
// The description is the one agreed in the chat (see TESTPLAN.md). Candidates differ in seed and LoRA strength; edit CANDIDATES to try others.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const server = (process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const out = resolve(flag('--out', 'tilly-looks'));
const only = flag('--only', '')?.split(',').filter(Boolean);

// Round 1: plain wording. Result: a detailed pixel-art style, but no third arm, a cannon instead of the robot arm in two pictures, mostly teal clothes, the magenta page ignored (grey).
const DESCRIPTION_1 = [
  'detailed pixel art character sprite, 16-bit game art, full body, whole figure visible from head to boots, centered, standing relaxed, facing slightly right',
  'young woman engineer, three heads tall, chunky proportions, big head, broad shoulders, short legs',
  'brown hair tied back in a ponytail that hangs behind her, teal glowing goggles pushed up on her forehead, tan skin, small red mouth',
  'frayed torn orange sleeveless top, light grey metal chest plate with a glowing teal reactor core in the middle, angular grey shoulder plates',
  'her right arm is a grey robotic arm with a blocky claw hand and teal accents, her left arm is bare skin with a torn orange sleeve and a grey cuff with a teal emitter at the wrist',
  'a long mechanical grey third arm with three segments, teal glowing joints and a two-pronged pincer rises from her back over her shoulder',
  'patched grey-brown trousers with rips, dark brown boots, a small grey generator pack on her back',
  'black outline, rich shading, metal highlights, warm earthy palette with cool teal accents',
  'plain flat solid magenta background, nothing else in the picture',
].join(', ');
const NEGATIVE_1 = 'blurry, photo, realistic, 3d render, extra limbs, extra arms, extra hands, deformed hands, text, watermark, gradient background, floor, shadow, anti-aliasing, cropped, cut off, multiple characters';
// Round 2: key parts weighted (word:1.3) and the teal cut down. Result: worse than round 1 (technical armour, cropped bodies, magenta in the clothes).
const DESCRIPTION_2 = [
  'single character, one figure only, front view, detailed pixel art character sprite, 16-bit game art, full body, whole figure visible from head to boots, centered',
  'young woman engineer, three heads tall, chunky proportions, big head, broad shoulders, short legs, standing relaxed',
  'brown hair tied back in a ponytail, (goggles pushed up on her forehead with glowing teal lenses:1.2), tan skin, small red mouth',
  '(frayed torn orange sleeveless top:1.3), (light grey metal chest plate with one glowing teal reactor core in the middle:1.2), angular grey shoulder plates',
  '(her right arm is a grey robotic arm with a blocky claw hand:1.3), her left arm is bare skin with a torn orange sleeve and a small grey cuff',
  '(a long mechanical grey third arm with three segments and a two-pronged pincer rises from her back over her shoulder, high above her head:1.4)',
  'patched grey-brown trousers, dark brown boots, a small grey generator pack on her back',
  'black outline, rich shading, metal highlights, warm earthy palette, orange and grey and brown, only small teal accents',
  '(plain flat solid magenta background:1.3), nothing else in the picture',
].join(', ');
const NEGATIVE_2 = 'blurry, photo, realistic, 3d render, extra limbs, extra hands, deformed hands, text, watermark, gradient background, grey background, floor, shadow, anti-aliasing, cropped, cut off, multiple characters, two views, back view, turnaround sheet, teal trousers, teal top, cannon, gun, weapon';
const ROUND = Number(flag('--round', '1'));
const DESCRIPTION = ROUND === 2 ? DESCRIPTION_2 : DESCRIPTION_1, NEGATIVE = ROUND === 2 ? NEGATIVE_2 : NEGATIVE_1;
const CANDIDATES = {
  A: { seed: 11, lora: 0.9 },
  B: { seed: 22, lora: 0.9 },
  C: { seed: 33, lora: ROUND === 2 ? 0.7 : 0.6 },
  D: { seed: 44, lora: ROUND === 2 ? 0.7 : 0.6 },
};

const api = async (path, init) => {
  const response = await fetch(server + path, init);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response;
};
await api('/system_stats').catch(() => { throw new Error(`ComfyUI is not reachable at ${server} (start it with start-comfyui.sh)`); });
await mkdir(out, { recursive: true });
const base = JSON.parse(await readFile(join(here, 'tilly-look.json'), 'utf8'));

for (const [name, c] of Object.entries(CANDIDATES)) {
  if (only?.length && !only.includes(name)) continue;
  const flow = structuredClone(base);
  flow['8'].inputs.text = DESCRIPTION; flow['9'].inputs.text = NEGATIVE;
  flow['19'].inputs.seed = c.seed; flow['3'].inputs.strength_model = c.lora; flow['3'].inputs.strength_clip = c.lora;
  flow['22'].inputs.filename_prefix = `tilly-look/${name}`;
  const { prompt_id: id } = await (await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: flow }) })).json();
  let entry;
  while (!(entry = (await (await api(`/history/${id}`)).json())[id]) || !entry.status?.completed) {
    if (entry?.status?.status_str === 'error') throw new Error(`${name}: ${JSON.stringify(entry.status.messages.at(-1))}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  for (const image of entry.outputs['22']?.images ?? []) {
    const bytes = Buffer.from(await (await api(`/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${image.type}`)).arrayBuffer());
    await writeFile(join(out, `${name}-seed${c.seed}-lora${c.lora}.png`), bytes);
  }
  console.log(`${name} (seed ${c.seed}, LoRA ${c.lora}) done`);
}
