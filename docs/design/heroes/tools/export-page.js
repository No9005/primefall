// Runs in the browser page that export.mjs opens. RIGS is defined before this file: { bruiser, controller, assassin }.
// exportHero() renders every clip frame by frame, trims the frames, drops repeated ones and packs one sheet per clip.

function trimBox(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function frameKey(data, w, box) {
  let a = 2166136261, b = 5381;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
    const j = (y * w + x) * 4;
    for (let k = 0; k < 4; k++) { a = Math.imul(a ^ data[j + k], 16777619); b = (Math.imul(b, 33) + data[j + k]) | 0; }
  }
  return [box.x, box.y, box.w, box.h, a >>> 0, b >>> 0].join(':');
}

// Shelf packing, tallest frames first. Pixel (0, 0) stays transparent: it is the shared empty frame.
function pack(frames) {
  const area = frames.reduce((s, f) => s + (f.box.w + 1) * (f.box.h + 1), 0);
  let width = 64; while (width < 2048 && width * width < area * 1.25) width *= 2;
  const order = frames.slice().sort((p, q) => q.box.h - p.box.h);
  let x = 2, y = 0, shelf = 1;
  for (const f of order) {
    if (x + f.box.w > width) { x = 0; y += shelf + 1; shelf = 0; }
    f.at = { x, y }; x += f.box.w + 1; shelf = Math.max(shelf, f.box.h);
  }
  return { width, height: y + shelf };
}

function exportClip(hero, rig, d) {
  const { SW, SH, OX, OY, FRAME, LAYERS, layerCtx } = rig;
  const steps = Math.round(d.dur / FRAME), count = steps + (d.endFrame ? 1 : 0);
  // A loop whose length is not a multiple of the frame time is sampled evenly, so it closes without a hitch.
  const step = d.loop ? d.dur / steps : FRAME;
  const unique = [], byKey = new Map(), timeline = {}, shake = [], ringRed = [], ringAlpha = [];
  for (const layer of LAYERS) timeline[layer] = [];
  for (let i = 0; i < count; i++) {
    const meta = rig.renderLayers(d, i, step);
    shake.push(meta.shake); ringRed.push(meta.ringRed); ringAlpha.push(meta.ringAlpha);
    for (const layer of LAYERS) {
      const img = layerCtx[layer].getImageData(0, 0, SW, SH), box = trimBox(img.data, SW, SH);
      if (!box) { timeline[layer].push(null); continue; }
      const key = frameKey(img.data, SW, box);
      if (!byKey.has(key)) {
        const c = document.createElement('canvas'); c.width = box.w; c.height = box.h;
        c.getContext('2d').putImageData(img, -box.x, -box.y, box.x, box.y, box.w, box.h);
        byKey.set(key, unique.length); unique.push({ box, canvas: c });
      }
      timeline[layer].push(byKey.get(key));
    }
  }
  const size = pack(unique);
  const sheet = document.createElement('canvas'); sheet.width = size.width; sheet.height = size.height;
  const sctx = sheet.getContext('2d');
  const prefix = hero + '.' + d.name + '.', anchor = { x: OX / SW, y: OY / SH }, frames = {};
  frames[prefix + 'empty'] = { frame: { x: 0, y: 0, w: 1, h: 1 }, rotated: false, trimmed: true, spriteSourceSize: { x: OX, y: OY, w: 1, h: 1 }, sourceSize: { w: SW, h: SH }, anchor };
  unique.forEach((f, k) => {
    sctx.drawImage(f.canvas, f.at.x, f.at.y);
    frames[prefix + String(k).padStart(3, '0')] = {
      frame: { x: f.at.x, y: f.at.y, w: f.box.w, h: f.box.h }, rotated: false, trimmed: true,
      spriteSourceSize: { x: f.box.x, y: f.box.y, w: f.box.w, h: f.box.h }, sourceSize: { w: SW, h: SH }, anchor
    };
  });
  const animations = {}, layers = [];
  for (const layer of LAYERS) {
    if (timeline[layer].every(k => k === null)) continue;
    layers.push(layer);
    animations[prefix + layer] = timeline[layer].map(k => prefix + (k === null ? 'empty' : String(k).padStart(3, '0')));
  }
  const json = { frames, animations, meta: { app: 'primefall pixel-heroes export', version: '1', image: d.name + '.png', format: 'RGBA8888', size: { w: size.width, h: size.height }, scale: '1' } };
  const entry = { name: d.name, label: d.label, sheet: d.name + '.json', frames: count, frameMs: Number(step.toFixed(3)), durationMs: d.dur, loop: d.loop, layers };
  if (shake.some(s => s[0] || s[1])) entry.shake = shake;
  if (ringRed.some(Boolean)) entry.ringRedFrames = ringRed.map((r, i) => (r ? i : -1)).filter(i => i >= 0);
  if (ringAlpha.some(a => a !== 1)) entry.ringAlpha = ringAlpha;
  return { name: d.name, png: sheet.toDataURL('image/png'), json, entry, uniqueFrames: unique.length };
}

function exportHero(hero) {
  const rig = RIGS[hero];
  const clips = rig.EXPORT_CLIPS.map(d => exportClip(hero, rig, d));
  const manifest = {
    hero, frame: { w: rig.SW, h: rig.SH }, anchor: { x: rig.OX, y: rig.OY }, fps: 1000 / rig.FRAME, frameMs: rig.FRAME,
    layers: rig.LAYERS, clips: clips.map(c => c.entry)
  };
  return { manifest, clips: clips.map(c => ({ name: c.name, png: c.png, json: c.json, uniqueFrames: c.uniqueFrames })) };
}

// One still per clip with tile and ring, for people to look at.
function overview(hero) {
  const rig = RIGS[hero], cols = 5, cw = rig.SW * 2, ch = rig.SH * 2 + 18, list = rig.EXPORT_CLIPS;
  const out = document.createElement('canvas'); out.width = cols * cw; out.height = Math.ceil(list.length / cols) * ch;
  const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false;
  octx.fillStyle = '#0e1114'; octx.fillRect(0, 0, out.width, out.height);
  const cell = document.createElement('canvas'); cell.width = rig.SW; cell.height = rig.SH;
  const cctx = cell.getContext('2d');
  list.forEach((d, i) => {
    rig.selRender(cctx, d.clip, d.still);
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    octx.drawImage(cell, x, y, cw, rig.SH * 2);
    octx.fillStyle = '#93a19f'; octx.font = '11px monospace'; octx.fillText(d.name + '  ' + d.still + ' ms', x + 8, y + rig.SH * 2 + 12);
  });
  return out.toDataURL('image/png');
}
