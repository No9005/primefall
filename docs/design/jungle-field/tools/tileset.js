// Draws the tiles of the jungle map look pixel by pixel and packs them into one atlas.
// Runs in a browser page after docs/design/tools/pixel-atlas.js (export.mjs loads both). Every sprite is drawn
// around its own origin: the centre of the tile it stands on. Nothing here knows a map; assemble.js builds maps.
// The drawing code comes from the artifact "Swamp Map Proposals" (2026-11-14), cut into single sprites.

const TILESET = { name: 'fiebermoor', prefix: 'jungle.', image: 'fiebermoor.png' };   // the working name of the map
const PLATFORM_HEIGHT = 44;    // px a wooden platform stands above the floor
const HALF_COVER = 10, FULL_COVER = 22;

// The colours as seen. The sheet stores tiles brighter than they are seen (LIGHT_SCALE), so Pen divides them by it.
const PALETTE = {
  mudD: '#23231a', mud: '#312e1f', mudM: '#3d3826', mudL: '#4d4630', mudH: '#5c5339',
  grassD: '#17301d', grass: '#25502a', grassM: '#2f6430', grassL: '#44802f', grassH: '#7fb04a',
  waterD: '#0b2f33', water: '#14595a', waterM: '#1c7068', waterL: '#3fa59a', waterH: '#9be0cf',
  barkD: '#1d140c', bark: '#33241a', barkM: '#4a3623', barkL: '#6b4d31', barkH: '#8b6a42',
  leafD: '#0d2616', leaf: '#143a20', leafM: '#1d5028', leafL: '#2b6f32', leafH: '#58a040',
  vine: '#2e6a34', vineL: '#4f9340',
  stoneD: '#2c332f', stone: '#454f49', stoneM: '#5a655d', stoneL: '#76837a', moss: '#59803a',
  glow: '#9be37a', glowL: '#d8ffb8', amber: '#e8c25a',
  woodD: '#3f2915', wood: '#6c4623', woodM: '#8a5e34', woodL: '#b0804a', rope: '#c9b07a',
  metal: '#2a3438', metalL: '#3c4a4f', drop: '#2ec4b6',
  fly: '#e6ff8a', frog: '#7fcf56', frogD: '#3f7f30', mist: '#96beaa'
};
const C = {}; for (const k in PALETTE) C[k] = rgb(PALETTE[k]);
// Light: the ambient is neutral (the colours above are final); the lights are there for a game that wants a darker night.
const LIGHTING = {
  ambient: [1.5, 1.5, 1.5],
  artefact: { color: '#9be37a', intensity: .6, radius: 70 },
  centre: { color: '#9be37a', intensity: .5, radius: 120 },
  lamp: { color: '#e8c25a', intensity: .6, radius: 60 },
  firefly: { color: '#e6ff8a', intensity: .25, radius: 22 }
};
const MIST = { image: 'mist.png', size: 256, speed: [10, 4], alpha: .5 };

/* ---------- noise ---------- */
const vnoise = (x, y, s) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; const t = Math.imul(s ^ (s >>> 13), 3266489909); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
}

/* ---------- a pen: the drawing calls of the artifact on top of a Sprite ---------- */
const DIM = 1 / LIGHT_SCALE;
const dim = c => [c[0] * DIM, c[1] * DIM, c[2] * DIM];
class Pen {
  constructor(sprite) { this.s = sprite; }
  set(x, y, c, a = 255) { this.s.px(x, y, dim(c), a / 255); }
  light(x, y, c, a = 255) { this.s.px(x, y, c, a / 255, 1); }       // a pixel with a light of its own
  haze(x, y, c, a = 255) { this.s.px(x, y, c, a / 255, 2); }        // a haze that exists on the glow layer only
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c, a = 255) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.set(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  disc(cx, cy, r, fn) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) { const col = fn(x, y); if (col) this.set(cx + x, cy + y, col[0], col[1] ?? 255); }
  }
}
function ellipseFill(pen, cx, cy, rx, ry, fn) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) { const col = fn(x, y); if (col) pen.set(cx + x, cy + y, col); }
}
const object = (name, half, layer, draw) => { const s = new Sprite(name, layer, half); draw(new Pen(s), s); return s; };
const SIDES = { n: (u, v) => v, s: (u, v) => 1 - v, w: (u, v) => u, e: (u, v) => 1 - u };

