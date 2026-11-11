// Draws the tiles of the snow map look "Polarnacht" pixel by pixel and packs them into one atlas.
// Runs in a browser page after docs/design/tools/pixel-atlas.js (export.mjs loads both). Every sprite is drawn
// around its own origin: the centre of the tile it stands on. Nothing here knows a map; assemble.js builds maps.

const HALF_COVER = 10, FULL_COVER = 22;
const LOOK = {
  snow: '#56708c', snow2: '#6c88a4', seam: '#263a50', ice: '#3e6688', ice2: '#52809e', sky: '#070c14',
  wallTop: '#8eaac4', wallL: '#2a3c52', wallR: '#1e2c3e', mortar: '#131e2c', icicleC: '#a8c4dc', icicle: .26,
  alien: '#1e3038', alien2: '#263c44', glow: '#5cffa0', glowHi: '#e0ffe8', human: '#ff8a2a', metal: '#4a5868', metal2: '#34404e',
  coverL: '#4e5c6c', coverR: '#3a4654', coverTop: '#9ab0c4', plant1: '#3a5a70', plant2: '#263e52', flower: '#7cffb0',
  hull: '#66747f', hullHi: '#93a2b0', hullLo: '#39444f', chute: '#aab2ba'
};
const T = {}; for (const k in LOOK) T[k] = typeof LOOK[k] === 'string' ? rgb(LOOK[k]) : LOOK[k];
// How the look is lit. Intensities are in units of "full light"; radii in px.
const LIGHTING = {
  ambient: [.32, .42, .52],
  centre: { color: '#5cffa0', intensity: 1.2, radius: 190 },
  relic: { color: '#5cffa0', intensity: .8, radius: 60 },
  glyph: { color: '#5cffa0', intensity: .4, radius: 46 },
  stele: { color: '#5cffa0', intensity: .3, radius: 26 },
  beacon: { color: '#ff8a2a', intensity: .7, radius: 54 },
  camp: { color: '#ff8a2a', intensity: .35, radius: 70 },
  cover: { color: '#ff8a2a', intensity: .22, radius: 20 },
  capsule: { color: '#ff8a2a', intensity: .75, radius: 80 }
};
// The falling snow: two tiling layers that scroll, the near one faster. Speeds in px per second at tile scale 1.
const SNOW = { near: { image: 'snow-near.png', size: 128, speed: [50, 40], alpha: .8 }, far: { image: 'snow-far.png', size: 128, speed: [30, 24], alpha: .5 } };

const SIDES = { n: (u, v) => v, s: (u, v) => 1 - v, w: (u, v) => u, e: (u, v) => 1 - u };
const CORNERS = { nw: ['n', 'w'], ne: ['n', 'e'], se: ['s', 'e'], sw: ['s', 'w'] };
const snowAt = (x, y, n) => { let s = mix(T.snow, T.snow2, hash(x >> 1, (y >> 1) + n * 13, 1) * .6 + .2 * hash(n, 2, 2)); if (hash(x >> 2, (y >> 1) + n * 7, 5) < .08) s = mix(s, WHITE, .3); return s; };
const iceAt = (x, y, n, rim) => { let c = mix(T.ice, T.ice2, hash(x >> 2, (y >> 2) + n * 5, 3) * .6); if (rim) c = mix(c, WHITE, .45); if (hash(x, (y >> 1) + n * 3, 4) < .03) c = mix(c, WHITE, .5); return c; };

