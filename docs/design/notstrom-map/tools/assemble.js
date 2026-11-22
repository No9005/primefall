// Builds a picture of a map from the packed atlas alone: the sheet image, its PixiJS JSON and tileset.json.
// It is the reference for how the tiles go together (which tile where, in which order) and the check that the
// atlas works for any layout. The layers and the light come from stage() in docs/design/tools/pixel-atlas.js.
//
// layout: rows of characters as in packages/game-core (# wall, . floor, H Half Cover, F Full Cover, P Prime Zone,
// X Outpost, S Spawn). extras names what a layout cannot say by itself (see the two layouts in export.mjs).

function assemble(image, json, tileset, layout, extras = {}) {
  const rows = layout.length, cols = layout[0].length, pad = 80, top = 250;
  const W = (cols + rows) * 16 + pad * 2, H = (cols + rows) * 8 + top + 60, X0 = rows * 16 + pad, Y0 = top;
  const at = (c, r) => ({ x: X0 + (c - r) * 16, y: Y0 + (c + r) * 8 + 8 });   // centre of a tile
  const K = (c, r) => (r < 0 || r >= rows || c < 0 || c >= cols ? ' ' : layout[r][c]);
  const has = (list, c, r) => (list || []).some(p => p[0] === c && p[1] === r);
  const S = stage(image, json, tileset, W, H);
  const pick = (group, c, r, salt) => { const names = tileset.groups[group]; return names[Math.floor(tileHash(c, r, salt) * names.length)]; };
  const tile = (name, c, r) => { const p = at(c, r); S.tile(name, p.x, p.y); };

  // 1. floors and what is painted on them
  for (const [c, r, fade] of extras.ground || []) tile(pick(fade ? 'ground_fade' : 'ground', c, r, 1), c, r);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r); if (k === '#') continue;
    if (k === 'P') tile('prime_floor', c, r); else if (k === 'X') tile('outpost_floor', c, r); else if (k === 'S') tile(pick('spawn_floor', c, r, 2), c, r);
    else { const v = tileHash(c, r, 3); tile(v < .12 ? pick('floor_grate', c, r, 4) : v < .3 ? pick('floor_rust', c, r, 4) : pick('floor_plate', c, r, 4), c, r); }
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
  for (const [c, r, axis] of extras.guides || []) tile('guide_' + axis + (tileHash(c, r, 5) < (extras.deadGuides || 0) ? '_dead' : ''), c, r);
  if (extras.ring) { const p = at(extras.ring[0], extras.ring[1]); S.glowOnly('prime_ring', p.x, p.y); }

  // 2. everything that stands, back to front
  for (let sum = 0; sum <= cols + rows - 2; sum++) for (let r = 0; r < rows; r++) {
    const c = sum - r; if (c < 0 || c >= cols) continue; const k = K(c, r), p = at(c, r);
    if (has(extras.breaches, c, r)) { tile(pick('rubble', c, r, 6), c, r); S.put(pick('fern', c, r, 7), p.x - 4, p.y + 1); S.put(pick('fern', c, r, 8), p.x + 6, p.y + 4); }
    else if (k === '#') {
      const near = r === rows - 1 || c === cols - 1, open = t => t !== '#' && t !== ' ';
      if (has(extras.broken, c, r)) tile(pick('wall_broken', c, r, 9), c, r);
      else if (near) tile(pick('wall_cut', c, r, 9), c, r);
      else if (tileHash(c, r, 10) < .3 && (open(K(c, r + 1)) || open(K(c + 1, r)))) { tile('wall_lamp', c, r); const q = open(K(c, r + 1)) ? at(c, r + 1) : at(c + 1, r); S.lamp('lamp', q.x, q.y); }
      else tile(pick('wall', c, r, 9), c, r);
    } else if (k === 'H') { tile(pick('half_cover', c, r, 11), c, r); S.lamp('cover', p.x, p.y); }
    else if (k === 'F') { tile('full_cover', c, r); S.lamp('cover', p.x, p.y); }
    else if (k !== 'P' && tileHash(c, r, 12) < (k === 'S' ? .5 : .04)) S.put(pick('fern', c, r, 13), p.x + (tileHash(c, r, 14) - .5) * 14, p.y + tileHash(r, c, 15) * 5);
    // a wall text is drawn once the last wall block of its run stands
    for (const t of extras.texts || []) { const last = t.face === 'south' ? [t.c + tileset.texts[t.id].tiles - 1, t.r] : [t.c, t.r]; if (last[0] === c && last[1] === r) { const q = at(t.c, t.r); S.put('text_' + t.face + '_' + t.id, q.x, q.y); } }
  }
  if (extras.core) {
    const p = at(extras.core[0], extras.core[1]);
    S.tile('core_claw_back', p.x, p.y); S.glowOnly('core_beam', p.x, p.y); S.glowOnly('core_orb', p.x, p.y); S.glowOnly('core_pulse_2', p.x, p.y);
    S.put('core_claw_front', p.x, p.y);
    S.lamp('core', p.x, p.y);
  }
  for (const [c, r, dx] of extras.breachLights || []) { const p = at(c, r); S.lamp('breach', p.x + (dx || 0), p.y); }
  return S.finish();
}