/* ---------- the ground: one sprite per tile, the noise shifted per variant ---------- */
function groundSprite(name, kind, n) {
  const s = new Sprite(name, 'floor', 24), pen = new Pen(s);
  eachTilePixel((x, y, u, v) => {
    const a = u - .5, b = v - .5, px = x + n * 61, py = y + n * 37;
    const h1 = hash(px, py, 1), h2 = hash(px >> 1, py >> 1, 2), big = vnoise(px / 9, py / 5, 4);
    let col;
    if (kind === 'mud') {
      col = h1 < .07 ? C.mudD : h1 > .93 ? C.mudL : big > .6 ? C.mudM : C.mud;
      if (h2 > .985) col = C.mudH;
    } else if (kind === 'grass') {
      col = big > .62 ? C.grassM : C.grass;
      if (h1 < .1) col = C.grassD; else if (h1 > .9) col = C.grassL;
      if (h1 > .985) col = C.grassH;
    } else if (kind === 'water') {
      const ripple = ((py + Math.floor(hash(px >> 2, py >> 1, 5) * 7)) % 4 === 0) && hash(px >> 1, py, 6) > .62;
      col = big > .55 ? C.water : C.waterD;
      if (big > .72) col = C.waterM;
      if (ripple) col = C.waterL;
      if (h1 > .995) col = C.waterH;
    } else if (kind === 'ford') {   // stepping stones in dark water
      const on = Math.abs(a) + Math.abs(b) < .62;
      col = on ? (h1 > .8 ? C.stoneL : h1 < .2 ? C.stoneD : C.stoneM) : hash(px, py, 8) > .4 ? C.waterD : C.water;
      if (on && Math.abs(a) + Math.abs(b) > .5) col = C.stoneD;
    } else {   // 'stone' (the Prime Zone, the Outposts) and 'drop'
      if (kind === 'drop') {
        col = (Math.floor((a + .5) * 4) + Math.floor((b + .5) * 4)) % 2 ? C.metal : C.metalL;
        if (Math.abs(a) > .43 || Math.abs(b) > .43) col = C.drop;
        if (h1 < .05) col = C.metal;
      } else {
        const slab = Math.floor((a + .5) * 2) + Math.floor((b + .5) * 2);
        col = slab % 2 ? C.stoneM : C.stone;
        if (h1 < .08) col = C.stoneD; else if (h1 > .94) col = C.stoneL;
        if (Math.abs(((a + .5) * 2) % 1 - .5) > .47 || Math.abs(((b + .5) * 2) % 1 - .5) > .47) col = C.stoneD;
        if (vnoise(px / 6, py / 4, 9) > .7 && h1 > .45) col = hash(px, py, 3) > .5 ? C.moss : C.grassM;
      }
    }
    pen.set(x, y, col);
  });
  return s;
}
function decalSprite(name, fn) {
  const s = new Sprite(name, 'decal', 24), pen = new Pen(s);
  eachTilePixel((x, y, u, v) => { const c = fn(u, v, x, y); if (c) pen.set(x, y, c); });
  return s;
}
// The mud rim on the side of a water tile that faces the land.
const bankSprite = side => decalSprite('water_bank_' + side, (u, v, x, y) => (SIDES[side](u, v) < .14 ? (hash(x, y, 7) > .5 ? C.mud : C.mudD) : null));
// The amber band on the edge of a Prime Zone tile, on the side that faces the outside.
const primeEdgeSprite = side => decalSprite('prime_edge_' + side, (u, v) => (SIDES[side](u, v) < .12 ? C.amber : null));