/* ---------- ground ---------- */
function groundSprite(name, kind, n, sparse) {
  const s = new Sprite(name, 'floor', 24);
  eachTilePixel((x, y, u, v) => {
    if (sparse && hash(x >> 1, (y >> 1) + n * 11, 12) > sparse) return;
    let col = snowAt(x, y, n);
    if (kind === 'outside') col = mix(col, T.sky, .25); else if (u < .05 || v < .05) col = mix(col, T.seam, .2);
    if (kind === 'camp') { col = mix(col, T.seam, .22); if (frac(v * 3) < .2 && u > .15 && u < .85) col = T.metal2; if (hash(x, y + n, 10) < .1) col = T.snow2; }
    if (kind === 'prime') { col = mix(T.alien, T.alien2, hash(n, 1, 1)); if (frac(u * 3) < .1 || frac(v * 3) < .1) col = mix(col, T.glow, .45); }
    s.px(x, y, col);
  });
  return s;
}
function decalSprite(name, fn, glowOnly) {
  const s = new Sprite(name, 'decal', 24); s.glowOnly = !!glowOnly;
  eachTilePixel((x, y, u, v) => { const p = fn(u, v, x, y); if (p) s.px(x, y, p[0], p[1] === undefined ? 1 : p[1], p[2] || 0); });
  return s;
}
function icePatch(name, n) {   // a frozen puddle inside one tile
  return decalSprite(name, (u, v, x, y) => { const d = Math.hypot(u - .5, v - .5) + (hash(x >> 1, (y >> 1) + n, 31) - .5) * .1; return d < .42 ? [iceAt(x, y, n, d > .35)] : null; });
}
function icePool(name, n) {   // a frozen pool about two tiles wide, placed on any tile
  const s = new Sprite(name, 'decal', 48), rx = .95 + hash(n, 1, 32) * .25, ry = .7 + hash(n, 2, 33) * .3;
  for (let y = -22; y < 22; y++) for (let x = -44; x < 44; x++) {
    const a = (x + .5) / HW, b = (y + .5) / HH, u = (a + b) / 2, v = (b - a) / 2, d = Math.hypot(u / rx, v / ry) + (hash(x >> 2, (y >> 1) + n * 3, 34) - .5) * .12;
    if (d < 1) s.px(x, y, iceAt(x, y, n + 9, d > .88));
    if (d < .8 && Math.abs(frac(u * 1.7 + v * .6 + n * .3) - .5) < .014) s.px(x, y, mix(T.ice2, WHITE, .5));
  }
  return s;
}
function primeBorder(pick) {   // the carved band around the Prime Zone, on the side of the tile that faces the zone
  return (u, v) => { if (!pick(u, v)) return null; return frac((u + v) * 2) < .22 ? [T.glow, 1, 1] : [T.alien]; };
}
function primeRing() {
  const s = new Sprite('prime_ring', 'glow', 64); s.glowOnly = true;
  for (let y = -24; y < 24; y++) for (let x = -48; x < 48; x++) { const a = (x + .5) / HW, b = (y + .5) / HH, d = Math.hypot((a + b) / 2, (b - a) / 2); if (Math.abs(d - 1.25) < .07 || Math.abs(d - .7) < .04) s.px(x, y, T.glow, 1, 1); }
  return s;
}
function track(axis) {   // the escort route: packed snow, two rails, marker lights
  return (u, v) => {
    const along = axis === 'col' ? u : v, across = axis === 'col' ? v : u;
    if (Math.abs(across - .28) < .045 || Math.abs(across - .72) < .045) return [T.metal];
    if (frac(along * 2 + .1) < .2 && Math.abs(across - .5) < .07) return [T.human, 1, 1];
    return [T.seam, .3];
  };
}

