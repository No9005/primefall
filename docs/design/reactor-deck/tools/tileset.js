// Draws the tiles of the Reactor Deck look "Notstrom" pixel by pixel and packs them into one atlas.
// Runs in a browser page (export.mjs opens it). Every sprite is drawn around its own origin:
// the centre of the tile it stands on. Nothing here knows the map; assemble.js builds maps from the atlas.

const HW = 16, HH = 8, WALL = 24, FULL_COVER = 22, HALF_COVER = 10;
// The tiles are stored brighter than they are seen: the light map is multiplied over them and may go up to
// LIGHT_SCALE times "full" light. LIGHT_RADIUS is the radius of the one light sprite; lights are scaled from it.
const LIGHT_SCALE = 1.5, LIGHT_RADIUS = 96;

const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const frac = x => x - Math.floor(x);
const hash = (a, b, c = 0) => { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

const LOOK = {
  floor: '#34373e', floor2: '#3e424a', seam: '#1e2026', grime: '#1a1b20', rustC: '#5a2e24', rust: .12, wear: .2,
  mark: '#ff8a3a', mark2: '#1c1c20', wallTop: '#4c505a', wallL: '#3a3d46', wallR: '#2a2c34', wallCut: '#15161a', trim: '#1e2026', strip: '#ff4a3a', stencil: '#c9c4bc',
  coverTop: '#5a5e68', coverL: '#444852', coverR: '#30333c', coverDeco: '#ff4a3a',
  plant1: '#4a7a4a', plant2: '#2f5a3a', flower: '#c58bff', moss: .04, out: '#2c3038',
  coreC: '#b06aff', coreHi: '#f0dcff', mountC: '#7a7e8a'
};
const T = {}; for (const k in LOOK) T[k] = typeof LOOK[k] === 'string' ? rgb(LOOK[k]) : LOOK[k];
// How the look is lit. Intensities are in units of "full light"; radii in px (see LIGHT_RADIUS).
const LIGHTING = {
  ambient: [.30, .30, .38],
  core: { color: '#b06aff', intensity: 1.3, radius: 190 },
  breach: { color: '#dfe8ff', intensity: 1.5, radius: 150 },
  lamp: { color: '#ff5a48', intensity: .38, radius: 44 },
  cover: { color: '#ff4a3a', intensity: .22, radius: 18 }
};

/* ---------- a sprite: base pixels and glowing pixels around an origin ---------- */
class Sprite {
  constructor(name, layer, half = 64) {
    this.name = name; this.layer = layer; this.size = half * 2; this.o = half;
    this.base = new Uint8ClampedArray(this.size * this.size * 4); this.glow = new Uint8ClampedArray(this.size * this.size * 4);
  }
  static blend(d, i, c, a) {
    if (d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a * 255; }
    else { d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; d[i + 3] = Math.max(d[i + 3], a * 255); }
  }
  // glow 0: a normal pixel. 1: a light of its own (drawn again, unlit, on the glow layer; the base keeps a dark copy).
  // 2: a haze that only exists on the glow layer.
  px(x, y, c, a = 1, glow = 0) {
    const xi = Math.round(x) + this.o, yi = Math.round(y) + this.o; if (xi < 0 || yi < 0 || xi >= this.size || yi >= this.size) return;
    const i = (yi * this.size + xi) * 4;
    if (glow) { Sprite.blend(this.glow, i, c, a); if (glow === 1 && !this.glowOnly) Sprite.blend(this.base, i, mix(c, BLACK, .5), a); return; }
    Sprite.blend(this.base, i, c, a);
    if (a > .6) this.glow[i + 3] = 0;
  }
}

/* ---------- floors and floor decals, drawn in tile space (u along columns, v along rows) ---------- */
function eachTilePixel(fn) {
  for (let j = 0; j < 16; j++) {
    const w = 2 * (j < 8 ? j + 1 : 16 - j);
    for (let x = -w; x < w; x++) { const a = (x + .5) / HW, b = (j + .5) / HH; fn(x, j - HH, (a + b) / 2, (b - a) / 2); }
  }
}
function floorColor(kind, n, u, v, x, y) {
  if (kind === 'ground') return hash(x >> 1, y + n * 17, 13) < .35 ? mix(T.plant2, T.out, .4) : mix(T.out, BLACK, hash(x, y + n * 23, 14) * .25);
  let col = mix(T.floor, T.floor2, hash(n, 3, 1));
  if (kind === 'outpost') col = mix(col, T.mark, .1);
  if (u < .07 || v < .07) col = T.seam; else if (u > .93 || v > .93) col = mix(col, WHITE, .07);
  if (kind === 'grate' && u > .14 && u < .86 && v > .14 && v < .86) col = frac((n % 2 ? u : v) * 5) < .45 ? T.seam : mix(col, BLACK, .15);
  if (kind === 'prime') col = frac(u * 4) < .5 || frac(v * 4) < .12 ? mix(T.seam, BLACK, .3) : mix(T.seam, T.coreC, .4);
  if (hash(x, y + n * 31, 3) < .07) col = mix(col, T.grime, .5);
  if (kind === 'rust') { const du = u - .25 - hash(n, 5, 5) * .5, dv = v - .25 - hash(n, 6, 6) * .5; if (du * du + dv * dv < .04 + .04 * hash(x >> 1, (y >> 1) + n, 7)) col = mix(col, T.rustC, .6); }
  if (kind === 'spawn') { if (hash(x, y + n * 7, 9) < .16) col = mix(col, T.out, .7); if (hash(x >> 1, (y >> 1) + n * 5, 19) < .1) col = mix(T.wallR, BLACK, .2); }
  return col;
}
function floorSprite(name, kind, n, sparse) {
  const s = new Sprite(name, 'floor', 24);
  eachTilePixel((x, y, u, v) => { if (sparse && hash(x >> 1, (y >> 1) + n * 11, 12) > sparse) return; s.px(x, y, floorColor(kind, n, u, v, x, y)); });
  return s;
}
function decalSprite(name, fn, glowOnly) {
  const s = new Sprite(name, 'decal', 24); s.glowOnly = !!glowOnly;
  eachTilePixel((x, y, u, v) => { const p = fn(u, v, x, y); if (p) s.px(x, y, p[0], p[1] === undefined ? 1 : p[1], p[2] || 0); });
  return s;
}
const worn = (x, y, salt) => hash(x >> 1, y, salt) < T.wear;
const stripes = (u, v) => (frac((u + v) * 3) < .5 ? T.mark : T.mark2);
function guide(axis, lit) {
  return (u, v) => {
    const along = axis === 'col' ? u : v, across = Math.abs((axis === 'col' ? v : u) - .5);
    if (across >= .09 || frac(along * 2 + .25) >= .5) return null;
    return lit ? [T.mark, 1, 1] : [mix(T.seam, T.mark, .18)];
  };
}
// The band lies on the side of the tile that faces the marked zone: n = towards smaller rows, w = towards smaller columns.
const SIDES = { n: (u, v) => v, s: (u, v) => 1 - v, w: (u, v) => u, e: (u, v) => 1 - u };
const CORNERS = { nw: ['n', 'w'], ne: ['n', 'e'], se: ['s', 'e'], sw: ['s', 'w'] };
function hazardEdge(side) { return (u, v, x, y) => (SIDES[side](u, v) < .3 && !worn(x, y, 8) ? [stripes(u, v)] : null); }
function hazardCorner(corner) { const [a, b] = CORNERS[corner]; return (u, v, x, y) => (SIDES[a](u, v) < .3 && SIDES[b](u, v) < .3 && !worn(x, y, 8) ? [stripes(u, v)] : null); }
function outpostCorner(corner) {
  const [a, b] = CORNERS[corner];
  return (u, v, x, y) => { const ea = SIDES[a](u, v), eb = SIDES[b](u, v); return ((ea < .14 && eb < .7) || (eb < .14 && ea < .7)) && !worn(x, y, 28) ? [T.mark] : null; };
}
function primeRing() {   // one decal for a Prime Zone of 3 by 3 tiles, placed on its centre tile
  const s = new Sprite('prime_ring', 'glow', 64); s.glowOnly = true;
  for (let y = -24; y < 24; y++) for (let x = -48; x < 48; x++) {
    const a = (x + .5) / HW, b = (y + .5) / HH, d = Math.hypot((a + b) / 2, (b - a) / 2);
    if (Math.abs(d - 1.25) < .07 || d < .18) s.px(x, y, T.coreC, 1, 1);
  }
  return s;
}
function rubble(name, n) {
  const s = new Sprite(name, 'object', 24);
  for (let i = 0; i < 9; i++) {
    const bx = (hash(n, 70 + i, 1) - .5) * 24, by = -4 + hash(n, 80 + i, 2) * 9, w = 2 + Math.floor(hash(i, n, 90) * 3);
    for (let x = 0; x < w; x++) for (let y = 0; y < 2 + (i % 2); y++) s.px(bx + x, by - y, y ? T.wallL : T.wallR);
  }
  return s;
}

/* ---------- walls: one block with its top and the two faces towards the viewer ---------- */
function wallSprite(name, n, o = {}) {
  const s = new Sprite(name, 'object', 48), h0 = o.cut ? 5 : WALL;
  const hAt = x => (o.broken ? Math.max(3, Math.round(h0 * (.25 + .75 * hash((x + 40) >> 1, n, 13)))) : h0);
  const face = (x, yBase, along, side) => {
    const h = hAt(x);
    for (let k = 0; k <= h; k++) {
      const t = k / h0; let col = side ? T.wallR : T.wallL, glow = 0;
      if (o.cut) col = mix(T.wallCut, col, .35);
      if (along < .07 && !o.broken) col = mix(col, BLACK, .3);
      if (t > .88) col = mix(col, WHITE, .14); if (t < .12) col = mix(col, T.grime, .55);
      if (!o.cut && t > .50 && t < .60) col = T.trim;
      if (o.lamp && t > .62 && t < .72 && along > .2 && along < .8) { col = T.strip; glow = 1; }
      if (hash(x + 40, n, 15) < T.rust * .6 && t < hash(x + 40, 3, 16)) col = mix(col, T.rustC, .45);
      if (!o.cut && hash((x + 40) >> 1, n * 31, 17) < T.moss * 1.1 + .02 && t > 1 - hash((x + 40) >> 1, n, 18) * .85) col = hash(x, k, 22) < .5 ? T.plant1 : T.plant2;
      s.px(x, yBase - k, col, 1, glow);
    }
    if (o.broken) s.px(x, yBase - h - 1, mix(T.wallTop, BLACK, .3));
  };
  for (let x = 0; x < HW; x++) { face(-HW + x, x >> 1, x / HW, 0); face(x, HH - 1 - (x >> 1), x / HW, 1); }
  if (!o.broken) eachTilePixel((x, y) => {
    const w = 2 * (y + HH < 8 ? y + HH + 1 : 16 - y - HH);
    let col = o.cut ? T.wallCut : mix(T.wallTop, BLACK, hash(n, 2, 23) * .08);
    if (Math.abs(x + .5) >= w - 2) col = mix(col, o.cut ? WHITE : BLACK, o.cut ? .1 : .25);
    s.px(x, y - h0, col);
  });
  return s;
}

/* ---------- cover: thin plates on the two back edges of the tile ---------- */
function coverSprite(name, n, h) {
  const s = new Sprite(name, 'object', 48), post = mix(T.coverTop, BLACK, .15);
  for (const side of [0, 1]) for (let i = 2; i < HW - 1; i++) {
    const x = side ? i : -HW + i, y = (side ? -HH + (i >> 1) : -(i >> 1)) + 2, along = (i - 2) / (HW - 4);
    s.px(x, y + 1, BLACK, .3);
    for (let k = 0; k <= h; k++) {
      const t = k / h, base = side ? T.coverR : T.coverL; let col = base, glow = 0;
      if (along < .07 || along > .93 || t > .92 || t < .06) col = mix(base, WHITE, .12);
      if (h > HALF_COVER && Math.abs(t - .45) < .03) col = T.trim;
      if (t > .62 && t < .62 + 1.6 / h && frac(along * 3 + .1) < .22) { col = T.coverDeco; glow = 1; }
      if (hash(x + 40, k + n * 9, 40) < T.rust * .5) col = mix(col, T.rustC, .5);
      s.px(x, y - k, col, 1, glow);
    }
    s.px(x, y - h - 1, mix(T.coverTop, WHITE, .2));
  }
  for (const [px, py] of [[-HW + 2, 2], [-1, -HH + 2], [0, -HH + 2], [HW - 2, 1]]) for (let k = 0; k <= h + 2; k++) s.px(px, py - k, k > h ? mix(post, WHITE, .3) : post);
  return s;
}

/* ---------- plants ---------- */
function fernSprite(name, n) {
  const s = new Sprite(name, 'object', 24), size = 4 + (n % 3) * 1.5, count = 4 + Math.floor(hash(n, 1, 30) * 4);
  for (let i = 0; i < count; i++) {
    const ang = (-80 + 160 * (i + hash(n, i, 31) * .6) / count) * Math.PI / 180, len = size * (.6 + hash(n, i, 32) * .7), col = i % 2 ? T.plant1 : T.plant2;
    for (let k = 0; k <= len; k++) s.px(Math.sin(ang) * k, -Math.cos(ang) * k * .9 + k * k * .03, col);
    if (hash(n, i, 33) < .22) s.px(Math.sin(ang) * len, -Math.cos(ang) * len * .9, T.flower);
  }
  return s;
}

/* ---------- stencil texts, sheared onto a wall face ---------- */
const textCanvas = document.createElement('canvas'); textCanvas.width = 200; textCanvas.height = 16;
const tctx = textCanvas.getContext('2d', { willReadFrequently: true });
function stencilBits(text) {
  tctx.clearRect(0, 0, 200, 16); tctx.fillStyle = '#fff'; tctx.font = 'bold 11px Arial, Helvetica, sans-serif'; tctx.textBaseline = 'top';
  let x = 0; const arrows = [];
  for (const ch of text) {
    if (ch === '>' || ch === '<') { arrows.push([x, ch]); x += 13; continue; }
    tctx.fillText(ch, x, 2); x += Math.ceil(tctx.measureText(ch).width) + 1;
  }
  const img = tctx.getImageData(0, 0, 200, 16).data, bits = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < x; i++) if (img[(j * 200 + i) * 4 + 3] > 105) bits.push([i, j]);
  for (const [ax, ch] of arrows) for (let i = 0; i < 11; i++) for (let j = -3; j <= 3; j++) {
    const k = ch === '>' ? i : 10 - i;
    if ((Math.abs(j) <= 1 && k < 8) || (k >= 6 && Math.abs(j) <= 10 - k)) bits.push([ax + i, 7 + j]);
  }
  return { bits, width: x };
}
// face 'south': the text runs along a row of walls, starting on the tile the sprite is placed on (towards larger columns).
// face 'east': it runs along a column of walls, starting on the tile it is placed on (towards smaller rows).
function textSprite(name, face, text) {
  const s = new Sprite(name, 'text', 128), { bits, width } = stencilBits(text);
  for (const [i, j] of bits) {
    const x = face === 'east' ? 3 + i : -HW + 3 + i, y = face === 'east' ? HH - ((3 + i) >> 1) : (3 + i) >> 1;
    if (hash(x + 200, y + j, 21) < T.wear * .3 + .05) continue;
    s.px(x, y - WALL + 3 + j, T.stencil, .95);
  }
  s.tiles = Math.ceil((width + 4) / HW);
  return s;
}