/* ---------- things that grow ---------- */
function blades(pen, x, y, n, seed, hmin, hmax) {
  const rand = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x + Math.round((rand() - .5) * 12), by = y + Math.round((rand() - .5) * 5);
    const len = hmin + Math.floor(rand() * (hmax - hmin)), lean = (rand() - .5) * 6;
    const col = rand() > .55 ? C.grassL : rand() > .5 ? C.grassM : C.grassH;
    for (let k = 0; k < len; k++) {
      const kx = bx + Math.round((lean * k * k) / (len * len));
      pen.set(kx, by - k, k > len - 3 ? C.grassH : col);
      if (k < len - 1 && k % 3 === 0) pen.set(kx + 1, by - k, C.grassD);
    }
  }
}
function rootWall(pen, x, y, seed) {
  const rand = rng(seed);
  for (let i = 0; i < 4; i++) {
    const ox = Math.round((rand() - .5) * 16), oy = Math.round((rand() - .5) * 6), rx = 8 + Math.floor(rand() * 5), ry = 4 + Math.floor(rand() * 3), hh = 9 + Math.floor(rand() * 8);
    for (let k = 0; k < hh; k++) ellipseFill(pen, x + ox, y + oy - k, rx - Math.floor(k / 5), ry, (px, py) => {
      const edge = (px / rx) ** 2 + (py / ry) ** 2 > .7;
      return k === hh - 1 ? (hash(px + ox, k, 7) > .6 ? C.moss : C.barkL) : px < -rx * .3 ? C.barkM : edge ? C.barkD : C.bark;
    });
  }
  for (let i = 0; i < 6; i++) { const mx = x + Math.round((rand() - .5) * 22), my = y - 8 - Math.floor(rand() * 8); pen.set(mx, my, C.grassM); pen.set(mx + 1, my, C.moss); }
}
function treeTrunk(pen, x, y, seed) {   // a tapering column with a rounded foot, roots flaring on the ground
  const Ht = 124, W0 = 31, W1 = 21;
  for (let rt = 0; rt < 6; rt++) {
    const ang = (rt / 6) * Math.PI * 2 + .4, len = 30 + hash(rt, seed, 1) * 18;
    const ex = x + Math.cos(ang) * len * 1.3, ey = y + Math.sin(ang) * len * .62;
    for (let w = 4; w >= 0; w--) pen.line(x + Math.cos(ang) * 14, y + Math.sin(ang) * 7 - w, ex, ey - w * .5, w > 2 ? C.barkD : w > 0 ? C.barkM : C.barkL);
  }
  for (let xx = -W0; xx <= W0; xx++) {
    const foot = Math.round(Math.sqrt(Math.max(0, 1 - (xx / W0) ** 2)) * 15);
    for (let yy = -Ht; yy <= foot; yy++) {
      const w = W1 + (W0 - W1) * (1 - Math.abs(yy) / Ht);
      if (Math.abs(xx) > w + (yy > -10 ? 2 : 0)) continue;
      const nx = xx / W0, ridge = hash(Math.floor((xx + 40) / 2.6), 3, seed), tw = Math.sin(yy * .05 + ridge * 6) * 1.2;
      let col = nx < -.45 ? C.barkL : nx < -.05 ? C.barkM : nx < .5 ? C.bark : C.barkD;
      if (ridge > .72 && Math.abs(nx) < .92) col = nx < 0 ? C.barkM : C.barkD;
      if (Math.abs(Math.abs(xx) - w) < 1.5) col = C.barkD;
      if (hash(xx, yy, seed + 4) > .97 + (nx < -.2 ? .01 : 0)) col = C.barkH;
      if (vnoise((xx + tw) / 4, yy / 11, seed) > .72 && yy > -70) col = hash(xx, yy, 9) > .55 ? C.moss : C.grassM;
      pen.set(x + xx, y + yy, col);
    }
  }
  ellipseFill(pen, x, y + 1, W0 - 2, 7, (px, py) => (py > 2 ? C.barkD : null));
}
function treeCanopy(pen, x, y, seed, spread) {   // the crown and the lianas; x, y is the foot of the trunk
  const top = y - 124, rand = rng(seed), blobs = [];
  for (let i = 0; i < 58; i++) {
    const ang = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 62 * spread;
    blobs.push([x + Math.cos(ang) * d * 1.55, top + Math.sin(ang) * d * .5 - (1 - d / (62 * spread)) * 18, 8 + rand() * 11]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, br] of blobs) pen.disc(Math.round(bx), Math.round(by), Math.round(br), (px, py) => {
    const d = Math.hypot(px, py) / br, lit = (-px * .5 - py * .9) / br, n = hash(Math.round(bx) + px, Math.round(by) + py, seed);
    if (d > .7 && n < .35) return null;
    let col = lit > .35 ? C.leafL : lit > -.15 ? C.leafM : C.leaf;
    if (d > .86) col = C.leafD;
    if (n > .9 && lit > -.2) col = C.leafH;
    return [col, 236];
  });
  for (let i = 0; i < 13; i++) {
    const lx = Math.round(x + (rand() - .5) * 96 * spread), ly = Math.round(top + 8 + rand() * 16), len = 34 + Math.floor(rand() * 62);
    for (let k = 0; k < len; k++) {
      const sway = Math.round(Math.sin(k * .17 + i) * 1.4);
      pen.set(lx + sway, ly + k, k % 9 < 3 ? C.vineL : C.vine, 230);
      if (k % 11 === 5) { pen.set(lx + sway - 1, ly + k, C.leafL, 220); pen.set(lx + sway + 1, ly + k + 1, C.leafM, 220); }
    }
    pen.set(lx, ly + len, C.leafH, 230);
  }
}