/* ---------- cliffs with snow caps and icicles ---------- */
function cliffSprite(name, n, o = {}) {
  const s = new Sprite(name, 'object', 48), h = o.low ? 5 : o.h;
  const face = (x, yBase, along, side) => {
    const ice = hash(x + 40, n * 7, 15) < T.icicle ? .2 + hash(x + 40, n, 16) * .45 : 0;
    for (let k = 0; k <= h; k++) {
      const t = k / h, row = Math.floor(t * 4); let col = side ? T.wallR : T.wallL, glow = 0;
      if (o.low) col = mix(col, T.snow, .5);
      if (frac(t * 4) < .14 || frac(along * 2 + (row % 2) * .5) < .1) col = T.mortar;
      else if (hash(Math.floor(along * 2 + (row % 2) * .5) + n * 3, row + n * 5, 17) < .3) col = mix(col, WHITE, .08);
      if (o.glyph && t > .44 && t < .58 && frac(along * 3 + .15) < .45) { col = T.glow; glow = 1; }
      if (t < .1 + hash((x + 40) >> 1, n, 18) * .12) col = mix(T.snow, T.snow2, hash(x, k, 19));
      if (!o.low && t > 1 - ice) col = t > 1 - ice + .08 ? T.icicleC : mix(T.icicleC, col, .4);
      s.px(x, yBase - k, col, 1, glow);
    }
  };
  for (let x = 0; x < HW; x++) { face(-HW + x, x >> 1, x / HW, 0); face(x, HH - 1 - (x >> 1), x / HW, 1); }
  eachTilePixel((x, y) => { const j = y + HH, w = 2 * (j < 8 ? j + 1 : 16 - j); let col = mix(T.wallTop, T.snow2, hash((x + 40) >> 1, (y + 40) >> 1, 24 + n) * .5); if (Math.abs(x + .5) >= w - 2 && j >= 8) col = mix(col, T.wallL, .35); s.px(x, y - h, col); });
  return s;
}

/* ---------- cover: barricades of the expedition, thin plates on the two back edges of the tile ---------- */
function coverSprite(name, n, h) {
  const s = new Sprite(name, 'object', 48);
  for (const side of [0, 1]) for (let i = 2; i < HW - 1; i++) {
    const x = side ? i : -HW + i, y = (side ? -HH + (i >> 1) : -(i >> 1)) + 2, along = (i - 2) / (HW - 4);
    s.px(x, y + 1, BLACK, .25);
    for (let k = 0; k <= h; k++) {
      const t = k / h, base = side ? T.coverR : T.coverL; let col = base, glow = 0;
      if (along < .07 || along > .93 || t < .08) col = mix(base, WHITE, .12);
      if (h > HALF_COVER && Math.abs(t - .4) < .03) col = T.mortar;
      if (t > .55 && t < .55 + 1.8 / h && frac(along * 3 + .1 + n * .2) < .22) { col = T.human; glow = 1; }
      if (t > .88) col = T.coverTop;
      s.px(x, y - k, col, 1, glow);
    }
    s.px(x, y - h - 1, T.coverTop);
  }
  return s;
}

