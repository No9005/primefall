// Runs in the browser page that `export.mjs --hangar` opens (after export-page.js, whose trimBox, frameKey and pack it reuses). It renders the
// hangar clips of one Hero (HANGAR_EXPORT of the rig) into one atlas in the format of apps/web/scripts/ATLAS.md: one animation per clip and
// layer (`<hero>.<clip>` is the figure, `.fx_back` and `.fx_front` the effects; each has the same frames), the bridges as one animation of
// frames that show everything at once (`hero` is the name of the Hero in the hangar, `rigName` that of the rig), the anchor at the middle of the bottom edge of the frame.

// How long each of the two frames of a bridge stands (BRIDGE_FRAME_MS of hangar-select.ts).
const BRIDGE_FRAME_MS = 85;

function exportHangar(rigName, hero) {
  const rig = RIGS[rigName], { SW, SH, LAYERS, layerCtx, HANGAR_EXPORT: H } = rig;
  const unique = [], byKey = new Map(), animations = {}, clips = {};
  const take = canvasCtx => {
    const img = canvasCtx.getImageData(0, 0, SW, SH), box = trimBox(img.data, SW, SH);
    if (!box) return null;
    const key = frameKey(img.data, SW, box);
    if (!byKey.has(key)) {
      const c = document.createElement('canvas'); c.width = box.w; c.height = box.h;
      c.getContext('2d').putImageData(img, -box.x, -box.y, box.x, box.y, box.w, box.h);
      byKey.set(key, unique.length); unique.push({ box, canvas: c });
    }
    return byKey.get(key);
  };
  const name = k => hero + '.' + String(k).padStart(3, '0');
  const render = (clip, t) => rig.renderLayers({ clip, t0: t, loop: false, dur: 1 }, 0, 0);
  const flat = document.createElement('canvas'); flat.width = SW; flat.height = SH;
  const flatCtx = flat.getContext('2d', { willReadFrequently: true });

  for (const d of H.list) {
    const timeline = {}; for (const layer of LAYERS) timeline[layer] = [];
    for (let i = 0; i < d.frames; i++) {
      const t = d.from + (d.to - d.from) * (d.loop ? i / d.frames : i / Math.max(1, d.frames - 1));
      render(d.clip, t);
      for (const layer of LAYERS) timeline[layer].push(take(layerCtx[layer]));
    }
    for (const layer of LAYERS) {
      if (timeline[layer].every(k => k === null)) continue;
      const animation = hero + '.' + d.name + (layer === 'figure' ? '' : '.' + layer);
      animations[animation] = timeline[layer].map(k => (k === null ? hero + '.empty' : name(k)));
      clips[animation] = { frames: d.frames, durationMs: d.ms };
    }
  }
  // Bridges: the two frames on the way from a moment of the action into the ready pose, all layers in one picture.
  const bridge = [];
  for (const b of H.bridges) {
    render(b.clip, b.t);
    flatCtx.setTransform(1, 0, 0, 1, 0, 0); flatCtx.clearRect(0, 0, SW, SH);
    for (const layer of ['fx_back', 'figure', 'fx_front']) flatCtx.drawImage(layerCtx[layer].canvas, 0, 0);
    bridge.push(take(flatCtx));
  }
  animations[hero + '.bridge.act'] = bridge.map(k => (k === null ? hero + '.empty' : name(k)));
  clips[hero + '.bridge.act'] = { frames: bridge.length, durationMs: bridge.length * BRIDGE_FRAME_MS };

  const size = pack(unique), sheet = document.createElement('canvas'); sheet.width = size.width; sheet.height = size.height;
  const sctx = sheet.getContext('2d'), frames = {}, anchor = { x: .5, y: 1 };
  frames[hero + '.empty'] = { frame: { x: 0, y: 0, w: 1, h: 1 }, rotated: false, trimmed: true, spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 }, sourceSize: { w: SW, h: SH }, anchor };
  unique.forEach((f, k) => {
    sctx.drawImage(f.canvas, f.at.x, f.at.y);
    frames[name(k)] = { frame: { x: f.at.x, y: f.at.y, w: f.box.w, h: f.box.h }, rotated: false, trimmed: true, spriteSourceSize: { x: f.box.x, y: f.box.y, w: f.box.w, h: f.box.h }, sourceSize: { w: SW, h: SH }, anchor };
  });
  const json = { frames, animations, meta: { image: hero + '.png', size: { w: size.width, h: size.height }, scale: '1', format: 'RGBA8888', clips } };
  return { png: sheet.toDataURL('image/png'), json, uniqueFrames: unique.length };
}
