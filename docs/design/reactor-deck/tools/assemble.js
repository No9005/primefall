// Builds a picture of a map from the packed atlas alone: the sheet image, its PixiJS JSON and tileset.json.
// It is the reference for how the tiles go together (which tile where, in which order, how the light is applied)
// and the check that the atlas works for any layout. It uses a 2D canvas the way a PixiJS scene would use layers.
//
// layout: rows of characters as in packages/game-core (# wall, . floor, H Half Cover, F Full Cover, P Prime Zone,
// X Outpost, S Spawn). extras names what a layout cannot say by itself (see the two layouts in export.mjs).

function assemble(image, json, tileset, layout, extras = {}) {
  const rows = layout.length, cols = layout[0].length, P = tileset.prefix, L = tileset.lighting;
  const pad = 80, top = 250;
  const W = (cols + rows) * 16 + pad * 2, H = (cols + rows) * 8 + top + 60, X0 = rows * 16 + pad, Y0 = top;
  const at = (c, r) => ({ x: X0 + (c - r) * 16, y: Y0 + (c + r) * 8 + 8 });   // centre of a tile
  const K = (c, r) => (r < 0 || r >= rows || c < 0 || c >= cols ? ' ' : layout[r][c]);
  const rnd = (a, b, c = 0) => { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const has = (list, c, r) => (list || []).some(p => p[0] === c && p[1] === r);
  const canvas = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
  const map = canvas(), glow = canvas(), light = canvas();

  const put = (ctx, name, x, y, scale = 1) => {
    const f = json.frames[P + name]; if (!f) throw new Error('no frame ' + name);
    const dx = Math.round(x - f.anchor.x * f.frame.w * scale), dy = Math.round(y - f.anchor.y * f.frame.h * scale);
    ctx.drawImage(image, f.frame.x, f.frame.y, f.frame.w, f.frame.h, dx, dy, f.frame.w * scale, f.frame.h * scale);
    // Whatever is put on the map hides the glow of what stands behind it. (In PixiJS: draw the scene a second time
    // with every non-glow sprite tinted black and add that picture on top; see the README.)
    if (ctx === map) { glow.globalCompositeOperation = 'destination-out'; glow.drawImage(image, f.frame.x, f.frame.y, f.frame.w, f.frame.h, dx, dy, f.frame.w * scale, f.frame.h * scale); glow.globalCompositeOperation = 'source-over'; }
  };
  const pick = (group, c, r, salt) => { const names = tileset.groups[group]; return names[Math.floor(rnd(c, r, salt) * names.length)]; };
  // a tile with a glowing part: the tile goes on the map, its glow on the layer above the light
  const tile = (name, c, r) => { const p = at(c, r); put(map, name, p.x, p.y); const g = tileset.sprites[name] && tileset.sprites[name].glow; if (g) put(glow, g, p.x, p.y); };
  const lights = [];
  const lamp = (kind, x, y) => lights.push({ ...L.lights[kind], x, y });

  // 1. floors and what is painted on them
  for (const [c, r, fade] of extras.ground || []) tile(pick(fade ? 'ground_fade' : 'ground', c, r, 1), c, r);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r); if (k === '#') continue;
    if (k === 'P') tile('prime_floor', c, r); else if (k === 'X') tile('outpost_floor', c, r); else if (k === 'S') tile(pick('spawn_floor', c, r, 2), c, r);
    else { const v = rnd(c, r, 3); tile(v < .12 ? pick('floor_grate', c, r, 4) : v < .3 ? pick('floor_rust', c, r, 4) : pick('floor_plate', c, r, 4), c, r); }
    if (k !== 'P') {
      const n = K(c, r - 1) === 'P', s = K(c, r + 1) === 'P', w = K(c - 1, r) === 'P', e = K(c + 1, r) === 'P';
      if (n) tile('hazard_edge_n', c, r); if (s) tile('hazard_edge_s', c, r); if (w) tile('hazard_edge_w', c, r); if (e) tile('hazard_edge_e', c, r);
      if (!n && !w && K(c - 1, r - 1) === 'P') tile('hazard_corner_nw', c, r); if (!n && !e && K(c + 1, r - 1) === 'P') tile('hazard_corner_ne', c, r);
      if (!s && !e && K(c + 1, r + 1) === 'P') tile('hazard_corner_se', c, r); if (!s && !w && K(c - 1, r + 1) === 'P') tile('hazard_corner_sw', c, r);
    }
    if (k === 'X') {
      const n = K(c, r - 1) !== 'X', s = K(c, r + 1) !== 'X', w = K(c - 1, r) !== 'X', e = K(c + 1, r) !== 'X';
      if (n && w) tile('outpost_corner_nw', c, r); if (n && e) tile('outpost_corner_ne', c, r); if (s && e) tile('outpost_corner_se', c, r); if (s && w) tile('outpost_corner_sw', c, r);
    }
  }
  for (const [c, r, axis] of extras.guides || []) tile('guide_' + axis + (rnd(c, r, 5) < (extras.deadGuides || 0) ? '_dead' : ''), c, r);
  if (extras.ring) tile('prime_ring', extras.ring[0], extras.ring[1]);

  // 2. everything that stands, back to front
  for (let sum = 0; sum <= cols + rows - 2; sum++) for (let r = 0; r < rows; r++) {
    const c = sum - r; if (c < 0 || c >= cols) continue; const k = K(c, r), p = at(c, r);
    if (has(extras.breaches, c, r)) { tile(pick('rubble', c, r, 6), c, r); put(map, pick('fern', c, r, 7), p.x - 4, p.y + 1); put(map, pick('fern', c, r, 8), p.x + 6, p.y + 4); }
    else if (k === '#') {
      const near = r === rows - 1 || c === cols - 1, open = t => t !== '#' && t !== ' ';
      if (has(extras.broken, c, r)) tile(pick('wall_broken', c, r, 9), c, r);
      else if (near) tile(pick('wall_cut', c, r, 9), c, r);
      else if (rnd(c, r, 10) < .3 && (open(K(c, r + 1)) || open(K(c + 1, r)))) { tile('wall_lamp', c, r); const q = open(K(c, r + 1)) ? at(c, r + 1) : at(c + 1, r); lamp('lamp', q.x, q.y); }
      else tile(pick('wall', c, r, 9), c, r);
    } else if (k === 'H') { tile(pick('half_cover', c, r, 11), c, r); lamp('cover', p.x, p.y); }
    else if (k === 'F') { tile('full_cover', c, r); lamp('cover', p.x, p.y); }
    else if (k !== 'P' && rnd(c, r, 12) < (k === 'S' ? .5 : .04)) put(map, pick('fern', c, r, 13), p.x + (rnd(c, r, 14) - .5) * 14, p.y + rnd(r, c, 15) * 5);
    // a wall text is drawn once the last wall block of its run stands
    for (const t of extras.texts || []) { const last = t.face === 'south' ? [t.c + tileset.texts[t.id].tiles - 1, t.r] : [t.c, t.r]; if (last[0] === c && last[1] === r) { const q = at(t.c, t.r); put(map, 'text_' + t.face + '_' + t.id, q.x, q.y); } }
  }
  if (extras.core) {
    const p = at(extras.core[0], extras.core[1]);
    put(map, 'core_claw_back', p.x, p.y); put(glow, 'core_claw_back_glow', p.x, p.y); put(glow, 'core_beam', p.x, p.y); put(glow, 'core_orb', p.x, p.y); put(glow, 'core_pulse_2', p.x, p.y);
    put(map, 'core_claw_front', p.x, p.y);
    lamp('core', p.x, p.y);
  }
  for (const [c, r, dx] of extras.breachLights || []) { const p = at(c, r); lamp('breach', p.x + (dx || 0), p.y); }

  // 3. the light map: the ambient colour, every light added on top, then multiplied over the map
  light.fillStyle = L.ambient; light.fillRect(0, 0, W, H);
  const one = document.createElement('canvas'), f = json.frames[P + 'light'].frame;
  for (const l of lights) {
    one.width = Math.ceil(f.w * l.scale); one.height = Math.ceil(f.h * l.scale);
    const o = one.getContext('2d'); o.imageSmoothingEnabled = false;
    o.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, one.width, one.height);
    o.globalCompositeOperation = 'source-in'; o.fillStyle = l.color; o.fillRect(0, 0, one.width, one.height);
    const a = json.frames[P + 'light'].anchor;
    light.globalCompositeOperation = 'lighter'; light.globalAlpha = l.alpha;
    light.drawImage(one, Math.round(l.x - a.x * one.width), Math.round(l.y - a.y * one.height));
  }
  const out = canvas();
  out.drawImage(map.canvas, 0, 0);
  out.globalCompositeOperation = 'multiply'; out.drawImage(light.canvas, 0, 0);
  out.globalCompositeOperation = 'destination-in'; out.drawImage(map.canvas, 0, 0);
  out.globalCompositeOperation = 'lighter'; out.drawImage(glow.canvas, 0, 0);
  return out.canvas;
}
