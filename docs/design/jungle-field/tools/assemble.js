// Builds a picture of a jungle map from the packed atlas alone: the sheet image, its PixiJS JSON and tileset.json.
// It is the reference for how the tiles go together and the check that the atlas works for any layout.
// The layers and the light come from stage() in docs/design/tools/pixel-atlas.js.
//
// layout: rows of characters. M mud, G grass, h reeds on grass (Half Cover), W water, S ford, R root wall (Full Cover),
// T tree trunk (the middle of a 3 by 3 tree; "t" is the rest of its ground), P Prime Zone, X Outpost, D Drop Point,
// V platform, L ladder, B lift basket.

const vn = (x, y, s) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, h = tileHash;
  const a = h(x0, y0, s), b = h(x0 + 1, y0, s), c = h(x0, y0 + 1, s), d = h(x0 + 1, y0 + 1, s), u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/* ---------- the two layouts of the proposal, on the 45 by 25 board ---------- */
function layoutGrid(cols, rows, fill) { return Array.from({ length: rows }, () => Array(cols).fill(fill)); }
function layoutPut(g, c, r, ch) { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch; }
function layoutAt(g, c, r) { return r >= 0 && r < g.length && c >= 0 && c < g[0].length ? g[r][c] : '#'; }
function layoutMirror(g, c, r, ch) { const W = g[0].length - 1, H = g.length - 1; [[c, r], [W - c, r], [c, H - r], [W - c, H - r]].forEach(([x, y]) => layoutPut(g, x, y, ch)); }
function layoutPond(g, cx, cy, rx, ry, seed) {
  for (let r = Math.floor(cy - ry - 2); r <= cy + ry + 2; r++) for (let c = Math.floor(cx - rx - 2); c <= cx + rx + 2; c++) {
    const d = ((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 + (vn(c * .7, r * .7, seed) - .5) * .7;
    if (d < 1 && 'MGh'.includes(layoutAt(g, c, r))) layoutPut(g, c, r, 'W');
  }
}
function layoutTree(g, c, r) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) layoutPut(g, c + dc, r + dr, dc === 0 && dr === 0 ? 'T' : 't'); }
function layoutRoots(g, a, b, c2, d) {
  const n = Math.max(Math.abs(c2 - a), Math.abs(d - b));
  for (let i = 0; i <= n; i++) layoutMirror(g, Math.round(a + ((c2 - a) * i) / (n || 1)), Math.round(b + ((d - b) * i) / (n || 1)), 'R');
}
function layoutHollow(platforms) {   // layout A, "Hollow of the Mammoths"; with platforms: layout D, "Canopy Village"
  const cols = 45, rows = 25, g = layoutGrid(cols, rows, 'M');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (vn(c / 5, r / 5, 3) > .48) g[r][c] = 'G';
  for (let r = 10; r <= 14; r++) for (let c = 1; c <= 2; c++) { layoutPut(g, c, r, 'D'); layoutPut(g, cols - 1 - c, r, 'D'); }
  for (let r = 10; r <= 14; r++) for (let c = 20; c <= 24; c++) g[r][c] = 'P';
  for (const r0 of [2, 20]) for (let r = r0; r < r0 + 3; r++) for (let c = 21; c <= 23; c++) g[r][c] = 'X';
  [[11, 6], [33, 6], [11, 18], [33, 18]].forEach(([c, r]) => layoutTree(g, c, r));
  layoutRoots(g, 14, 4, 14, 8); layoutRoots(g, 6, 9, 9, 9); layoutRoots(g, 18, 5, 20, 5);
  for (const [cx, cy, rx, ry, s] of [[16, 9, 4, 2.6, 1], [8, 15, 3, 3.4, 2], [20, 5, 3, 1.8, 3], [5, 6, 3, 2.6, 4], [13, 12, 2, 1.6, 8]]) { layoutPond(g, cx, cy, rx, ry, s); layoutPond(g, 44 - cx, 24 - cy, rx, ry, s + 7); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {   // reeds on the banks
    if (!'MG'.includes(g[r][c])) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => layoutAt(g, c + dc, r + dr) === 'W') && tileHash(c, r, 5) < .45) g[r][c] = 'h';
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ('hRWtT'.includes(g[r][c]) && c >= 17 && c <= 27 && r >= 7 && r <= 17) g[r][c] = 'G';
  if (platforms) {
    for (const [c, r] of [[17, 9], [27, 9], [17, 15], [27, 15]]) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) layoutPut(g, c + dc, r + dr, 'V');
      const out = c < 22 ? -1 : 1, up = r < 12 ? -1 : 1;
      layoutPut(g, c + out * 2, r, 'L'); layoutPut(g, c, r + up * 2, 'L'); layoutPut(g, c + out * 2, r + up, 'B');
    }
    for (let c = 19; c <= 25; c++) { layoutPut(g, c, 8, 'V'); layoutPut(g, c, 16, 'V'); }
  }
  return g.map(row => row.join(''));
}