/* ---------- the plasma core and the claw that holds it; origin = floor centre under the core ---------- */
const CORE_Y = -58, ORB = 11;
function strokeOn(s, x0, y0, x1, y1, th, col, fadeTop) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n, a = fadeTop === undefined ? 1 : Math.min(1, Math.max(0, (y - fadeTop) / 70));
    for (let i = 0; i < th; i++) for (let j = 0; j < th; j++) s.px(x + i - (th >> 1), y + j - (th >> 1), i === 0 && th > 1 ? mix(col, WHITE, .25) : col, a);
  }
}
function curveOn(s, x0, y0, cx, cy, x1, y1, th, col) {
  let px = x0, py = y0;
  for (let k = 1; k <= 24; k++) { const t = k / 24, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1; strokeOn(s, px, py, x, y, th, col); px = x; py = y; }
}
function coreSprites() {
  const M = T.mountC, D = mix(M, BLACK, .4), y = CORE_Y, top = y - 190;
  const back = new Sprite('core_claw_back', 'object', 256), front = new Sprite('core_claw_front', 'object', 256);
  strokeOn(back, 96, top, 34, y - 44, 6, M, top); strokeOn(back, 34, y - 44, 0, y - 20, 6, M);
  for (const [px, py] of [[34, y - 44], [0, y - 20]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 18) back.px(px + dx, py + dy, dx < 0 ? mix(M, WHITE, .2) : D);
  back.px(0, y - 20, T.coverDeco, 1, 1);
  curveOn(back, 0, y - 18, -4, y - 16, -2, y + 2, 2, D);
  curveOn(front, -2, y - 18, -20, y - 14, -12, y + 6, 3, M); curveOn(front, 2, y - 18, 20, y - 14, 12, y + 6, 3, M);
  strokeOn(front, -12, y + 6, -8, y + 10, 2, D); strokeOn(front, 12, y + 6, 8, y + 10, 2, D);
  const orb = new Sprite('core_orb', 'glow', 64); orb.glowOnly = true;
  for (let dy = -ORB - 4; dy <= ORB + 4; dy++) for (let dx = -ORB - 4; dx <= ORB + 4; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= ORB - 5) orb.px(dx, y + dy, WHITE, 1, 1); else if (d <= ORB - 2) orb.px(dx, y + dy, T.coreHi, 1, 1);
    else if (d <= ORB) orb.px(dx, y + dy, T.coreC, 1, 1); else if (d <= ORB + 4) orb.px(dx, y + dy, T.coreC, .35 * (1 - (d - ORB) / 4), 2);
  }
  const beam = new Sprite('core_beam', 'glow', 64); beam.glowOnly = true;
  for (let yy = y + ORB; yy < -2; yy++) for (let x = -3; x <= 3; x++) if (hash(x, yy, 50) < .7) beam.px(x, yy, T.coreC, .3 * (1 - Math.abs(x) / 4), 2);
  const pulse = [];
  for (let f = 0; f < 8; f++) {   // a breathing halo and a few sparks around the orb
    const s = new Sprite('core_pulse_' + f, 'glow', 64); s.glowOnly = true;
    const k = .5 + .5 * Math.sin(f / 8 * Math.PI * 2), r = 12 + Math.round(k * 4);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.hypot(dx, dy); if (d <= r && d >= ORB - 1) s.px(dx, y + dy, T.coreC, .1 + .3 * k * (1 - (d - ORB + 1) / (r - ORB + 2)), 2); }
    for (let i = 0; i < 5; i++) { const a = hash(f, i, 99) * Math.PI * 2, d = 12 + hash(i, f, 98) * 9; s.px(Math.cos(a) * d, y + Math.sin(a) * d, T.coreHi, .9, 2); }
    pulse.push(s);
  }
  return [back, front, orb, beam].concat(pulse);
}