/* ---------- small things ---------- */
function box(s, cx, cy, hw, h, top, L, R) {
  const hh = hw / 2;
  for (let x = 0; x < hw; x++) for (let k = 0; k <= h; k++) { s.px(cx - hw + x, cy + (x >> 1) - k, L); s.px(cx + x, cy + hh - 1 - (x >> 1) - k, R); }
  for (let j = 0; j < hh * 2; j++) { const w = 2 * (j < hh ? j + 1 : hh * 2 - j); for (let x = -w; x < w; x++) s.px(cx + x, cy - hh + j - h, top); }
}
function haze(s, cx, cy, r, a, col = T.glow) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.hypot(dx, dy); if (d < r) s.px(cx + dx, cy + dy, col, a * (1 - d / r), 2); } }
function shrubSprite(name, n) {
  const s = new Sprite(name, 'object', 24), size = 4 + (n % 3) * 1.5, count = 4 + Math.floor(hash(n, 1, 30) * 4);
  for (let i = 0; i < count; i++) {
    const ang = (-80 + 160 * (i + hash(n, i, 31) * .6) / count) * Math.PI / 180, len = size * (.6 + hash(n, i, 32) * .7), col = i % 2 ? T.plant1 : T.plant2;
    for (let k = 0; k <= len; k++) s.px(Math.sin(ang) * k, -Math.cos(ang) * k * .9 + k * k * .03, col);
    if (hash(n, i, 33) < .3) s.px(Math.sin(ang) * len, -Math.cos(ang) * len * .9, T.flower, 1, 1);
  }
  return s;
}
function steleSprite(name, n) {
  const s = new Sprite(name, 'object', 24), h = 6 + n * 3;
  for (let k = 0; k <= h; k++) for (let i = -1; i <= 1; i++) s.px(i, 2 - k, i < 0 ? T.alien2 : T.alien);
  s.px(0, 1 - h, T.snow2); s.px(-1, 1 - h, T.snow2);
  for (let k = 2; k < h; k += 2) s.px(0, 2 - k, T.glow, 1, 1);
  return s;
}
function relicSprite() {
  const s = new Sprite('relic', 'object', 32);
  box(s, 0, 0, 6, 4, T.alien2, T.alien, mix(T.alien, BLACK, .3));
  haze(s, 0, -17, 9, .22);
  for (let k = -6; k <= 6; k++) { const w = 3 - Math.round(Math.abs(k) / 2); for (let i = -w; i <= w; i++) s.px(i, -17 + k, i < 0 ? T.glowHi : T.glow, 1, 1); }
  return s;
}
function beaconSprite() {
  const s = new Sprite('beacon', 'object', 32);
  for (let k = 0; k <= 16; k++) { s.px(0, -6 - k, T.metal); s.px(1, -6 - k, T.metal2); }
  haze(s, 0, -24, 4, .3, T.human);
  s.px(0, -24, WHITE, 1, 1); s.px(1, -24, T.human, 1, 1); s.px(0, -23, T.human, 1, 1); s.px(1, -23, T.human, 1, 1);
  return s;
}
function sledSprite() {
  const s = new Sprite('sled', 'object', 32);
  for (let j = -3; j <= 4; j++) for (let x = -16 + Math.abs(j) * 2; x < 16 - Math.abs(j) * 2; x++) s.px(x, 4 + j, BLACK, .3);
  box(s, 0, 1, 13, 5, T.metal, T.metal2, mix(T.metal2, BLACK, .3));
  box(s, 0, -4, 8, 7, T.alien2, T.alien, mix(T.alien, BLACK, .3));
  for (let k = 0; k < 6; k++) { s.px(-4 + (k >> 1), -6 - k + (k >> 1), T.glow, 1, 1); s.px(3, -5 - k, T.glow, 1, 1); }
  for (const dx of [-11, -7, 7, 11]) s.px(dx, 2 + (Math.abs(dx) > 8 ? -2 : 0) + (dx < 0 ? 2 : 0), T.human, 1, 1);
  s.px(-12, 5, T.snow2); s.px(11, 4, T.snow2);
  return s;
}

/* ---------- the ring gate in the Prime Zone, half dug out of the ice, and the generator wired to it ---------- */
function gateSprites() {
  const out = [], cy = -26, inside = (dx, dy) => Math.hypot(dx / 15, dy / 24) < 1;
  const gate = new Sprite('gate', 'object', 64);
  for (let i = 0; i < 260; i++) {
    const a = i / 260 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let t = 0; t < 4; t++) { const y = cy + sa * (25 + t); if (y <= 3) gate.px(ca * (16 + t), y, sa < -.6 && t === 3 ? T.snow2 : ca < -.2 ? T.metal : T.metal2); }
    if (i % 26 === 0) gate.px(ca * 17, cy + sa * 26, T.glow, 1, 1);
  }
  haze(gate, 0, cy, 30, .16);
  out.push(gate);
  for (let f = 0; f < 6; f++) {   // the membrane flickers
    const m = new Sprite('gate_membrane_' + f, 'glow', 64); m.glowOnly = true;
    for (let dy = -24; dy <= 24; dy++) for (let dx = -15; dx <= 15; dx++) if (inside(dx, dy)) m.px(dx, cy + dy, hash(dx + (dy >> 1), dy + f * 7, 51) < .5 ? T.glow : T.glowHi, .28 + .3 * hash(dx >> 1, (dy >> 2) + f * 3, 52), 2);
    out.push(m);
  }
  const gen = new Sprite('generator', 'object', 32);
  for (let k = 0; k <= 14; k++) gen.px(-14 + k, -3 + Math.round(Math.sin(k / 14 * Math.PI) * 3), mix(T.metal2, BLACK, .4));
  box(gen, 0, 0, 6, 6, T.metal, T.metal2, mix(T.metal2, BLACK, .3));
  gen.px(-3, -4, T.human, 1, 1); gen.px(2, -3, T.human, 1, 1); gen.px(0, -10, T.snow2); gen.px(-1, -10, T.snow2);
  out.push(gen);
  return out;
}

