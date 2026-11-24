// The Tilly pose pipeline in one command: pose guides from the rig, then one run of the ComfyUI workflow per pose, the pictures collected in a folder.
//   node docs/design/heroes/tools/comfy/tilly-poses.mjs [--poses <spec>,<spec>...] [--out <folder>] [--seed <n>] [--workflow <file>] [--set <node>.<input>=<value> ...] [--no-prepare]
// A pose spec is `hangar:<clip>:<frame>` or `rig:<clip>:<ms>` (render-pose-guides.mjs). ComfyUI must be running (127.0.0.1:8188 or COMFYUI_URL).
// `--set` changes an input of the workflow for this run, e.g. `--set 19.denoise=0.9`, `--set 14.strength=0.7` or, for a link, `--set '19.model=["3",0]'` (a JSON value); a node's inputs are named in tilly-pose-controlnet.json.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const all = name => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const server = (process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const poses = (flag('--poses', 'rig:pulse:620,rig:tag:730,hangar:act:13,hangar:hold:0')).split(',');
const out = resolve(flag('--out', 'tilly-poses'));
const seed = Number(flag('--seed', '1'));
const workflowFile = resolve(flag('--workflow', join(here, 'tilly-pose-controlnet.json')));
const GUIDE_NODE = '10', SAMPLER_NODE = '19', SAVE_NODES = ['22', '24'];

const run = (script, scriptArgs = []) => {
  const result = spawnSync(process.execPath, [join(here, script), ...scriptArgs], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${script} failed`);
};
const api = async (path, init) => {
  const response = await fetch(server + path, init);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response;
};

if (!args.includes('--no-prepare')) {
  run('prepare-tilly-inpaint.mjs');
  run('render-pose-guides.mjs', poses);
}
await api('/system_stats').catch(() => { throw new Error(`ComfyUI is not reachable at ${server}`); });
await mkdir(out, { recursive: true });
const base = JSON.parse(await readFile(workflowFile, 'utf8'));

for (const pose of poses) {
  const name = pose.split(':').slice(1).join('-');
  const flow = structuredClone(base);
  flow[GUIDE_NODE].inputs.image = `tilly-guide-${name}.png`;
  flow[SAMPLER_NODE].inputs.seed = seed;
  for (const node of SAVE_NODES) flow[node].inputs.filename_prefix = `tilly-pose/${name}-${node === SAVE_NODES[0] ? 'big' : 'small'}`;
  for (const change of all('--set')) {
    const [path, value] = change.split('=');
    const [node, input] = path.split('.');
    if (!flow[node]?.inputs || !(input in flow[node].inputs)) throw new Error(`--set ${change}: no such input`);
    flow[node].inputs[input] = (() => { try { return JSON.parse(value); } catch { return value; } })();
  }
  const { prompt_id: id } = await (await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: flow }) })).json();
  let entry;
  while (!(entry = (await (await api(`/history/${id}`)).json())[id]) || !entry.status?.completed) {
    if (entry?.status?.status_str === 'error') throw new Error(`${pose}: ${JSON.stringify(entry.status.messages.at(-1))}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  for (const node of SAVE_NODES) for (const image of entry.outputs[node]?.images ?? []) {
    const bytes = Buffer.from(await (await api(`/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${image.type}`)).arrayBuffer());
    await writeFile(join(out, `${name}-${node === SAVE_NODES[0] ? 'big' : 'small'}-seed${seed}.png`), bytes);
  }
  console.log(`${pose} -> ${out}/${name}-big-seed${seed}.png`);
}