/* ---------- one light pool: white, stepped, wider than tall like the floor; tinted and added in the light map ---------- */
function lightSprite() {
  const s = new Sprite('light', 'light', 128); s.glowOnly = true; s.plain = true;
  for (let y = -Math.ceil(LIGHT_RADIUS / 1.1); y <= LIGHT_RADIUS / 2; y++) for (let x = -LIGHT_RADIUS; x <= LIGHT_RADIUS; x++) {
    const d = Math.hypot(x, y < 0 ? y * 1.1 : y * 2) / LIGHT_RADIUS; if (d >= 1) continue;
    s.px(x, y, WHITE, Math.ceil(Math.pow(1 - d, 1.5) * 6) / 6, 2);
  }
  return s;
}

/* ---------- the list of sprites ---------- */
const TEXTS = { reactor_right: 'REACTOR >', reactor_left: '< REACTOR', hangar_06: 'HANGAR 06', deck_c: 'DECK C', cargo_02: 'CARGO 02', coolant_2: 'COOLANT 2', caution_plasma: 'CAUTION PLASMA', airlock: 'AIRLOCK', bay_03: 'BAY 03' };
function buildSprites() {
  const list = [], groups = {};
  const add = (s, group) => { list.push(s); if (group) (groups[group] = groups[group] || []).push(s.name); return s; };
  for (let n = 0; n < 4; n++) add(floorSprite('floor_plate_' + n, 'plate', n), 'floor_plate');
  for (let n = 0; n < 2; n++) add(floorSprite('floor_rust_' + n, 'rust', n + 10), 'floor_rust');
  for (let n = 0; n < 2; n++) add(floorSprite('floor_grate_' + n, 'grate', n + 20), 'floor_grate');
  add(floorSprite('prime_floor', 'prime', 30)); add(floorSprite('outpost_floor', 'outpost', 31));
  for (let n = 0; n < 3; n++) add(floorSprite('spawn_floor_' + n, 'spawn', n + 40), 'spawn_floor');
  for (let n = 0; n < 4; n++) add(floorSprite('ground_' + n, 'ground', n + 50), 'ground');
  for (let n = 0; n < 4; n++) add(floorSprite('ground_fade_' + n, 'ground', n + 60, .5), 'ground_fade');
  for (const axis of ['col', 'row']) { add(decalSprite('guide_' + axis, guide(axis, true))); add(decalSprite('guide_' + axis + '_dead', guide(axis, false))); }
  for (const side in SIDES) add(decalSprite('hazard_edge_' + side, hazardEdge(side)));
  for (const corner in CORNERS) { add(decalSprite('hazard_corner_' + corner, hazardCorner(corner))); add(decalSprite('outpost_corner_' + corner, outpostCorner(corner))); }
  add(primeRing());
  for (let n = 0; n < 3; n++) add(rubble('rubble_' + n, n), 'rubble');
  for (let n = 0; n < 4; n++) add(wallSprite('wall_' + n, n), 'wall');
  add(wallSprite('wall_lamp', 7, { lamp: true }));
  for (let n = 0; n < 2; n++) add(wallSprite('wall_cut_' + n, n + 10, { cut: true }), 'wall_cut');
  for (let n = 0; n < 2; n++) add(wallSprite('wall_broken_' + n, n + 20, { broken: true }), 'wall_broken');
  for (let n = 0; n < 2; n++) add(coverSprite('half_cover_' + n, n, HALF_COVER), 'half_cover');
  add(coverSprite('full_cover', 5, FULL_COVER));
  for (let n = 0; n < 6; n++) add(fernSprite('fern_' + n, n), 'fern');
  for (const id in TEXTS) for (const face of ['south', 'east']) add(textSprite('text_' + face + '_' + id, face, TEXTS[id]));
  coreSprites().forEach(s => add(s, s.name.startsWith('core_pulse_') ? 'core_pulse' : null));
  add(lightSprite());
  return { list, groups };
}