/* ---------- things that stand ---------- */
function artefactSprite() {   // the find in the middle of the Prime Zone; its body and halo glow
  return object('artefact', 64, 'object', (pen, s) => {
    for (let i = 20; i > 0; i--) for (let y = -i; y <= i; y++) for (let x = -i; x <= i; x++) if (x * x + y * y <= i * i + i * .6) pen.haze(x, 5 - 18 + y, C.glow, Math.max(0, 36 - i * 1.6));
    for (let yy = -17; yy <= 9; yy++) {
      const w = yy < 0 ? Math.round(((yy + 17) / 17) * 8) : Math.round(((9 - yy) / 9) * 8);
      for (let xx = -w; xx <= w; xx++) {
        const edge = Math.abs(xx) === w, lit = xx < -w * .2 ? C.glowL : xx > w * .4 ? C.leafM : C.glow;
        if (edge) pen.set(xx, 5 - 18 + yy, C.leafD); else pen.light(xx, 5 - 18 + yy, lit);
      }
    }
    pen.light(-3, 5 - 24, C.glowL); pen.light(-3, 5 - 23, C.glowL);
  });
}
function pillarSprite(name, h, seed) {   // a bare ruin pillar, drawn at the foot of the tile
  return object(name, 48, 'object', pen => {
    for (let yy = 0; yy < h; yy++) for (let xx = -4; xx <= 4; xx++) {
      const n = hash(xx, yy, seed), col = xx < -1 ? C.stoneL : xx < 2 ? C.stoneM : C.stoneD;
      pen.set(xx, 3 - yy, n > .93 ? C.moss : n < .07 ? C.stoneD : col);
    }
    pen.rect(-5, 3 - h, 11, 2, C.stoneL); pen.rect(-5, 2, 11, 2, C.stoneD);
    if (hash(seed, 5) > .4) for (let k = 0; k < 8; k++) pen.set(-4 + (k % 4), 3 - h + 2 + (k >> 2), C.moss);
  });
}
function lampSprite() {
  return object('lamp', 32, 'object', pen => {
    pen.rect(-1, 2 - 14, 2, 14, C.metalL);
    for (let i = 7; i > 0; i--) for (let y = -i; y <= i; y++) for (let x = -i; x <= i; x++) if (x * x + y * y <= i * i + i * .6) pen.haze(x, 2 - 16 + y, C.amber, 18);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9 + 1.8) pen.light(x, 2 - 16 + y, C.amber);
  });
}