/* ---------- the crashed rescue capsule: something to salvage ---------- */
// The capsule came in along the columns and lies with its nose in the snow towards larger columns.
// It stands on one tile and hangs over its neighbours; keep the tiles around it free.
const TAIL = { x: -25, y: -35 }, NOSE = { x: 15, y: -5 }, HATCH = { x: -2, y: -13 };
function capsuleSprites() {
  const out = [], s = new Sprite('capsule', 'object', 64);
  for (let j = -10; j <= 10; j++) for (let x = -40 + Math.abs(j) * 2; x < 40 - Math.abs(j) * 2; x++) s.px(x - 6, 2 + j, BLACK, .3);
  // the parachute, dragged along and frozen stiff behind the tail
  for (let dy = -7; dy <= 7; dy++) for (let dx = -15; dx <= 15; dx++) {
    if (Math.hypot(dx / 15, dy / 7) + (hash(dx >> 1, dy, 80) - .5) * .25 >= 1) continue;
    let col = frac((dx + dy * 2) / 7) < .5 ? T.human : T.chute; if (hash(dx >> 1, dy >> 1, 81) < .3) col = mix(col, BLACK, .25); if (dy < -3) col = mix(col, T.snow2, .6);
    s.px(TAIL.x - 18 + dx, TAIL.y + 12 + dy, col);
  }
  for (const [x1, y1] of [[TAIL.x - 9, TAIL.y + 9], [TAIL.x - 12, TAIL.y + 15], [TAIL.x - 6, TAIL.y + 6]]) { const n = 10; for (let k = 0; k <= n; k++) s.px(TAIL.x + (x1 - TAIL.x) * k / n, TAIL.y - 4 + (y1 - TAIL.y + 4) * k / n, T.chute, .8); }
  // the hull: a tube from the tail down to the nose, lit from the top left
  const steps = 84;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, cx = TAIL.x + (NOSE.x - TAIL.x) * t, cy = TAIL.y + (NOSE.y - TAIL.y) * t, r = t < .7 ? 13 : 13 - (t - .7) / .3 * 6;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const lit = .5 - (dx * .35 + dy * .75) / r * .55; let col = lit > .72 ? T.hullHi : lit > .34 ? T.hull : T.hullLo;
      if (i % 14 === 0) col = mix(col, BLACK, .35);
      if (t > .22 && t < .31) col = mix(T.human, col, lit > .34 ? .15 : .5);
      if (t > .66) col = mix(col, BLACK, .5 * (t - .66) / .34);
      if (dy < -r * .78 && hash(Math.round(cx) + dx, i, 82) < .3) col = T.snow2;
      s.px(cx + dx, cy + dy, col);
    }
  }
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) s.px(TAIL.x + 9 + dx, TAIL.y + 9 + dy, dx * dx + dy * dy <= 4 ? T.glow : T.hullLo, 1, dx * dx + dy * dy <= 4 ? 1 : 0);
  // the open hatch: a dark opening with the cabin light on, the door hanging below it
  for (let dy = -7; dy <= 7; dy++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx / 5, dy / 7); if (d > 1) continue;
    if (d > .78) s.px(HATCH.x + dx, HATCH.y + dy, T.hullLo); else if (dy > 1) s.px(HATCH.x + dx, HATCH.y + dy, T.human, 1, 1); else s.px(HATCH.x + dx, HATCH.y + dy, mix(T.human, BLACK, .7));
  }
  for (let k = 0; k < 9; k++) for (let i = 0; i < 8; i++) s.px(HATCH.x + 4 + i + (k >> 1), HATCH.y + 7 + k - (i >> 1), i === 0 || k === 8 ? T.hullLo : T.hull);
  haze(s, HATCH.x, HATCH.y + 3, 12, .25, T.human);
  // snow thrown up around the nose
  for (const [mx, my, mr] of [[NOSE.x + 4, NOSE.y + 3, 9], [NOSE.x - 7, NOSE.y + 9, 7], [NOSE.x + 12, NOSE.y - 3, 6], [NOSE.x + 2, NOSE.y + 11, 6], [NOSE.x - 16, NOSE.y + 12, 5]]) for (let dy = -mr; dy <= mr * .6; dy++) for (let dx = -mr; dx <= mr; dx++) if (Math.hypot(dx, dy * 1.5) < mr) s.px(mx + dx, my + dy, dy < -mr * .25 ? mix(T.snow2, WHITE, .35) : hash(dx, dy, 83) < .5 ? T.snow2 : T.snow);
  // the antenna on the tail; its light is a separate animation
  for (let k = 0; k <= 9; k++) s.px(TAIL.x + 2, TAIL.y - 12 - k, T.metal);
  out.push(s);
  for (let f = 0; f < 4; f++) {
    const b = new Sprite('capsule_beacon_' + f, 'glow', 64); b.glowOnly = true;
    const k = [1, .55, .15, .55][f];
    haze(b, TAIL.x + 2, TAIL.y - 22, Math.round(3 + 5 * k), .5 * k, T.human);
    b.px(TAIL.x + 2, TAIL.y - 22, k > .5 ? WHITE : T.human, .4 + .6 * k, 1); b.px(TAIL.x + 2, TAIL.y - 23, T.human, .3 + .7 * k, 1);
    out.push(b);
  }
  for (let f = 0; f < 6; f++) {   // steam from the hot nose
    const st = new Sprite('capsule_steam_' + f, 'object', 64);
    for (let p = 0; p < 4; p++) {
      const age = ((f + p * 1.5) % 6) / 6, x = NOSE.x + 4 + p * 3 + age * 6, y = NOSE.y - 4 - age * 22, r = 2 + age * 4;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && hash(dx + p * 9, dy + f * 5, 84) < .75) st.px(x + dx, y + dy, T.snow2, .5 * (1 - age));
    }
    out.push(st);
  }
  return out;
}
function trenchSprite() {   // the furrow the capsule ploughed, three tiles long, towards smaller columns
  const s = new Sprite('capsule_trench', 'decal', 80);
  for (let y = -40; y < 16; y++) for (let x = -76; x < 4; x++) {
    const a = (x + .5) / HW, b = (y + .5) / HH, u = (a + b) / 2, v = (b - a) / 2;
    if (u > -.9 || u < -4) continue;
    const taper = Math.min(1, (u + 4) / .8), edge = Math.abs(v) / taper + (hash(x >> 1, y, 85) - .5) * .08;
    if (edge < .2) s.px(x, y, hash(x, y, 86) < .12 ? mix(T.seam, BLACK, .4) : mix(T.snow, T.seam, .55));
    else if (edge < .36) s.px(x, y, mix(T.snow2, WHITE, v < 0 ? .4 : .1));
  }
  return s;
}
function caseSprite() {   // what is to be salvaged: the flight recorder in its case
  const s = new Sprite('salvage_case', 'object', 24);
  for (let j = -2; j <= 2; j++) for (let x = -7 + Math.abs(j) * 2; x < 7 - Math.abs(j) * 2; x++) s.px(x, 2 + j, BLACK, .3);
  box(s, 0, 1, 7, 6, T.human, mix(T.human, BLACK, .25), mix(T.human, BLACK, .5));
  for (let k = 0; k <= 6; k++) { s.px(-4, -k, T.metal2); s.px(3, 1 - k, T.metal2); }
  s.px(0, -8, WHITE, 1, 1); s.px(-1, -8, T.glow, 1, 1); s.px(0, -9, T.glow, 1, 1); haze(s, 0, -8, 5, .35);
  return s;
}
function debrisSprite(name, n) {
  const s = new Sprite(name, 'object', 24);
  for (let i = 0; i < 3 + n; i++) {
    const bx = (hash(n, i, 87) - .5) * 20, by = (hash(i, n, 88) - .5) * 8, w = 2 + Math.floor(hash(n + 3, i, 89) * 4);
    for (let x = 0; x < w; x++) for (let y = 0; y < 2; y++) s.px(bx + x, by - y + (x >> 1), i === 0 && x < 2 ? T.human : y ? T.hull : T.hullLo);
  }
  return s;
}
function flakeSprite(name, n) {
  const s = new Sprite(name, 'glow', 8); s.glowOnly = true;
  s.px(0, 0, WHITE, n === 3 ? .5 : .9, 2); if (n >= 1 && n < 3) s.px(1, 0, WHITE, .7, 2); if (n === 2) { s.px(0, 1, WHITE, .7, 2); s.px(1, 1, WHITE, .5, 2); }
  return s;
}