/* ---------- trim, pack, write the PixiJS sheet ---------- */
function trimmed(data, size, o, scale) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = document.createElement('canvas'); c.width = w; c.height = h;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y + y0) * size + x + x0) * 4, j = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) img.data[j + k] = Math.min(255, data[i + k] * scale); img.data[j + 3] = data[i + 3];
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return { canvas: c, w, h, ax: o - x0, ay: o - y0 };
}
function buildAtlas() {
  const { list, groups } = buildSprites(), frames = [], info = {};
  for (const s of list) {
    const base = s.glowOnly ? null : trimmed(s.base, s.size, s.o, LIGHT_SCALE), glow = trimmed(s.glow, s.size, s.o, 1);
    if (base) frames.push({ name: s.name, ...base });
    if (glow) frames.push({ name: s.glowOnly ? s.name : s.name + '_glow', ...glow });
    info[s.name] = { layer: s.layer, glow: !s.glowOnly && glow ? s.name + '_glow' : undefined, tiles: s.tiles };
  }
  const order = frames.slice().sort((p, q) => q.h - p.h), width = 512;
  let x = 0, y = 0, shelf = 0;
  for (const f of order) { if (x + f.w > width) { x = 0; y += shelf + 1; shelf = 0; } f.x = x; f.y = y; x += f.w + 1; shelf = Math.max(shelf, f.h); }
  const sheet = document.createElement('canvas'); sheet.width = width; sheet.height = y + shelf;
  const ctx = sheet.getContext('2d'), out = {};
  for (const f of frames) {
    ctx.drawImage(f.canvas, f.x, f.y);
    out['deck.' + f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, anchor: { x: f.ax / f.w, y: f.ay / f.h } };
  }
  const animations = {}; for (const g in groups) animations['deck.' + g] = groups[g].map(n => 'deck.' + n);
  const json = { frames: out, animations, meta: { app: 'primefall reactor-deck tileset', version: '1', image: 'notstrom.png', format: 'RGBA8888', size: { w: sheet.width, h: sheet.height }, scale: '1' } };
  const amb = LIGHTING.ambient.map(v => Math.round(v / LIGHT_SCALE * 255));
  const tileset = {
    name: 'notstrom', prefix: 'deck.', tile: { w: HW * 2, h: HH * 2 }, wallHeight: WALL, halfCoverHeight: HALF_COVER, fullCoverHeight: FULL_COVER,
    origin: 'every sprite has its anchor on the centre of the tile it stands on',
    projection: { x: '(col - row) * 16', y: '(col + row) * 8' },
    lighting: {
      lightScale: LIGHT_SCALE, lightSpriteRadius: LIGHT_RADIUS,
      ambient: '#' + amb.map(v => v.toString(16).padStart(2, '0')).join(''),
      lights: Object.fromEntries(['core', 'breach', 'lamp', 'cover'].map(k => [k, { color: LIGHTING[k].color, alpha: Number((LIGHTING[k].intensity / LIGHT_SCALE).toFixed(3)), scale: Number((LIGHTING[k].radius / LIGHT_RADIUS).toFixed(3)) }]))
    },
    groups: Object.fromEntries(Object.entries(groups).map(([g, names]) => [g, names])),
    texts: Object.fromEntries(Object.entries(TEXTS).map(([id, text]) => [id, { text, tiles: info['text_south_' + id].tiles }])),
    sprites: info
  };
  return { png: sheet.toDataURL('image/png'), json, tileset };
}