/* ---------- the canopy village: a platform PLATFORM_HEIGHT above the floor, ladders and a lift basket ---------- */
const lift = z => -z;   // a height above the floor, as a y offset
function platformTop() {
  return object('platform_top', 48, 'object', pen => {
    const cy = lift(PLATFORM_HEIGHT);
    for (let dy = -HH; dy < HH; dy++) {
      const t = 1 - Math.abs(dy + .5) / HH, half = Math.round(HW * t);
      for (let dx = -half; dx < half; dx++) {
        const a = (dx / HW + dy / HH) / 2, plank = Math.floor((a + .5) * 5), n = hash(dx, cy + dy, 3);
        let col = plank % 2 ? C.woodM : C.woodL;
        if (Math.abs(((a + .5) * 5) % 1 - .5) > .46) col = C.woodD; else if (n > .93) col = C.woodD; else if (n < .05) col = C.rope;
        pen.set(dx, cy + dy, col);
      }
    }
  });
}
// The side faces of a platform tile: a plank wall of 7 px under the edge that faces the viewer. Left faces the rows, right the columns.
function platformFace(name, right) {
  return object(name, 48, 'object', pen => {
    const cy = lift(PLATFORM_HEIGHT);
    for (let i = 0; i < HW; i++) {
      const yl = Math.round(i / 2);
      for (let k = 0; k < 7; k++) {
        if (right) pen.set(HW - 1 - i, cy + yl + k, k === 6 ? C.woodD : k % 3 === 0 ? C.woodM : C.wood);
        else pen.set(-HW + i, cy + yl + k, k === 6 ? C.woodD : k % 3 === 0 ? C.wood : C.woodD);
      }
    }
  });
}
function platformPost(name, n) {   // a post from the ground to the platform, at one of the three free corners
  return object(name, 48, 'object', pen => {
    const dx = [0, -HW * .8, HW * .8][n], dy = [HH * .8, 0, 0][n];
    for (let k = 0; k <= PLATFORM_HEIGHT; k++) { pen.set(dx, dy - PLATFORM_HEIGHT + k - 2, k % 6 < 5 ? C.woodD : C.wood); pen.set(dx + 1, dy - PLATFORM_HEIGHT + k - 2, C.wood); }
  });
}
function ladderSprite() {
  return object('ladder', 48, 'object', pen => {
    const z = PLATFORM_HEIGHT;
    for (const off of [-4, 4]) for (let k = 0; k <= z; k++) pen.set(off, 2 - k, k % 2 ? C.rope : C.woodL);
    for (let k = 4; k <= z; k += 5) pen.rect(-4, 2 - k, 9, 1, C.woodM);
    pen.rect(-6, 3, 13, 1, C.woodD);
  });
}
function basketSprite() {
  return object('basket', 48, 'object', pen => {
    const z = PLATFORM_HEIGHT;
    for (let k = 14; k <= z + 4; k++) pen.set(0, -k, C.rope);
    pen.rect(-7, -z - 8, 15, 2, C.woodD); pen.rect(-1, -z - 8, 3, 7, C.woodD);
    for (let yy = 0; yy < 9; yy++) {
      const w = 7 - Math.floor(yy / 4);
      for (let xx = -w; xx <= w; xx++) pen.set(xx, -12 + yy, (xx + yy) % 3 === 0 ? C.woodD : (xx - yy) % 4 === 0 ? C.woodL : C.woodM);
    }
    pen.rect(-8, -13, 17, 2, C.woodL);
  });
}

/* ---------- small life: a frog that rises out of the grass and hides again, and a firefly ---------- */
function frogSprite(name, rise) {
  return object(name, 16, 'object', pen => {
    const x = 2, y = Math.round(1 - 2 * rise);
    pen.rect(x - 3, y - 3, 7, Math.round(4 * rise), C.frogD); pen.rect(x - 2, y - 3, 5, Math.round(3 * rise), C.frog);
    if (rise > .6) { pen.rect(x - 3, y - 5, 2, 2, C.fly); pen.rect(x + 2, y - 5, 2, 2, C.fly); }
  });
}
function fireflySprite(name, a) {   // a glow only: the core and two rings, drawn on the glow layer
  const s = new Sprite(name, 'glow', 8); s.glowOnly = true; const pen = new Pen(s);
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) pen.haze(x, y, C.fly, 255 * a * .16);
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) pen.haze(x, y, C.fly, 255 * a * .28);
  for (let y = -1; y <= 0; y++) for (let x = -1; x <= 0; x++) pen.haze(x, y, [250, 255, 200], 255 * a);
  return s;
}