/* ---------- the list of sprites ---------- */
function buildSprites() {
  const list = [], groups = {};
  const add = (s, group) => { list.push(s); if (group) (groups[group] = groups[group] || []).push(s.name); return s; };
  for (let n = 0; n < 6; n++) add(groundSprite('snow_' + n, 'snow', n), 'snow');
  for (let n = 0; n < 2; n++) add(groundSprite('camp_floor_' + n, 'camp', n + 10), 'camp_floor');
  for (let n = 0; n < 4; n++) add(groundSprite('outside_' + n, 'outside', n + 20), 'outside');
  for (let n = 0; n < 4; n++) add(groundSprite('outside_fade_' + n, 'outside', n + 30, .5), 'outside_fade');
  add(groundSprite('prime_floor', 'prime', 40));
  for (let n = 0; n < 3; n++) add(icePatch('ice_patch_' + n, n), 'ice_patch');
  for (let n = 0; n < 3; n++) add(icePool('ice_pool_' + n, n), 'ice_pool');
  for (const side in SIDES) add(decalSprite('prime_edge_' + side, primeBorder((u, v) => SIDES[side](u, v) < .26)));
  for (const corner in CORNERS) { const [a, b] = CORNERS[corner]; add(decalSprite('prime_corner_' + corner, primeBorder((u, v) => SIDES[a](u, v) < .26 && SIDES[b](u, v) < .26))); }
  add(primeRing());
  add(decalSprite('relic_floor', (u, v, x, y) => { const d = Math.hypot(u - .5, v - .5); return Math.abs(d - .4) < .045 || (d < .3 && frac(Math.atan2(v - .5, u - .5) / Math.PI * 3) < .12) ? [T.glow, 1, 1] : [mix(T.alien, T.alien2, hash(x >> 1, y >> 1, 8))]; }));
  add(decalSprite('pad_floor', (u, v, x, y) => { const d = Math.hypot(u - .5, v - .5); if (Math.abs(d - .36) < .05 || (Math.abs(u - .5) < .04 && d < .2) || (Math.abs(v - .5) < .04 && d < .2)) return [T.human, 1, 1]; if (u < .08 || v < .08) return [mix(T.metal2, BLACK, .3)]; return [hash(x, y, 9) < .08 ? T.snow : T.metal2]; }));
  for (const axis of ['col', 'row']) add(decalSprite('track_' + axis, track(axis)));
  for (const [i, h] of [19, 22, 24, 27, 30, 33].entries()) add(cliffSprite('cliff_' + i, i, { h }), 'cliff');
  add(cliffSprite('cliff_glyph', 8, { h: 24, glyph: true }));
  for (let n = 0; n < 2; n++) add(cliffSprite('cliff_low_' + n, n + 10, { low: true }), 'cliff_low');
  for (let n = 0; n < 2; n++) add(coverSprite('half_cover_' + n, n, HALF_COVER), 'half_cover');
  add(coverSprite('full_cover', 3, FULL_COVER));
  for (let n = 0; n < 6; n++) add(shrubSprite('shrub_' + n, n), 'shrub');
  for (let n = 0; n < 3; n++) add(steleSprite('stele_' + n, n), 'stele');
  add(relicSprite()); add(beaconSprite()); add(sledSprite());
  gateSprites().forEach(s => add(s, s.name.startsWith('gate_membrane_') ? 'gate_membrane' : null));
  capsuleSprites().forEach(s => add(s, s.name.startsWith('capsule_beacon_') ? 'capsule_beacon' : s.name.startsWith('capsule_steam_') ? 'capsule_steam' : null));
  add(trenchSprite()); add(caseSprite());
  for (let n = 0; n < 3; n++) add(debrisSprite('debris_' + n, n), 'debris');
  for (let n = 0; n < 4; n++) add(flakeSprite('flake_' + n, n), 'flake');
  add(lightSprite());
  return { list, groups };
}

