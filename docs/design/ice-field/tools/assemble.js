// Builds a picture of a snow map from the packed atlas alone: the sheet image, its PixiJS JSON and tileset.json.
// It is the reference for how the tiles go together and the check that the atlas works for any layout.
// The layers and the light come from stage() in docs/design/tools/pixel-atlas.js.
//
// layout: rows of characters. # cliff, . snow, H Half Cover, F Full Cover, P Prime Zone, S Spawn,
// R relic to fetch, D landing pad, E escort route. extras names what a layout cannot say by itself.

function assemble(image, json, tileset, layout, extras = {}) {
  const rows = layout.length, cols = layout[0].length, pad = 130, top = 130;
  const W = (cols + rows) * 16 + pad * 2, H = (cols + rows) * 8 + top + 110, X0 = rows * 16 + pad, Y0 = top;
  const at = (c, r) => ({ x: X0 + (c - r) * 16, y: Y0 + (c + r) * 8 + 8 });   // centre of a tile
  const K = (c, r) => (r < 0 || r >= rows || c < 0 || c >= cols ? ' ' : layout[r][c]);
  const is = (p, c, r) => p && p[0] === c && p[1] === r;
  const S = stage(image, json, tileset, W, H);
  const pick = (group, c, r, salt) => { const names = tileset.groups[group]; return names[Math.floor(tileHash(c, r, salt) * names.length)]; };
  const tile = (name, c, r) => { const p = at(c, r); S.tile(name, p.x, p.y); };

  // 1. the ground: snow thinning out beyond the cliffs, then the field and what lies on it
  for (let r = -3; r < rows + 3; r++) for (let c = -3; c < cols + 3; c++) {
    const out = Math.max(-c, c - cols + 1, -r, r - rows + 1);
    if (out <= 0 || (out === 3 && tileHash(c, r, 1) < .4)) continue;
    tile(pick(out > 1 ? 'outside_fade' : 'outside', c, r, 2), c, r);
    if (tileHash(c, r, 3) < .1) { const p = at(c, r); S.tile(tileHash(c, r, 4) < .5 ? pick('shrub', c, r, 5) : pick('stele', c, r, 5), p.x, p.y); }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r); if (k === '#') continue;
    tile(k === 'P' ? 'prime_floor' : k === 'S' ? pick('camp_floor', c, r, 6) : pick('snow', c, r, 6), c, r);
    if (k === '.' && tileHash(c, r, 7) < .08) tile(pick('ice_patch', c, r, 8), c, r);
  }
  for (const [c, r, n] of extras.pools || []) tile('ice_pool_' + n, c, r);
  if (extras.capsule) tile('capsule_trench', extras.capsule[0], extras.capsule[1]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r);
    if (k === 'R') tile('relic_floor', c, r); if (k === 'D') tile('pad_floor', c, r);
    if (k === 'E') tile(K(c - 1, r) === 'E' || K(c + 1, r) === 'E' ? 'track_col' : 'track_row', c, r);
    if (k !== 'P' && k !== '#') {
      const n = K(c, r - 1) === 'P', s = K(c, r + 1) === 'P', w = K(c - 1, r) === 'P', e = K(c + 1, r) === 'P';
      if (n) tile('prime_edge_n', c, r); if (s) tile('prime_edge_s', c, r); if (w) tile('prime_edge_w', c, r); if (e) tile('prime_edge_e', c, r);
      if (!n && !w && K(c - 1, r - 1) === 'P') tile('prime_corner_nw', c, r); if (!n && !e && K(c + 1, r - 1) === 'P') tile('prime_corner_ne', c, r);
      if (!s && !e && K(c + 1, r + 1) === 'P') tile('prime_corner_se', c, r); if (!s && !w && K(c - 1, r + 1) === 'P') tile('prime_corner_sw', c, r);
    }
  }
  if (extras.ring) { const p = at(extras.ring[0], extras.ring[1]); S.glowOnly('prime_ring', p.x, p.y); }

  // 2. everything that stands, back to front
  for (let sum = 0; sum <= cols + rows - 2; sum++) for (let r = 0; r < rows; r++) {
    const c = sum - r; if (c < 0 || c >= cols) continue; const k = K(c, r), p = at(c, r), open = t => t !== '#' && t !== ' ';
    if (k === '#') {
      if (r === rows - 1 || c === cols - 1) tile(pick('cliff_low', c, r, 9), c, r);
      else if (tileHash(c, r, 10) < .14 && (open(K(c, r + 1)) || open(K(c + 1, r)))) { tile('cliff_glyph', c, r); const q = open(K(c, r + 1)) ? at(c, r + 1) : at(c + 1, r); S.lamp('glyph', q.x, q.y); }
      else tile(pick('cliff', c, r, 9), c, r);
    } else if (k === 'H') { tile(pick('half_cover', c, r, 11), c, r); S.lamp('cover', p.x, p.y); }
    else if (k === 'F') { tile('full_cover', c, r); S.lamp('cover', p.x, p.y); }
    else if (k === 'R') { tile('relic', c, r); S.lamp('relic', p.x, p.y); }
    else if (k === 'D') { tile('beacon', c, r); S.lamp('beacon', p.x, p.y); }
    else if (k === 'S') { if (K(c, r - 1) !== 'S') S.lamp('camp', p.x, p.y + 8); }
    else if (k === '.' && !is(extras.capsule, c, r) && !is(extras.salvage, c, r)) {
      const v = tileHash(c, r, 12);
      if (v < .05) { S.tile(pick('stele', c, r, 13), p.x + (tileHash(c, r, 14) - .5) * 12, p.y); S.lamp('stele', p.x, p.y); }
      else if (v < .1) S.tile(pick('shrub', c, r, 13), p.x + (tileHash(c, r, 14) - .5) * 14, p.y + tileHash(r, c, 15) * 5);
    }
    if (is(extras.sled, c, r)) { tile('sled', c, r); S.lamp('beacon', p.x, p.y); }
    if (is(extras.generator, c, r)) tile('generator', c, r);
    if (is(extras.salvage, c, r)) { tile('salvage_case', c, r); S.lamp('stele', p.x, p.y); }
    for (const d of extras.debris || []) if (is(d, c, r)) tile(pick('debris', c, r, 16), c, r);
    if (is(extras.capsule, c, r)) { tile('capsule', c, r); S.put('capsule_steam_2', p.x, p.y); S.glowOnly('capsule_beacon_0', p.x, p.y); S.lamp('capsule', p.x, p.y); }
    if (is(extras.gate, c, r)) { tile('gate', c, r); S.glowOnly('gate_membrane_0', p.x, p.y); S.lamp('centre', p.x, p.y); }
  }
  return S.finish();
}