function buildSprites() {
  const list = [], groups = {};
  const add = (s, group) => { list.push(s); if (group) (groups[group] = groups[group] || []).push(s.name); return s; };
  for (let n = 0; n < 4; n++) add(groundSprite('mud_' + n, 'mud', n), 'mud');
  for (let n = 0; n < 4; n++) add(groundSprite('grass_' + n, 'grass', n + 10), 'grass');
  for (let n = 0; n < 4; n++) add(groundSprite('water_' + n, 'water', n + 20), 'water');
  for (let n = 0; n < 2; n++) add(groundSprite('ford_' + n, 'ford', n + 30), 'ford');
  add(groundSprite('prime_floor', 'stone', 40));
  for (let n = 0; n < 2; n++) add(groundSprite('outpost_floor_' + n, 'stone', n + 50), 'outpost_floor');
  add(groundSprite('drop_floor', 'drop', 60));
  for (const side in SIDES) add(bankSprite(side));
  for (const side in SIDES) add(primeEdgeSprite(side));
  for (let n = 0; n < 4; n++) add(object('reeds_' + n, 32, 'object', pen => blades(pen, 0, 3, 7, n * 31 + 7, 9, 15)), 'reeds');
  for (let n = 0; n < 3; n++) add(object('tuft_' + n, 32, 'object', pen => blades(pen, 0, 3, 3, n * 13 + 5, 4, 7)), 'tuft');
  for (let n = 0; n < 4; n++) add(object('root_wall_' + n, 48, 'object', pen => rootWall(pen, 0, 3, n * 17 + 3)), 'root_wall');
  for (let n = 0; n < 2; n++) add(object('tree_trunk_' + n, 192, 'object', pen => treeTrunk(pen, 0, 8, n * 5 + 3)), 'tree_trunk');
  for (let n = 0; n < 2; n++) add(object('tree_canopy_' + n, 256, 'top', pen => treeCanopy(pen, 0, 8, n * 5 + 3, .8)), 'tree_canopy');
  add(artefactSprite());
  for (let n = 0; n < 3; n++) add(pillarSprite('pillar_' + n, 18 + n * 4, n * 7 + 1), 'pillar');
  add(lampSprite());
  add(platformTop()); add(platformFace('platform_face_l', false)); add(platformFace('platform_face_r', true));
  for (let n = 0; n < 3; n++) add(platformPost('platform_post_' + n, n), 'platform_post');
  add(ladderSprite()); add(basketSprite());
  [.35, .7, 1, .7, .35].forEach((r, n) => add(frogSprite('frog_' + n, r), 'frog'));
  [.2, .6, 1, .6].forEach((a, n) => add(fireflySprite('firefly_' + n, a), 'firefly'));
  add(lightSprite());
  return { list, groups };
}

/* ---------- the mist: one tiling image, not in the atlas ---------- */
function mistImage() {   // 256 x 256, repeats in both directions
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), img = x.createImageData(N, N);
  const wrap = (px, py, cell) => { const g = N / cell, fx = px / cell, fy = py / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const h = (i, j) => hash(((i % g) + g) % g, ((j % g) + g) % g, 12), u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    return h(x0, y0) * (1 - u) * (1 - v) + h(x0 + 1, y0) * u * (1 - v) + h(x0, y0 + 1) * (1 - u) * v + h(x0 + 1, y0 + 1) * u * v; };
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const n = wrap(px, py, 64) * .6 + wrap(px, py, 32) * .4, a = Math.max(0, n - .5) * 2.2, i = (py * N + px) * 4;
    img.data[i] = C.mist[0]; img.data[i + 1] = C.mist[1]; img.data[i + 2] = C.mist[2]; img.data[i + 3] = Math.round(Math.min(1, a) * 255 / 4) * 4;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function buildAtlas() {
  const { list, groups } = buildSprites();
  const { png, json, info } = packAtlas(list, groups, { prefix: TILESET.prefix, image: TILESET.image, app: 'primefall jungle-field tileset' });
  const tileset = {
    name: TILESET.name, prefix: TILESET.prefix, tile: { w: HW * 2, h: HH * 2 }, halfCoverHeight: HALF_COVER, fullCoverHeight: FULL_COVER, platformHeight: PLATFORM_HEIGHT,
    origin: 'every sprite has its anchor on the centre of the tile it stands on',
    projection: { x: '(col - row) * 16', y: '(col + row) * 8' },
    lighting: lightingManifest(LIGHTING),
    mist: MIST,
    groups: Object.fromEntries(Object.entries(groups).map(([g, names]) => [g, names])),
    sprites: info
  };
  return { png, json, tileset, mist: mistImage() };
}