function assemble(image, json, tileset, layout) {
  const rows = layout.length, cols = layout[0].length, pad = 60, top = 215;
  const W = (cols + rows) * 16 + pad * 2, H = (cols + rows) * 8 + top + 60, X0 = rows * 16 + pad, Y0 = top;
  const at = (c, r) => ({ x: X0 + (c - r) * 16, y: Y0 + (c + r) * 8 + 8 });   // centre of a tile
  const K = (c, r) => (r < 0 || r >= rows || c < 0 || c >= cols ? ' ' : layout[r][c]);
  const S = stage(image, json, tileset, W, H);
  const pick = (group, c, r, salt) => { const names = tileset.groups[group]; return names[Math.floor(tileHash(c, r, salt) * names.length)]; };
  const tile = (name, c, r, dx = 0, dy = 0) => { const p = at(c, r); S.tile(name, p.x + dx, p.y + dy); };
  const land = k => 'MGhRtT'.includes(k);

  // 1. the ground, then what lies on it
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r);
    tile(k === 'W' ? pick('water', c, r, 1) : k === 'S' ? pick('ford', c, r, 1) : k === 'P' ? 'prime_floor' : k === 'X' ? pick('outpost_floor', c, r, 1) : k === 'D' ? 'drop_floor'
      : k === 'G' || k === 'h' ? pick('grass', c, r, 1) : pick('mud', c, r, 1), c, r);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = K(c, r), side = { n: K(c, r - 1), s: K(c, r + 1), w: K(c - 1, r), e: K(c + 1, r) };
    if (k === 'W') for (const s in side) if (land(side[s])) tile('water_bank_' + s, c, r);
    if (k === 'P') for (const s in side) if (side[s] !== 'P') tile('prime_edge_' + s, c, r);
  }

  // 2. everything that stands, back to front; the crowns of the trees last
  const crowns = [];
  for (let sum = 0; sum <= cols + rows - 2; sum++) for (let r = 0; r < rows; r++) {
    const c = sum - r; if (c < 0 || c >= cols) continue; const k = K(c, r), p = at(c, r);
    if (k === 'h') tile(pick('reeds', c, r, 2), c, r);
    else if (k === 'G' && tileHash(c, r, 21) < .1) tile(pick('tuft', c, r, 2), c, r);
    else if (k === 'R') tile(pick('root_wall', c, r, 2), c, r);
    else if (k === 'T') { tile(pick('tree_trunk', c, r, 2), c, r); crowns.push([pick('tree_canopy', c, r, 2), c, r]); }
    else if (k === 'V') {
      for (const [n, dc, dr] of [[0, 1, 1], [1, 0, 1], [2, 1, 0]]) if (K(c + dc, r + dr) !== 'V' && !(n === 0 && K(c + 1, r) === 'V' && K(c, r + 1) === 'V') && tileHash(c * 3 + n, r * 5, 4) < .45) tile('platform_post_' + n, c, r);
      tile('platform_top', c, r);
      if (K(c, r + 1) !== 'V') tile('platform_face_l', c, r);
      if (K(c + 1, r) !== 'V') tile('platform_face_r', c, r);
    }
    else if (k === 'L') tile('ladder', c, r);
    else if (k === 'B') tile('basket', c, r);
    else if (k === 'X' && c === 22 && (r === 3 || r === 21)) { tile('lamp', c, r); S.lamp('lamp', p.x, p.y - 16); }
    else if (k === 'P' && c === 22 && r === 12) { tile('artefact', c, r); S.lamp('artefact', p.x, p.y - 20); S.lamp('centre', p.x, p.y - 10); }
    else if (k === 'P' && [[20, 10], [24, 10], [20, 14], [24, 14]].some(([pc, pr]) => pc === c && pr === r)) tile(pick('pillar', c, r, 3), c, r, c === 20 ? -9 : 9);
    if (k === 'h' && tileHash(c, r, 9) < .28) tile('frog_' + [1, 2, 0][Math.floor(tileHash(c, r, 10) * 3)], c, r);
  }
  for (const [name, c, r] of crowns) tile(name, c, r);
  // 3. a few fireflies over the water and the trees, on the glow layer
  for (let i = 0; i < 70; i++) { const c = tileHash(i, 1, 30) * cols, r = tileHash(1, i, 31) * rows, p = at(c, r); S.glowOnly('firefly_' + (i % 4), p.x, p.y - 8 - tileHash(i, 2, 32) * 36); }
  return S.finish();
}
