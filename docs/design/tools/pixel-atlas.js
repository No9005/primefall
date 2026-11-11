// Shared by the pixel-art tilesets under docs/design (reactor-deck, ice-field). Runs in a browser page.
// It holds what every tileset needs: a sprite to draw pixels into, the light sprite, the packer that writes the
// PixiJS sheet, and the stage that builds a lit picture from a packed atlas.

const HW = 16, HH = 8;   // half the width and half the height of a tile diamond
// The tiles are stored brighter than they are seen: the light map is multiplied over them and may go up to
// LIGHT_SCALE times "full" light. LIGHT_RADIUS is the radius of the one light sprite; lights are scaled from it.
const LIGHT_SCALE = 1.5, LIGHT_RADIUS = 96;

const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const frac = x => x - Math.floor(x);
const hash = (a, b, c = 0) => { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

/* ---------- a sprite: base pixels and glowing pixels around an origin (the centre of its tile) ---------- */
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

// Calls fn(x, y, u, v) for every pixel of a tile diamond: x, y from the tile centre, u along the columns, v along the rows.
function eachTilePixel(fn) {
  for (let j = 0; j < 16; j++) {
    const w = 2 * (j < 8 ? j + 1 : 16 - j);
    for (let x = -w; x < w; x++) { const a = (x + .5) / HW, b = (j + .5) / HH; fn(x, j - HH, (a + b) / 2, (b - a) / 2); }
  }
}

/* ---------- one light pool: white, stepped, wider than tall like the floor; tinted and added in the light map ---------- */
function lightSprite() {
  const s = new Sprite('light', 'light', 128); s.glowOnly = true;
  for (let y = -Math.ceil(LIGHT_RADIUS / 1.1); y <= LIGHT_RADIUS / 2; y++) for (let x = -LIGHT_RADIUS; x <= LIGHT_RADIUS; x++) {
    const d = Math.hypot(x, y < 0 ? y * 1.1 : y * 2) / LIGHT_RADIUS; if (d >= 1) continue;
    s.px(x, y, WHITE, Math.ceil(Math.pow(1 - d, 1.5) * 6) / 6, 2);
  }
  return s;
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
// list: the sprites; groups: { group: [sprite names] }; o: { prefix, image, app }.
// Returns the sheet as a data URL, its PixiJS JSON and, per sprite, its layer, its glow frame and its length in tiles.
function packAtlas(list, groups, o) {
  const frames = [], info = {};
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
    out[o.prefix + f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, anchor: { x: f.ax / f.w, y: f.ay / f.h } };
  }
  const animations = {}; for (const g in groups) animations[o.prefix + g] = groups[g].map(n => o.prefix + n);
  const json = { frames: out, animations, meta: { app: o.app, version: '1', image: o.image, format: 'RGBA8888', size: { w: sheet.width, h: sheet.height }, scale: '1' } };
  return { png: sheet.toDataURL('image/png'), json, info };
}
// The lighting block of a tileset.json: the ambient colour and, per kind of light, tint, alpha and scale for the light sprite.
function lightingManifest(lighting) {
  const amb = lighting.ambient.map(v => Math.round(v / LIGHT_SCALE * 255));
  const lights = {};
  for (const k in lighting) if (k !== 'ambient') lights[k] = { color: lighting[k].color, alpha: Number((lighting[k].intensity / LIGHT_SCALE).toFixed(3)), scale: Number((lighting[k].radius / LIGHT_RADIUS).toFixed(3)) };
  return { lightScale: LIGHT_SCALE, lightSpriteRadius: LIGHT_RADIUS, ambient: '#' + amb.map(v => v.toString(16).padStart(2, '0')).join(''), lights };
}

/* ---------- the stage: three layers that make a lit picture from a packed atlas ---------- */
// put(name, x, y): a sprite on the map. tile(name, x, y): the same, and its glow on the glow layer.
// glowOnly(name, x, y): a sprite on the glow layer. lamp(kind, x, y): a light. finish(): the picture.
function stage(image, json, tileset, W, H) {
  const P = tileset.prefix, L = tileset.lighting, lights = [];
  const canvas = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
  const map = canvas(), glow = canvas(), light = canvas();
  const draw = (ctx, name, x, y) => {
    const f = json.frames[P + name]; if (!f) throw new Error('no frame ' + name);
    const dx = Math.round(x - f.anchor.x * f.frame.w), dy = Math.round(y - f.anchor.y * f.frame.h);
    ctx.drawImage(image, f.frame.x, f.frame.y, f.frame.w, f.frame.h, dx, dy, f.frame.w, f.frame.h);
  };
  const put = (name, x, y) => {
    draw(map, name, x, y);
    // Whatever is put on the map hides the glow of what stands behind it. (In PixiJS: draw the scene a second time
    // with every non-glow sprite tinted black and add that picture on top; see the README of a tileset.)
    glow.globalCompositeOperation = 'destination-out'; draw(glow, name, x, y); glow.globalCompositeOperation = 'source-over';
  };
  const glowOnly = (name, x, y) => draw(glow, name, x, y);
  const tile = (name, x, y) => { put(name, x, y); const g = tileset.sprites[name] && tileset.sprites[name].glow; if (g) glowOnly(g, x, y); };
  const lamp = (kind, x, y) => lights.push({ ...L.lights[kind], x, y });
  const finish = () => {
    // the light map: the ambient colour, every light added on top, then multiplied over the map
    light.fillStyle = L.ambient; light.fillRect(0, 0, W, H);
    const one = document.createElement('canvas'), f = json.frames[P + 'light'].frame, a = json.frames[P + 'light'].anchor;
    for (const l of lights) {
      one.width = Math.ceil(f.w * l.scale); one.height = Math.ceil(f.h * l.scale);
      const o = one.getContext('2d'); o.imageSmoothingEnabled = false;
      o.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, one.width, one.height);
      o.globalCompositeOperation = 'source-in'; o.fillStyle = l.color; o.fillRect(0, 0, one.width, one.height);
      light.globalCompositeOperation = 'lighter'; light.globalAlpha = l.alpha;
      light.drawImage(one, Math.round(l.x - a.x * one.width), Math.round(l.y - a.y * one.height));
    }
    const out = canvas();
    out.drawImage(map.canvas, 0, 0);
    out.globalCompositeOperation = 'multiply'; out.drawImage(light.canvas, 0, 0);
    out.globalCompositeOperation = 'destination-in'; out.drawImage(map.canvas, 0, 0);
    out.globalCompositeOperation = 'lighter'; out.drawImage(glow.canvas, 0, 0);
    return out.canvas;
  };
  return { put, tile, glowOnly, lamp, finish };
}
// The same hash as above under a second name, for layout rules (which variant on which tile).
const tileHash = hash;