/* ---------- the tiling snow layers and the aurora: single images, not in the atlas ---------- */
function snowLayer(count, big, alpha) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < count; i++) { const px = 2 + Math.floor(hash(i, count, 90) * 124), py = 2 + Math.floor(hash(count, i, 91) * 124), two = big && i % 4 === 0; x.fillStyle = 'rgba(255,255,255,' + (alpha * (.6 + .4 * hash(i, 3, 92))).toFixed(2) + ')'; x.fillRect(px, py, two ? 2 : 1, 1); if (two) x.fillRect(px, py + 1, 1, 1); }
  return c.toDataURL('image/png');
}
function auroraImage() {   // 256 px wide, repeats horizontally
  const c = document.createElement('canvas'); c.width = 256; c.height = 112; const x = c.getContext('2d'), w = Math.PI * 2 / 256;
  for (let px = 0; px < 256; px++) {
    const y0 = 26 + 16 * Math.sin(px * w) + 7 * Math.sin(px * w * 3 + 1), len = 44 + 24 * Math.sin(px * w * 2 + 2), on = .5 + .5 * Math.sin(px * w * 9) * Math.sin(px * w * 4);
    for (let k = 0; k < len; k++) { const col = k < len * .3 ? T.glowHi : T.glow; x.fillStyle = 'rgba(' + col.join(',') + ',' + (.36 * on * (1 - k / len)).toFixed(3) + ')'; x.fillRect(px, Math.round(y0 + k), 1, 1); }
  }
  return c.toDataURL('image/png');
}

function buildAtlas() {
  const { list, groups } = buildSprites();
  const { png, json, info } = packAtlas(list, groups, { prefix: 'ice.', image: 'polarnacht.png', app: 'primefall ice-field tileset' });
  const tileset = {
    name: 'polarnacht', prefix: 'ice.', tile: { w: HW * 2, h: HH * 2 }, halfCoverHeight: HALF_COVER, fullCoverHeight: FULL_COVER,
    origin: 'every sprite has its anchor on the centre of the tile it stands on',
    projection: { x: '(col - row) * 16', y: '(col + row) * 8' },
    lighting: lightingManifest(LIGHTING),
    snow: SNOW, aurora: { image: 'aurora.png', width: 256, height: 112 }, sky: LOOK.sky,
    groups: Object.fromEntries(Object.entries(groups).map(([g, names]) => [g, names])),
    sprites: info
  };
  return { png, json, tileset, snowNear: snowLayer(26, true, SNOW.near.alpha), snowFar: snowLayer(44, false, SNOW.far.alpha), aurora: auroraImage() };
}
