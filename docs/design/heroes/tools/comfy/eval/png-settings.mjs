// Prints what made a ComfyUI picture: the workflow ComfyUI embeds in every png it saves (the `prompt` text chunk).
//   node png-settings.mjs <png> [<png> ...]
// Shows the models and LoRAs (with strengths), the sampler (seed, steps, cfg, denoise), ControlNet and IP-Adapter settings, the input pictures and both prompts.
import { readFileSync } from 'node:fs';

function textChunks(buffer) {
  const chunks = {};
  for (let at = 8; at < buffer.length;) {
    const length = buffer.readUInt32BE(at), type = buffer.toString('ascii', at + 4, at + 8);
    if (type === 'tEXt') { const data = buffer.subarray(at + 8, at + 8 + length), zero = data.indexOf(0); chunks[data.toString('latin1', 0, zero)] = data.toString('utf8', zero + 1); }
    at += 12 + length;
  }
  return chunks;
}
for (const file of process.argv.slice(2)) {
  console.log(`\n== ${file}`);
  const chunks = textChunks(readFileSync(file));
  if (!chunks.prompt) { console.log('  no embedded workflow (not saved by ComfyUI, or the metadata was stripped)'); continue; }
  const flow = JSON.parse(chunks.prompt), by = type => Object.values(flow).filter(n => n.class_type === type);
  const show = (label, value) => value !== undefined && console.log(`  ${label}: ${value}`);
  for (const n of by('CheckpointLoaderSimple')) show('checkpoint', n.inputs.ckpt_name);
  for (const n of by('UNETLoader')) show('unet', n.inputs.unet_name);
  for (const n of by('LoraLoader')) show('lora', `${n.inputs.lora_name} (model ${n.inputs.strength_model}, clip ${n.inputs.strength_clip})`);
  for (const n of by('KSampler')) show('sampler', `seed ${n.inputs.seed}, ${n.inputs.steps} steps, cfg ${n.inputs.cfg}, ${n.inputs.sampler_name}/${n.inputs.scheduler}, denoise ${n.inputs.denoise}`);
  for (const n of by('ControlNetLoader')) show('controlnet', n.inputs.control_net_name);
  for (const n of by('SetUnionControlNetType')) show('control type', n.inputs.type);
  for (const n of by('ControlNetApplyAdvanced')) show('control strength', `${n.inputs.strength} (from ${n.inputs.start_percent} to ${n.inputs.end_percent})`);
  for (const n of by('IPAdapterAdvanced')) show('ip-adapter', `weight ${n.inputs.weight}, ${n.inputs.weight_type}`);
  for (const n of by('LoadImage')) show('input picture', n.inputs.image);
  for (const n of by('LoadImageMask')) show('mask', n.inputs.image);
  for (const n of by('EmptyLatentImage')) show('latent', `${n.inputs.width} x ${n.inputs.height} (text to image)`);
  const texts = by('CLIPTextEncode').map(n => n.inputs.text).filter(t => typeof t === 'string');
  texts.forEach((t, i) => show(i === 0 ? 'prompt' : 'prompt ' + (i + 1), t.length > 400 ? t.slice(0, 400) + ' ...' : t));
}
