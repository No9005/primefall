// Rig, clips and effects of the pixel-art Bruiser. This file is the body of a function: export.mjs wraps it
// together with export-tail.js and calls it once in a browser page. It needs a DOM (canvas).
const SW = 136, SH = 104, OX = 58, OY = 86, FRAME = 50;
const P = { suit: '#34506e', hi: '#6f93b8', lo: '#1f3247', under: '#2a2e36', underLo: '#1a1d23', metal: '#c3ccd4', metalLo: '#59636e', boot: '#1e232b', bootHi: '#3e4855', accent: '#c3ccd4', glow: '#7fe3ff', outline: [11, 15, 21] };
const B = { skin: '#c98f62', skinLo: '#99623f', hair: '#f1f4f5', hairLo: '#b4bfc7', scar: '#8e2f2f', blind: '#e6ddd0', eye: '#15171c', mouth: '#5b332c', cigar: '#6e4526', cigarBand: '#c9a14a', ember: '#ff8a2a', wood: '#8a5630', steel: '#59636e', steelHi: '#9aa6b2', steelLo: '#2e353d', glove: '#2b2f36' };

/* ---------- part sprites (local coordinates, pivot at 0,0) ---------- */
function part(x0, y0, x1, y1, draw) {
  const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { if (col) { g.fillStyle = col; g.fillRect(x - x0, y - y0, w, h); } else g.clearRect(x - x0, y - y0, w, h); };
  draw(R); return { c, x: x0, y: y0 };
}
const LEG = part(-6, 0, 6, 12, R => {
  R(-3, 0, 7, 8, P.under); R(0, 0, 1, 8, P.underLo); R(-4, 0, 1, 8, P.metalLo);
  R(-4, 2, 8, 4, P.suit); R(-4, 2, 8, 1, P.hi); R(-4, 5, 8, 1, P.lo);
  R(-5, 8, 11, 4, P.boot); R(-5, 8, 11, 1, P.bootHi);
});
const TORSO = part(-12, -29, 12, 0, R => {
  R(-8, -23, 16, 6, P.metalLo); R(-8, -23, 16, 1, P.metal);
  R(-11, -28, 3, 8, P.metalLo); R(-11, -28, 3, 1, P.glow); R(8, -27, 3, 7, P.metalLo); R(8, -27, 3, 1, P.glow);
  R(-8, -3, 16, 3, P.under); R(-8, -3, 16, 1, P.metalLo); R(-2, -3, 4, 2, P.accent);
  R(-7, -8, 14, 5, P.under); R(-7, -6, 14, 1, P.underLo); R(-8, -8, 1, 5, P.metal); R(7, -8, 1, 5, P.metalLo);
  R(-9, -18, 18, 10, P.suit); R(-9, -18, 18, 1, P.hi); R(-9, -18, 1, 9, P.hi);
  R(6, -17, 3, 9, P.lo); R(-9, -9, 18, 1, P.lo); R(-1, -16, 1, 6, P.lo);
  R(2, -15, 3, 3, P.glow); R(2, -13, 3, 1, P.metalLo); R(-6, -15, 3, 1, P.lo); R(-6, -13, 3, 1, P.lo);
  R(-4, -19, 9, 2, P.metalLo);
});
function padPart(side) {   // pivot at the inner edge of the plate stack
  const X = (x, w) => side < 0 ? -x - w + 1 : x;
  return part(-13, -5, 13, 5, R => {
    R(X(-1, 13), -4, 13, 4, P.suit); R(X(-1, 13), -4, 13, 1, P.metal); R(X(-1, 13), -1, 13, 1, P.lo);
    R(X(0, 11), 0, 11, 3, P.suit); R(X(0, 11), 0, 11, 1, P.hi); R(X(0, 11), 2, 11, 1, P.lo);
    R(X(0, 9), 3, 9, 3, P.suit); R(X(0, 9), 3, 9, 1, P.hi); R(X(0, 9), 5, 9, 1, P.lo);
  });
}
const PAD_L = padPart(-1), PAD_R = padPart(1);
function armPart(gun) {
  return part(-4, 0, 4, 27, R => {
    R(-3, 0, 6, 7, P.under);
    R(-4, 6, 8, 7, P.suit); R(-4, 6, 8, 1, P.hi); R(-4, 12, 8, 1, P.lo);
    if (gun) {
      R(-2, 15, 5, 5, B.steel); R(-3, 15, 1, 4, B.wood);
      R(-2, 20, 4, 7, B.steel); R(1, 20, 1, 7, B.steelHi); R(-2, 20, 1, 7, B.steelLo); R(-2, 26, 4, 1, B.steelLo);
    }
    R(-3, 13, 6, 4, B.glove);
  });
}
const ARM_B = armPart(false), ARM_F = armPart(true);
const HEAD = part(-6, -14, 6, 0, R => {
  const h = -14;
  R(-5, h + 3, 11, 9, B.skin); R(5, h + 3, 1, 8, B.skinLo); R(-5, h + 11, 1, 1, null); R(5, h + 11, 1, 1, null);
  R(-4, h + 12, 9, 1, B.skinLo); R(-2, h + 13, 5, 1, B.skinLo);
  R(-6, h, 13, 4, B.hair); R(-6, h, 1, 1, null); R(6, h, 1, 1, null);
  R(-6, h + 3, 13, 1, B.hairLo); R(-6, h + 4, 2, 3, B.hairLo); R(5, h + 4, 2, 2, B.hairLo); R(6, h + 1, 1, 2, B.hairLo);
  R(-6, h + 7, 1, 2, B.skinLo); R(-3, h + 5, 4, 1, B.hairLo); R(2, h + 5, 3, 1, B.hairLo);
  R(-2, h + 6, 2, 1, B.blind); R(2, h + 6, 2, 1, B.eye); R(2, h + 6, 1, 1, '#f3efe6');
  R(-2, h + 4, 1, 4, B.scar); R(-1, h + 8, 1, 1, B.scar);
  R(1, h + 7, 1, 2, B.skinLo); R(-4, h + 10, 9, 2, '#a9785a'); R(-1, h + 10, 4, 1, B.mouth);
});
const CIGAR = part(0, 0, 5, 0, R => { R(0, 0, 5, 1, B.cigar); R(2, 0, 1, 1, B.cigarBand); R(5, 0, 1, 1, B.ember); });

/* ---------- pose and tracks ---------- */
const REST = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, crouch: 0, bob: 0, lean: 0, stretch: 1, legL: 0, legR: 0, armF: -30, armB: 4, padL: 0, padR: 0, padDy: 0, head: 0, headDx: 0, headDy: 0, flip: 1, cigar: 0, cigarOff: 0, armFront: 0, flash: 0, grey: 0, alpha: 1, ringRed: 0 };
const EASE = {
  lin: x => x, io: x => x * x * (3 - 2 * x), out: x => 1 - Math.pow(1 - x, 3), in: x => x * x * x,
  back: x => { const c = 2.4, y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; },
  step: x => x < 1 ? 0 : 1
};
function tr(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const a = keys[i - 1], b = keys[i], u = (t - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * EASE[b[2] || 'io'](u);
  }
  return keys[keys.length - 1][1];
}
function poseAt(clip, t) {
  const p = Object.assign({}, REST);
  for (const k in clip.tracks) p[k] = tr(t, clip.tracks[k]);
  if (clip.pose) clip.pose(t, p);
  return p;
}

/* ---------- figure renderer: parts, then one outline around everything ---------- */
const fig = document.createElement('canvas'); fig.width = SW; fig.height = SH;
const fctx = fig.getContext('2d', { willReadFrequently: true });
const rad = d => d * Math.PI / 180;
function put(s) { fctx.drawImage(s.c, s.x, s.y); }
function world(x, y) { const q = fctx.getTransform().transformPoint(new DOMPoint(x, y)); return { x: Math.round(q.x - OX), y: Math.round(q.y - OY) }; }

function drawFigure(p) {
  const info = {};
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, SW, SH); fctx.imageSmoothingEnabled = false;
  const crouch = Math.round(p.crouch), hipY = -12 + crouch;
  fctx.translate(OX + Math.round(p.dx), OY + Math.round(p.dy)); fctx.rotate(rad(p.rot)); fctx.scale(p.sx, p.sy);
  for (const [x, a] of [[-5, p.legL], [4, p.legR]]) {
    fctx.save(); fctx.translate(x, hipY); fctx.rotate(rad(a)); fctx.scale(1, (12 - crouch) / 12); put(LEG); fctx.restore();
  }
  fctx.translate(0, hipY + Math.round(p.bob)); fctx.rotate(rad(p.lean)); fctx.scale(1, p.stretch);
  put(TORSO);
  const arm = (s, x, a, front) => {
    fctx.save(); fctx.translate(x, -17); fctx.rotate(rad(a)); put(s);
    if (front) { info.muzzle = world(0, 29); info.breech = world(2, 16); info.hand = world(0, 16); }
    fctx.restore();
  };
  arm(ARM_B, -12, p.armB, false);
  if (!p.armFront) arm(ARM_F, 12, p.armF, true);
  const pd = Math.round(p.padDy);
  fctx.save(); fctx.translate(-8, -17 + pd); fctx.rotate(rad(p.padL)); put(PAD_L); fctx.restore();
  fctx.save(); fctx.translate(8, -17 + pd); fctx.rotate(rad(p.padR)); put(PAD_R); fctx.restore();
  fctx.save(); fctx.translate(1 + Math.round(p.headDx), -18 + Math.round(p.headDy)); fctx.rotate(rad(p.head)); fctx.scale(p.flip, 1);
  put(HEAD);
  fctx.translate(2, -4); fctx.rotate(rad(p.cigar));
  if (!p.cigarOff) put(CIGAR);
  info.cigar = world(6, 0);
  fctx.restore();
  if (p.armFront) arm(ARM_F, 12, p.armF, true);

  fctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = fctx.getImageData(0, 0, SW, SH), d = img.data, solid = new Uint8Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const [or, og, ob] = P.outline;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = y * SW + x, j = i * 4;
    if (solid[i]) {
      d[j + 3] = 255;
      if (p.grey > 0) {
        const l = d[j] * .3 + d[j + 1] * .5 + d[j + 2] * .2, g = p.grey;
        d[j] += (l * .75 + 30 - d[j]) * g; d[j + 1] += (l * .8 + 36 - d[j + 1]) * g; d[j + 2] += (l * .85 + 44 - d[j + 2]) * g;
      }
      if (p.flash > 0) { d[j] += (255 - d[j]) * p.flash; d[j + 1] += (255 - d[j + 1]) * p.flash; d[j + 2] += (255 - d[j + 2]) * p.flash; }
    } else if ((x > 0 && solid[i - 1]) || (x < SW - 1 && solid[i + 1]) || (y > 0 && solid[i - SW]) || (y < SH - 1 && solid[i + SW])) {
      d[j] = or; d[j + 1] = og; d[j + 2] = ob; d[j + 3] = 255;
    }
  }
  fctx.putImageData(img, 0, 0);
  return info;
}

/* ---------- pixel drawing helpers for effects (origin = centre of the feet) ---------- */
function fxKit(ctx) {
  const S = {
    rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(OX + Math.round(x), OY + Math.round(y), Math.round(w), Math.round(h)); },
    disc(cx, cy, r, c) { r = Math.round(r); for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + .5); S.rect(cx - w, cy + dy, 2 * w + 1, 1, c); } },
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) S.rect(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1, 1, c); },
    ellFill(cx, cy, rx, ry, c) { for (let dy = -Math.floor(ry); dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry)))); S.rect(cx - w, cy + dy, 2 * w + 1, 1, c); } },
    ell(cx, cy, rx, ry, c) { const n = Math.ceil((rx + ry) * 4); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; S.rect(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1, 1, c); } },
    puff(x, y, age, life, r) { if (age < 0 || age > life) return; const u = age / life; S.disc(x, y, 1 + r * u, 'rgba(196,204,210,' + (.7 * (1 - u)).toFixed(2) + ')'); },
    ruby(x, y, s) { if (s <= 0) return; const r = Math.round(2 * s); for (let dy = -r - 1; dy <= r + 1; dy++) { const w = Math.max(0, r - Math.abs(dy) + (Math.abs(dy) > r ? -1 : 0)); if (Math.abs(dy) <= r) S.rect(x - w, y + dy, 2 * w + 1, 1, dy < 0 ? '#9cd0ff' : '#4da3ff'); } S.rect(x - 1, y - 1, 1, 1, '#ffffff'); },
    glyphs(text, x, y, s, c) {
      const G = { '-': ['000', '000', '111', '000', '000'], '2': ['111', '001', '111', '100', '111'] };
      let cx = x;
      for (const ch of text) { G[ch].forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') { S.rect(cx + i * s + 1, y + j * s + 1, s, s, '#1a0508'); } })); cx += 4 * s; }
      cx = x;
      for (const ch of text) { G[ch].forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') S.rect(cx + i * s, y + j * s, s, s, c); })); cx += 4 * s; }
    },
    slab(x, y, w, h) { S.rect(x - 1, y - 1, w + 2, h + 2, '#0b0f15'); S.rect(x, y, w, h, '#77838e'); S.rect(x, y, w, 3, '#b3bdc6'); S.rect(x, y + h - 2, w, 2, '#566069'); S.rect(x + 3, y + 5, 2, 2, '#566069'); S.rect(x + w - 6, y + 6, 2, 2, '#566069'); },
    bubble(k, a) { if (k <= 0) return; S.ellFill(0, -22, 27 * k, 31 * k, 'rgba(77,163,255,' + (.16 * a).toFixed(2) + ')'); S.ell(0, -22, 27 * k, 31 * k, 'rgba(140,200,255,' + (.95 * a).toFixed(2) + ')'); S.ell(0, -22, 26 * k, 30 * k, 'rgba(77,163,255,' + (.6 * a).toFixed(2) + ')'); S.rect(-14 * k, -22 - 20 * k, 3, 2, 'rgba(255,255,255,' + (.8 * a).toFixed(2) + ')'); }
  };
  return S;
}
function cigarSmoke(S, t, info) {
  for (let k = 0; k < 3; k++) {
    const age = (t + k * 500) % 1500, u = age / 1500;
    const x = info.cigar.x + 1 + Math.round(Math.sin(age / 220 + k) * 1.5 + age * .003), y = info.cigar.y - 2 - Math.round(age * .011);
    S.rect(x, y, u > .4 ? 2 : 1, u > .4 ? 2 : 1, 'rgba(220,226,230,' + (.6 * (1 - u)).toFixed(2) + ')');
  }
}
const shakeAt = (t, t0, len, amp) => { const a = t - t0; if (a < 0 || a > len) return [0, 0]; const k = amp * (1 - a / len), f = Math.floor(a / FRAME); return [Math.round(f % 2 ? -k : k), Math.round(f % 3 === 0 ? k * .6 : -k * .4)]; };


function muzzleBlast(S, a, m, big) {
  if (a >= 0 && a < 150) {
    const r = Math.round((a < 50 ? 10 : a < 100 ? 8 : 5) * big), cx = m.x + r - 2;
    S.disc(cx, m.y, r, '#ff7a1a'); S.disc(cx, m.y, r - 2, '#ffd24a'); S.disc(cx, m.y, Math.max(1, r - 5), '#ffffff');
    S.line(cx, m.y, cx + r + 12, m.y, '#ffd24a'); S.line(cx, m.y - 1, cx + r + 8, m.y - 1, '#fff3c0');
    S.line(cx, m.y, cx + r + 2, m.y - r - 3, '#ff7a1a'); S.line(cx, m.y, cx + r + 2, m.y + r + 3, '#ff7a1a');
    S.line(cx, m.y, cx - 2, m.y - r - 4, '#ffd24a'); S.line(cx, m.y, cx - 2, m.y + r + 4, '#ffd24a');
  }
}

/* ---------- clips: timing and beats follow docs/design/animation, amplitudes are pushed ---------- */
const wave = (t, dur) => Math.sin(t / dur * Math.PI * 2);
const CLIPS = [
  {
    id: 'idle', name: 'Idle', meta: 'Loop 2,0 s', dur: 2000, loop: true, still: 1000,
    text: 'Schweres Atmen: Der Rumpf pumpt sich auf, die Schulterplatten heben sich verzögert wie Flügel, die Knie geben nach. Beim Ausatmen glüht die Zigarre auf.',
    tracks: {
      stretch: [[0, 1], [1000, 1.08], [2000, 1]], crouch: [[0, 1.4], [1000, 0], [2000, 1.4]],
      padDy: [[0, 1], [300, 1], [1250, -2], [2000, 1]], padL: [[0, -3], [1250, 9], [2000, -3]], padR: [[0, 3], [1250, -9], [2000, 3]],
      head: [[0, 2], [1000, -5], [2000, 2]], armF: [[0, -28], [1000, -38], [2000, -28]], armB: [[0, 2], [1000, 12], [2000, 2]]
    },
    front(S, t, info) { if (t > 1000 && t < 1500) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.55)'); S.puff(info.cigar.x + 3, info.cigar.y - 3 - (t - 1300) * .01, t - 1300, 600, 3); }
  },
  {
    id: 'walk', name: 'Walk', meta: 'Loop 0,64 s · 2 Schritte', dur: 640, loop: true, still: 160,
    text: 'Stampfender Marsch: weit ausgreifende Beine, der Körper sackt bei jedem Auftritt ein, die Platten klappern nach, Staub an jedem Fuß.',
    tracks: {},
    pose(t, p) {
      const s = wave(t, 640), s2 = wave(t - 60, 320);
      p.legL = 40 * s; p.legR = -40 * s; p.dy = 2 * Math.abs(s); p.lean = 10 + 3 * s2; p.stretch = 1 - .05 * Math.abs(s);
      p.armF = -30 + 28 * s; p.armB = 4 - 32 * s; p.padDy = -2 * Math.abs(wave(t - 90, 640)) + 1;
      p.padL = 10 * s2; p.padR = -10 * s2; p.head = -4 + 5 * wave(t - 110, 320);
    },
    back(S, t) { for (const t0 of [160, 480]) { const a = (t - t0 + 640) % 640; S.puff(-10 - a * .02, -1 - a * .004, a, 300, 3); } }
  },
  {
    id: 'wait', name: 'Wait', meta: 'Loop 3,2 s', dur: 3200, loop: true, still: 900,
    text: 'Steht und wartet: Der Kopf ruckt nach links und rechts, der Fuß tippt ungeduldig, eine dicke Rauchwolke. Das graue II zeigt, dass Warten gewählt ist.',
    tracks: {
      head: [[0, 0], [700, 0], [830, -10, 'back'], [1000, 0], [1900, 0], [2050, 10, 'back'], [2200, 0], [3200, 0]],
      headDx: [[0, 0], [700, 0], [830, -2, 'out'], [1900, -2], [2050, 1, 'out'], [3000, 1], [3200, 0]],
      stretch: [[0, 1], [760, .95], [900, 1.04], [1100, 1], [3200, 1]], armB: [[0, 4], [400, 30], [2900, 30], [3200, 4]]
    },
    pose(t, p) { p.flip = t > 760 && t < 1980 ? -1 : 1; if (t > 2250 && t < 3050) { const a = (t - 2250) % 200; p.legR = a < 90 ? -24 * (a / 90) : -24 * (1 - (a - 90) / 110); } },
    front(S, t, info) {
      const by = -62 + Math.round(wave(t, 1600));
      S.rect(-7, by - 1, 15, 11, '#0b0f15'); S.rect(-6, by, 13, 9, '#8f9aa3'); S.rect(-3, by + 2, 2, 5, '#1e252b'); S.rect(2, by + 2, 2, 5, '#1e252b');
      for (let k = 0; k < 3; k++) S.puff(info.cigar.x + 2 + k * 3 * p_sign(t), info.cigar.y - 3 - (t - 1500 - k * 90) * .012, t - 1500 - k * 90, 800, 4);
      for (const t0 of [2340, 2540, 2740, 2940]) S.puff(13, -1, t - t0, 160, 1);
    }
  },
  {
    id: 'slam', name: 'Attack: Slam Shot', meta: 'Einmal 2,4 s · Schuss bei 620 ms', dur: 2400, still: 660,
    text: 'Holt tief aus, reißt die Flinte hoch und feuert: Der Rückstoß wirft ihn eine halbe Kachel zurück, der Arm fliegt nach oben, Hülsen und Platten springen, das Bild wackelt.',
    tracks: {
      crouch: [[0, 0], [290, 5, 'out'], [580, 3], [620, 0, 'out'], [700, 6, 'out'], [910, 2], [1540, 0]],
      lean: [[0, 0], [290, 14, 'out'], [580, -8], [620, -8], [690, -30, 'out'], [910, 12], [1150, -4], [1540, 0]],
      dx: [[0, 0], [290, 1], [580, 3], [620, 3], [700, -11, 'out'], [1150, -8], [1540, 0]],
      armF: [[0, -30], [290, 4, 'out'], [520, -108, 'back'], [600, -90], [620, -90], [680, -168, 'out'], [910, -70], [1150, -96], [1540, -30]],
      armB: [[0, 4], [290, 28], [580, -18], [620, -18], [690, 62, 'out'], [1150, 10], [1540, 4]],
      head: [[0, 0], [290, 8], [580, 4], [620, 4], [690, -24, 'out'], [910, 10], [1540, 0]],
      stretch: [[0, 1], [290, .9, 'out'], [580, 1.04], [620, 1.04], [690, 1.16, 'out'], [910, .93], [1540, 1]],
      padDy: [[0, 0], [290, 2], [620, 0], [700, -6, 'out'], [900, 3], [1100, 0]],
      padL: [[0, 0], [620, 0], [700, 30, 'out'], [900, -10], [1150, 0]], padR: [[0, 0], [620, 0], [700, -30, 'out'], [900, 10], [1150, 0]],
      cigar: [[0, 0], [620, 0], [700, -40, 'out'], [1000, 10], [1300, 0]]
    },
    shake: t => shakeAt(t, 620, 260, 3),
    back(S, t) { for (let k = 0; k < 3; k++) S.puff(6 - (t - 640 - k * 60) * .02 - k * 4, -1, t - 640 - k * 60, 420, 4); },
    front(S, t, info, clip) {
      const m = clip.fire.muzzle, a = t - 620;
      if (a >= 0 && a < 150) {
        const r = a < 50 ? 10 : a < 100 ? 8 : 5, cx = m.x + r - 2;
        S.disc(cx, m.y, r, '#ff7a1a'); S.disc(cx, m.y, r - 2, '#ffd24a'); S.disc(cx, m.y, Math.max(1, r - 5), '#ffffff');
        S.line(cx, m.y, cx + r + 12, m.y, '#ffd24a'); S.line(cx, m.y - 1, cx + r + 8, m.y - 1, '#fff3c0');
        S.line(cx, m.y, cx + r + 2, m.y - r - 3, '#ff7a1a'); S.line(cx, m.y, cx + r + 2, m.y + r + 3, '#ff7a1a');
        S.line(cx, m.y, cx - 2, m.y - r - 4, '#ffd24a'); S.line(cx, m.y, cx - 2, m.y + r + 4, '#ffd24a');
      }
      if (a >= 50 && a < 420) { const x = m.x + 10 + (a - 50) * .28; S.rect(x - 14, m.y - 1, 14, 2, 'rgba(255,160,60,.45)'); S.rect(x, m.y - 2, 10, 4, '#ff8a2a'); S.rect(x + 2, m.y - 1, 7, 2, '#fff3c0'); }
      for (let k = 0; k < 4; k++) S.puff(m.x + 4 + k * 3 + (a - 120) * .008, m.y - (a - 120 - k * 50) * .016, a - 120 - k * 50, 760, 5);
      for (let i = 0; i < 2; i++) {
        const s = a - 60 - i * 70; if (s < 0 || s > 1100) continue;
        const b = clip.fire.breech, x = b.x - s * .028 * (1 + i * .5), y0 = b.y - 6 - .1 * s + .00017 * s * s, y = Math.min(y0, -1);
        const flat = y0 >= -1 || Math.floor(s / 100) % 2;
        S.rect(x, y, flat ? 3 : 1, flat ? 1 : 3, '#d0483a'); S.rect(x, y, 1, 1, '#f2c14a');
      }
      if (a > 0 && a < 500) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.6)');
    }
  },
  {
    id: 'block', name: 'Block', meta: 'Einmal 3,2 s · Blase bei 900 ms', dur: 3200, still: 1400,
    text: 'Stampft in die Hocke, reißt beide Arme vors Gesicht. Die Shield-Blase springt auf, federt nach, zwei blaue Rubine ploppen darüber.',
    tracks: {
      crouch: [[0, 0], [320, 1], [700, 6, 'back'], [2500, 6], [2900, 0, 'back']],
      lean: [[0, 0], [320, -10, 'out'], [700, 14, 'back'], [2500, 14], [2900, 0, 'back']],
      armF: [[0, -30], [320, 10, 'out'], [700, -152, 'back'], [2500, -152], [2900, -30, 'back']],
      armB: [[0, 4], [320, 30, 'out'], [700, -128, 'back'], [2500, -128], [2900, 4, 'back']],
      head: [[0, 0], [320, -8], [700, 10, 'back'], [2500, 10], [2900, 0]],
      stretch: [[0, 1], [320, 1.08, 'out'], [700, .88, 'back'], [1000, .94], [2500, .94], [2900, 1, 'back']],
      padDy: [[0, 0], [320, -4, 'out'], [700, 3, 'back'], [2500, 2], [2900, 0]],
      padL: [[0, 0], [320, 16, 'out'], [700, -14, 'back'], [2500, -8], [2900, 0]], padR: [[0, 0], [320, -16, 'out'], [700, 14, 'back'], [2500, 8], [2900, 0]]
    },
    pose(t, p) { p.armFront = t > 380 && t < 2800 ? 1 : 0; },
    shake: t => shakeAt(t, 700, 160, 2),
    bubbleK: t => tr(t, [[0, 0], [850, 0], [1000, 1.22, 'out'], [1150, .93], [1300, 1.04], [1450, 1], [2500, 1], [2760, 0, 'in']]),
    back(S, t, info, clip) { S.bubble(clip.bubbleK(t), .6); S.puff(-16 - (t - 700) * .03, -1, t - 700, 380, 4); S.puff(16 + (t - 700) * .03, -1, t - 700, 380, 4); },
    front(S, t, info, clip) {
      const k = clip.bubbleK(t); if (k > 0) S.ell(0, -22, 27 * k, 31 * k, 'rgba(140,200,255,.9)');
      const rs = t0 => t > 2500 ? tr(t, [[2500, 1], [2700, 0, 'in']]) : tr(t, [[t0, 0], [t0 + 120, 1.7, 'out'], [t0 + 260, 1]]);
      S.ruby(-5, -64, rs(1000)); S.ruby(6, -64, rs(1150));
    }
  },
  {
    id: 'hit', name: 'Hit, kein Shield', meta: 'Einmal 2,6 s · Einschlag bei 310 ms', dur: 2600, still: 400,
    text: 'Weißer Blitz, der ganze Kerl fliegt nach hinten: Kopf schnappt zurück, Arme rudern, die Platten heben ab, die Zigarre kippt. Rote -2 steigt auf, dann pendelt er aus.',
    tracks: {
      flash: [[0, 0], [300, 0], [310, 1, 'step'], [400, 1], [540, 0]],
      dx: [[0, 0], [310, 0], [410, -11, 'out'], [900, -6], [1350, 0]],
      lean: [[0, 0], [310, 0], [410, -36, 'out'], [700, 16], [950, -8], [1150, 4], [1350, 0]],
      head: [[0, 0], [310, 0], [390, -32, 'out'], [700, 20], [950, -9], [1350, 0]],
      stretch: [[0, 1], [310, 1], [390, 1.2, 'out'], [700, .88], [950, 1.04], [1350, 1]],
      armF: [[0, -30], [310, -30], [410, -128, 'out'], [800, 14], [1350, -30]],
      armB: [[0, 4], [310, 4], [410, 118, 'out'], [800, -14], [1350, 4]],
      legL: [[0, 0], [310, 0], [410, 22, 'out'], [900, 0]], legR: [[0, 0], [310, 0], [410, -28, 'out'], [900, 0]],
      padDy: [[0, 0], [310, 0], [410, -7, 'out'], [700, 3], [1000, 0]],
      padL: [[0, 0], [310, 0], [410, 34, 'out'], [700, -12], [1000, 0]], padR: [[0, 0], [310, 0], [410, -34, 'out'], [700, 12], [1000, 0]],
      cigar: [[0, 0], [310, 0], [410, -65, 'out'], [900, 25], [1350, 0]],
      ringRed: [[0, 0], [300, 0], [310, 1, 'step'], [800, 1], [1100, 0]]
    },
    shake: t => shakeAt(t, 310, 240, 3),
    front(S, t, info) {
      const a = t - 310;
      if (a >= 0 && a < 330) { const r = 3 + a * .03; S.disc(12, -26, r, 'rgba(255,140,60,' + (1 - a / 330).toFixed(2) + ')'); S.disc(12, -26, Math.max(1, r - 3), 'rgba(255,255,255,' + (1 - a / 330).toFixed(2) + ')'); }
      if (a >= 0 && a < 420) [[1, -1.2], [1.3, .2], [.6, 1], [-.4, -1.4]].forEach(([vx, vy]) => S.rect(12 + vx * a * .05, -26 + vy * a * .05 + a * a * .00012, 2, 1, '#ffd24a'));
      if (a >= 20 && a < 900) { const s = a < 140 ? 3 : 2; S.glyphs('-2', 14, -52 - (a - 20) * .022, s, a > 700 ? 'rgba(255,90,90,.5)' : '#ff5a5a'); }
    }
  },
  {
    id: 'shield', name: 'Hit, Shield fängt es', meta: 'Einmal 2,6 s · Einschlag bei 310 ms', dur: 2600, still: 420,
    text: 'Der Treffer prallt an der Blase ab: Sie beult sich ein, eine Welle läuft heraus, ein Rubin zerspringt in Splitter. Er selbst zuckt nur kurz.',
    tracks: {
      dx: [[0, 0], [310, 0], [400, -3, 'out'], [800, 0]], lean: [[0, 0], [310, 0], [400, -10, 'out'], [650, 4], [900, 0]],
      head: [[0, 0], [310, 0], [400, -9, 'out'], [700, 4], [1000, 0]], padDy: [[0, 0], [310, 0], [400, -2, 'out'], [650, 1], [900, 0]]
    },
    shake: t => shakeAt(t, 310, 140, 1),
    bub: t => ({ kx: tr(t, [[0, 1], [310, 1], [380, .86, 'out'], [520, 1.1], [680, .97], [840, 1]]), ky: tr(t, [[0, 1], [310, 1], [380, 1.1, 'out'], [520, .94], [680, 1.02], [840, 1]]) }),
    back(S, t, info, clip) { const b = clip.bub(t); S.ellFill(0, -22, 27 * b.kx, 31 * b.ky, 'rgba(77,163,255,.14)'); },
    front(S, t, info, clip) {
      const b = clip.bub(t), a = t - 310;
      S.ell(0, -22, 27 * b.kx, 31 * b.ky, 'rgba(140,200,255,.95)'); S.ell(0, -22, 26 * b.kx, 30 * b.ky, 'rgba(77,163,255,.6)');
      if (a >= 110 && a < 700) { const u = (a - 110) / 590; S.ell(0, -22, 27 * (1 + u * .5), 31 * (1 + u * .5), 'rgba(140,200,255,' + (.8 * (1 - u)).toFixed(2) + ')'); }
      if (a >= 0 && a < 260) { S.disc(27, -24, 4 - a * .012, '#ffffff'); S.line(27, -24, 36, -30, '#9cd0ff'); S.line(27, -24, 37, -20, '#9cd0ff'); }
      S.ruby(-8, -64, 1); S.ruby(0, -66, 1);
      if (a < 110) S.ruby(8, -64, a < 0 ? 1 : 1.6);
      else if (a < 620) [[1.2, -1], [.3, -1.6], [1.6, .2], [-.5, -1.2], [.8, .9]].forEach(([vx, vy]) => S.rect(8 + vx * (a - 110) * .04, -64 + vy * (a - 110) * .04 + (a - 110) * (a - 110) * .0001, 2, 2, 'rgba(120,190,255,' + (1 - (a - 110) / 510).toFixed(2) + ')'));
    }
  },
  {
    id: 'half', name: 'Half Cover', meta: 'Loop 4,4 s · duckt bei 440 bis 1050 ms', dur: 4400, loop: true, still: 1900,
    text: 'Wirft sich hinter die niedrige Wand, Waffe an die Brust. Der Kopf schnellt zum Spähen wie ein Springteufel hoch, erst nach links, dann nach rechts.',
    tracks: {
      crouch: [[0, 0], [440, 0], [700, -1, 'out'], [1050, 8, 'back'], [3950, 8], [4400, 0, 'back']],
      lean: [[0, 0], [440, -8], [1050, 10, 'back'], [3950, 10], [4400, 0]],
      armF: [[0, -30], [440, -30], [1050, -104, 'back'], [3950, -104], [4400, -30]],
      armB: [[0, 4], [440, 20], [1050, -40, 'back'], [3950, -40], [4400, 4]],
      headDy: [[0, 0], [1050, 2], [1700, 2], [1830, -5, 'back'], [2400, -5], [2500, 2, 'out'], [3000, 2], [3130, -5, 'back'], [3600, -5], [3700, 2, 'out'], [3950, 1], [4400, 0]],
      stretch: [[0, 1], [700, 1.06], [1050, .9, 'back'], [1700, .94], [1830, 1.1, 'back'], [2400, 1.08], [2500, .94], [3000, .94], [3130, 1.1, 'back'], [3600, 1.08], [3700, .94], [3950, .96], [4400, 1]],
      padDy: [[0, 0], [700, -3], [1050, 3, 'back'], [1300, 0], [4400, 0]]
    },
    pose(t, p) { p.flip = t > 1650 && t < 2550 ? -1 : 1; },
    front(S, t) { S.slab(-16, -12, 42, 14); S.puff(-20 - (t - 1050) * .02, -1, t - 1050, 360, 4); S.puff(28 + (t - 1050) * .02, -1, t - 1050, 360, 4); }
  },
  {
    id: 'full', name: 'Full Cover', meta: 'Loop 4,8 s · rutscht bei 0 bis 1050 ms an', dur: 4800, loop: true, still: 2900,
    text: 'Rutscht mit dem Rücken an die hohe Wand, Flinte senkrecht nach oben. Lehnt sich weit um die Kante, späht, und schnappt zurück an die Wand.',
    tracks: {
      dx: [[0, 0], [1050, -6, 'back'], [4300, -6], [4800, 0]],
      lean: [[0, 0], [500, -16, 'out'], [1050, -6, 'back'], [2200, -6], [2350, -12], [2600, 24, 'back'], [3300, 22], [3500, -10, 'back'], [3800, -6], [4300, -6], [4800, 0]],
      armF: [[0, -30], [500, -60], [1050, -176, 'back'], [4300, -176], [4800, -30]],
      armB: [[0, 4], [1050, 14], [2600, -30, 'back'], [3300, -30], [3500, 14], [4800, 4]],
      head: [[0, 0], [2350, -6], [2600, 14, 'back'], [3300, 12], [3500, -6], [3800, 0], [4800, 0]],
      headDx: [[0, 0], [2350, 0], [2600, 3, 'back'], [3300, 3], [3500, 0], [4800, 0]],
      stretch: [[0, 1], [1050, .95, 'back'], [1300, 1], [2350, .96], [2600, 1.08, 'back'], [3300, 1.06], [3500, .96], [3800, 1], [4800, 1]],
      padDy: [[0, 0], [1050, -3, 'out'], [1250, 2], [1450, 0], [4800, 0]]
    },
    pose(t, p) { p.armFront = t > 420 && t < 4500 ? 1 : 0; },
    shake: t => shakeAt(t, 1000, 120, 1),
    back(S, t) { S.slab(-40, -50, 11, 52); S.puff(8 - (t - 300) * .01, -1, t - 300, 500, 3); S.puff(-22, -30 - (t - 1050) * .02, t - 1050, 300, 3); }
  },
  {
    id: 'exhausted', name: 'Exhausted', meta: 'Einmal 5,4 s · Treffer bei 650 ms', dur: 5400, still: 2700,
    text: 'Treffer, er taumelt, die Zigarre fällt ihm aus dem Mund. Dann kippt er wie ein Baum nach hinten, schlägt auf, federt einmal und wird grau. Zurück bleibt der Half-Cover-Block.',
    tracks: {
      flash: [[0, 0], [640, 0], [650, 1, 'step'], [740, 1], [900, 0]],
      crouch: [[0, 0], [650, 0], [970, 2], [1300, 6, 'out'], [1500, 3], [1840, 6], [2100, 0]],
      lean: [[0, 0], [650, 0], [740, -16, 'out'], [970, 12], [1250, -12], [1550, 14], [1840, -8], [2600, -4]],
      head: [[0, 0], [650, 0], [740, -24, 'out'], [970, 22], [1840, 26], [2600, -10], [2800, 8], [3000, 0]],
      armF: [[0, -30], [650, -30], [740, -100, 'out'], [1100, 0], [1840, 6], [2600, -60, 'in'], [2800, -100], [3000, -70]],
      armB: [[0, 4], [650, 4], [740, 90, 'out'], [1100, 0], [1840, -6], [2600, 80, 'in'], [2800, 120], [3000, 96]],
      rot: [[0, 0], [1840, 0], [2100, -8], [2600, -90, 'in'], [2780, -74, 'out'], [2960, -90, 'in'], [5400, -90]],
      dx: [[0, 0], [650, 0], [740, -3, 'out'], [1840, -1], [2600, -4]],
      legL: [[0, 0], [1840, 0], [2600, -10], [2780, -46, 'out'], [2960, -6]], legR: [[0, 0], [1840, 0], [2600, -18], [2780, -64, 'out'], [2960, -12]],
      padDy: [[0, 0], [650, 0], [740, -5, 'out'], [970, 2], [1840, 2], [2600, 0], [2780, -5, 'out'], [2960, 0]],
      padL: [[0, 0], [650, 0], [740, 26, 'out'], [1000, -14], [1840, -14], [2780, 24, 'out'], [2960, 0]],
      padR: [[0, 0], [650, 0], [740, -26, 'out'], [1000, 14], [1840, 14], [2780, -24, 'out'], [2960, 0]],
      grey: [[0, 0], [650, 0], [1840, .25], [3350, 1]], alpha: [[0, 1], [4000, 1], [4400, 0]],
      cigar: [[0, 0], [650, 0], [740, -50, 'out'], [1100, 40]], cigarOff: [[0, 0], [1150, 0], [1160, 1, 'step']]
    },
    shake: t => { const a = shakeAt(t, 650, 160, 2), b = shakeAt(t, 2600, 300, 4); return [a[0] + b[0], a[1] + b[1]]; },
    back(S, t) { for (let k = 0; k < 5; k++) S.puff(-8 - k * 8 - (t - 2600) * .012 * (k - 2), -2 - (t - 2600) * .01, t - 2600 - k * 30, 620, 6); },
    front(S, t) {
      const a = t - 1160;
      if (a >= 0 && t < 4300) {
        const u = Math.min(a, 520), x = 9 + u * .016, y = Math.min(-40 + .00015 * u * u * 1.0 + u * 0, -1) ;
        const yy = Math.min(-40 + u * u * .000145, -1), up = a < 520 && Math.floor(a / 100) % 2;
        S.rect(x, yy - (up ? 3 : 0), up ? 1 : 5, up ? 4 : 1, B.cigar); S.rect(x + (up ? 0 : 5), yy - (up ? 3 : 0), 1, 1, a < 1800 ? B.ember : '#6a6a6a');
        if (a > 520 && a < 1800) S.rect(x + 6, yy - 2 - Math.floor((a % 600) / 150), 1, 1, 'rgba(220,226,230,.5)');
      }
      const k = tr(t, [[0, 0], [4000, 0], [4300, 1.18, 'out'], [4500, .94], [4700, 1]]);
      if (k > 0) { const w = Math.round(40 * k), h = Math.round(14 * k); S.slab(-26 - (w - 40) / 2, -h + 2, w, h); S.puff(-34 - (t - 4250) * .02, -1, t - 4250, 400, 4); S.puff(18 + (t - 4250) * .02, -1, t - 4250, 400, 4); }
    }
  }
  ,
  /* ====== New clips for the deck redesign (#415): the Hero alone; targets, chains and numbers are drawn by the game ====== */
  {
    id: 'double', section: 'Neue Karten für Max · Deck-Redesign (#415)', name: 'Attack: Double Shot', meta: 'NEU · Einmal 2,8 s · Schüsse bei 620 und 900 ms',
    dur: 2800, still: 960, fireAts: [620, 900],
    text: 'Zwei Schrotschüsse hintereinander auf dasselbe Ziel. Nach dem ersten Schuss pumpt er die Flinte durch (Arm ruckt runter und hoch, die Hülse fliegt), der zweite Rückstoß wirft ihn noch weiter zurück. Der Schrot fächert auf, der Gegner zuckt zweimal.',
    tracks: {
      crouch: [[0, 0], [290, 5, 'out'], [580, 3], [620, 0, 'out'], [700, 5, 'out'], [880, 3], [900, 0, 'out'], [990, 8, 'out'], [1250, 2], [1750, 0]],
      lean: [[0, 0], [290, 14, 'out'], [580, -8], [620, -8], [690, -26, 'out'], [800, -4], [900, -6], [980, -30, 'out'], [1250, 14], [1500, -4], [1750, 0]],
      dx: [[0, 0], [290, 1], [580, 3], [620, 3], [690, -8, 'out'], [900, -7], [980, -11, 'out'], [1500, -12], [1750, 0]],
      armF: [[0, -30], [290, 4, 'out'], [520, -108, 'back'], [620, -90], [680, -160, 'out'], [760, -112], [830, -128, 'back'], [900, -92], [970, -178, 'out'], [1250, -70], [1500, -96], [1750, -30]],
      armB: [[0, 4], [290, 28], [580, -18], [620, -18], [690, 62, 'out'], [800, -14, 'back'], [900, -14], [980, 74, 'out'], [1500, 10], [1750, 4]],
      head: [[0, 0], [290, 8], [580, 4], [620, 4], [690, -22, 'out'], [800, 2], [900, 4], [980, -30, 'out'], [1250, 10], [1750, 0]],
      stretch: [[0, 1], [290, .9, 'out'], [580, 1.04], [620, 1.04], [690, 1.14, 'out'], [800, .98], [900, 1.04], [980, 1.2, 'out'], [1250, .93], [1750, 1]],
      padDy: [[0, 0], [290, 2], [620, 0], [700, -6, 'out'], [880, 2], [900, 0], [990, -8, 'out'], [1250, 3], [1500, 0]],
      padL: [[0, 0], [620, 0], [700, 30, 'out'], [880, -8], [900, 0], [990, 36, 'out'], [1250, -12], [1550, 0]],
      padR: [[0, 0], [620, 0], [700, -30, 'out'], [880, 8], [900, 0], [990, -36, 'out'], [1250, 12], [1550, 0]],
      cigar: [[0, 0], [620, 0], [700, -40, 'out'], [880, 0], [990, -52, 'out'], [1300, 10], [1550, 0]]
    },
    shake: t => { const a = shakeAt(t, 620, 200, 3), b = shakeAt(t, 900, 280, 5); return [a[0] + b[0], a[1] + b[1]]; },
    back(S, t) { for (const F of [620, 900]) for (let k = 0; k < 3; k++) S.puff(6 - (t - F - 20 - k * 60) * .02 - k * 4, -1, t - F - 20 - k * 60, 420, 4); },
    front(S, t, info, clip) {
      [620, 900].forEach((F, i) => {
        const m = clip.fires[i].muzzle, b = clip.fires[i].breech, a = t - F, big = i ? 1.25 : 1;
        muzzleBlast(S, a, m, big);
        for (const ang of [-.22, -.08, .08, .22]) if (a >= 20 && a < 160) {
          const d = (a - 20) * .32; S.rect(m.x + 8 + Math.cos(ang) * d, m.y + Math.sin(ang) * d, 2, 2, '#fff3c0'); S.rect(m.x + 8 + Math.cos(ang) * (d - 5), m.y + Math.sin(ang) * (d - 5), 3, 1, 'rgba(255,160,60,.6)');
        }
        for (let k = 0; k < 4; k++) S.puff(m.x + 4 + k * 3 + (a - 120) * .008, m.y - (a - 120 - k * 50) * .016, a - 120 - k * 50, 760, 5 * big);
        const sh = a - 130; if (sh > 0 && sh < 1000) { const x = b.x - sh * .03, y0 = b.y - 6 - .1 * sh + .00017 * sh * sh, y = Math.min(y0, -1), flat = y0 >= -1 || Math.floor(sh / 90) % 2; S.rect(x, y, flat ? 3 : 1, flat ? 1 : 3, '#d0483a'); S.rect(x, y, 1, 1, '#f2c14a'); }
      });
      if (t > 640 && t < 1000) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.6)');
    }
  }
  ,
  {
    id: 'rush', name: 'Utility: Rush', meta: 'NEU · Einmal 2,6 s · erst Shield 2, dann der Sprint',
    dur: 2600, still: 1400,
    text: 'Erst das Shield: Er geht in die Hocke, kreuzt die Arme, die Blase springt auf, zwei Rubine ploppen. Dann holt er aus und rennt wie ein Frachtwagen los, Schulter voran, Speedlines und Staubfahne. Vor dem Gegner bremst er mit einer langen Rutschspur.',
    tracks: {
      crouch: [[0, 0], [260, 6, 'back'], [500, 6], [570, 8, 'out'], [640, 1], [830, 0], [900, 7, 'out'], [1150, 1], [1500, 0]],
      lean: [[0, 0], [260, 10, 'back'], [500, 12], [570, -26, 'out'], [650, 44, 'out'], [830, 44], [900, -14, 'out'], [1150, 4], [1500, 0]],
      armF: [[0, -30], [260, -152, 'back'], [500, -152], [570, -150], [650, 52, 'out'], [830, 60], [900, -54, 'out'], [1150, -30], [1500, -30]],
      armB: [[0, 4], [260, -128, 'back'], [500, -128], [570, -120], [650, 98, 'out'], [830, 104], [900, 20], [1150, 4]],
      head: [[0, 0], [260, 10, 'back'], [500, 10], [570, -14, 'out'], [650, -12], [830, -10], [900, 18, 'out'], [1200, 0]],
      stretch: [[0, 1], [260, .9, 'back'], [500, .9], [570, .86, 'out'], [650, 1.12, 'out'], [830, 1.1], [900, .88, 'out'], [1150, 1]],
      padDy: [[0, 0], [570, 2], [650, -5, 'out'], [830, -4], [900, 4, 'out'], [1150, 0]],
      padL: [[0, 0], [570, 0], [650, 40, 'out'], [830, 36], [900, -16, 'out'], [1200, 0]], padR: [[0, 0], [570, 0], [650, -36, 'out'], [830, -32], [900, 16, 'out'], [1200, 0]],
      cigar: [[0, 0], [570, 0], [650, -70, 'out'], [830, -60], [950, 12], [1250, 0]]
    },
    pose(t, p) {
      p.armFront = t > 220 && t < 600 ? 1 : 0;
      if (t >= 570 && t < 850) { const w = wave(t, 150); p.legL = 62 * w; p.legR = -62 * w; }
      if (t >= 850 && t < 1100) { p.legL = 26; p.legR = -34; }
    },
    shake: t => { const a = shakeAt(t, 830, 220, 4); return a; },
    bubbleK: t => tr(t, [[0, 0], [300, 0], [400, 1.25, 'out'], [470, .93], [540, 1.03], [610, 1], [2200, 1], [2460, 0, 'in']]),
    back(S, t, info, clip) {
      const dx = 0; // the token slides in the game; the sheet runs in place
      S.bubble(clip.bubbleK(t), .6);
      // speed lines and the dust trail while he runs
      if (t >= 570 && t < 880) { const u = (t - 570) / 310; for (const [yy, len] of [[-8, 26], [-17, 38], [-27, 30], [-36, 22], [-44, 16]]) { const x = dx - 16 - len * (1 - u * .3); S.rect(x - 4 * ((t / 50) % 3), yy, len, 1, 'rgba(223,230,228,.75)'); S.rect(x - 4 * ((t / 50) % 3), yy + 1, len * .6, 1, 'rgba(111,214,180,.4)'); } }
      if (t >= 570 && t < 880) for (let k = 0; k < 4; k++) { const age = t - (590 + k * 38); S.puff(-14 - k * 9, -1 - (age > 0 ? age * .012 : 0), age, 420, 4 + (k % 3)); }
      if (t >= 830 && t < 1250) { const a = t - 830; for (let k = 0; k < 5; k++) S.puff(-8 - k * 7 - a * .03, -1, a - k * 20, 520, 5 + k % 2); }
    },
    front(S, t, info, clip) {
      const k = clip.bubbleK(t);
      if (k > 0) S.ell(0, -22, 27 * k, 31 * k, 'rgba(140,200,255,.9)');
      const rs = t0 => t > 2200 ? tr(t, [[2200, 1], [2400, 0, 'in']]) : tr(t, [[t0, 0], [t0 + 120, 1.7, 'out'], [t0 + 260, 1]]);
      S.ruby(-5, -64, rs(400)); S.ruby(6, -64, rs(500));
    }
  }
  ,
  {
    id: 'hook', name: 'Utility: Grappling Hook', meta: 'NEU · Einmal 3,2 s · Wurf bei 520 ms · Range 7',
    dur: 3200, still: 1000,
    text: 'Der Frachthaken kreist überm Kopf, dann wirft er ihn nach vorn. Die Kette rasselt, der Haken beißt zu, und Max reißt den Gegner mit beiden Schultern zu sich heran: Speedlines, Staubspur, ein harter Aufprall mit Sternen. Der Haken kann auch eine Silhouette (Ghost) treffen.',
    tracks: {
      crouch: [[0, 0], [300, 2], [460, 1], [530, 0], [780, 6, 'out'], [1250, 7], [1330, 0, 'back'], [1700, 0]],
      lean: [[0, 0], [300, -10], [440, -16], [520, 16, 'out'], [700, 8], [780, -16, 'out'], [1250, -14], [1330, 8, 'out'], [1700, 0]],
      armF: [[0, -30], [200, -150], [440, -176], [520, -96, 'out'], [700, -96], [780, -62, 'out'], [1250, -62], [1330, -96], [1550, -30], [1700, -30]],
      armB: [[0, 4], [440, 24], [520, 52, 'out'], [780, -20], [1250, -22], [1330, 30], [1700, 4]],
      head: [[0, 0], [440, -8], [520, 12, 'out'], [780, -20, 'out'], [1250, -16], [1330, 10], [1700, 0]],
      stretch: [[0, 1], [440, 1.04], [520, 1.1, 'out'], [780, .92, 'out'], [1250, .92], [1330, 1.06], [1700, 1]],
      padDy: [[0, 0], [520, -4, 'out'], [780, 3, 'out'], [1250, 2], [1330, -3], [1600, 0]],
      padL: [[0, 0], [520, 20, 'out'], [780, -16, 'out'], [1000, -6], [1330, 22, 'out'], [1600, 0]], padR: [[0, 0], [520, -20, 'out'], [780, 16, 'out'], [1000, 6], [1330, -22, 'out'], [1600, 0]],
      cigar: [[0, 0], [520, 0], [580, -30, 'out'], [1250, 8], [1500, 0]],
      dx: [[0, 0], [520, 0], [560, 2], [780, -5, 'out'], [1250, -7], [1330, 2, 'out'], [1700, 0]]
    },
    pose(t, p) { p.armFront = t > 500 && t < 1500 ? 1 : 0; },
    shake: t => shakeAt(t, 1250, 300, 5),
    back(S, t) { if (t > 780 && t < 1260) for (let k = 0; k < 4; k++) S.puff(2 - (t - 800 - k * 90) * .012, -1, t - 800 - k * 90, 420, 4); },
    // The hook orbits over the head until the throw. The flight, the chain and the bite are drawn by the game, because the
    // distance to the target changes with every use.
    front(S, t, info) {
      if (t >= 480) return;
      const hand = info.hand, hx = hand.x + Math.cos(t / 55) * 11, hy = hand.y - 4 + Math.sin(t / 55) * 5, n = 8;
      for (let i = 0; i <= n; i++) { const u = i / n; S.rect(hand.x + (hx - hand.x) * u, hand.y + (hy - hand.y) * u, 2, 2, i % 2 ? '#59636e' : '#c3ccd4'); }
      S.rect(hx - 1, hy - 1, 5, 5, '#0b0f15'); S.rect(hx, hy, 3, 3, '#c3ccd4'); S.rect(hx + 3, hy + 2, 3, 4, '#0b0f15'); S.rect(hx + 2, hy + 2, 3, 3, '#9aa6b2'); S.rect(hx - 2, hy + 3, 3, 3, '#0b0f15'); S.rect(hx - 1, hy + 3, 2, 2, '#59636e');
    }
  }
  ,
  {
    id: 'concussion', name: 'Attack: Concussion Round', meta: 'NEU · Einmal 2,6 s · Schuss bei 620 ms · Range 3',
    dur: 2600, still: 1100, fireAts: [620],
    text: 'Ein dumpfer Druckschuss: Max stemmt die Flinte wie eine Kanone, der Rückstoß schiebt ihn in die Knie, aus dem Lauf rollen violette Druckringe. Beim Gegner kracht eine Schockwelle, ihm kreisen Sterne um den Kopf, und über ihm erscheint die Schnecke für Slow.',
    tracks: {
      crouch: [[0, 0], [300, 6, 'out'], [580, 4], [620, 0, 'out'], [700, 8, 'out'], [960, 3], [1500, 0]],
      lean: [[0, 0], [300, 18, 'out'], [580, 10], [620, 10], [700, -34, 'out'], [960, 14], [1200, -4], [1500, 0]],
      dx: [[0, 0], [300, 2], [580, 4], [620, 4], [720, -14, 'out'], [1200, -10], [1550, 0]],
      armF: [[0, -30], [300, 0, 'out'], [540, -118, 'back'], [620, -96], [690, -150, 'out'], [960, -78], [1200, -100], [1550, -30]],
      armB: [[0, 4], [300, 32], [580, -22], [620, -22], [700, 70, 'out'], [1200, 12], [1550, 4]],
      head: [[0, 0], [300, 10], [580, 6], [620, 6], [700, -26, 'out'], [960, 12], [1500, 0]],
      stretch: [[0, 1], [300, .88, 'out'], [580, 1.05], [620, 1.05], [700, 1.2, 'out'], [960, .9], [1500, 1]],
      padDy: [[0, 0], [300, 3], [620, 0], [710, -8, 'out'], [960, 3], [1200, 0]],
      padL: [[0, 0], [620, 0], [710, 34, 'out'], [960, -12], [1250, 0]], padR: [[0, 0], [620, 0], [710, -34, 'out'], [960, 12], [1250, 0]],
      cigar: [[0, 0], [620, 0], [710, -46, 'out'], [1050, 12], [1350, 0]]
    },
    shake: t => { const a = shakeAt(t, 620, 280, 4), b = shakeAt(t, 900, 200, 3); return [a[0] + b[0], a[1] + b[1]]; },
    back(S, t) { for (let k = 0; k < 3; k++) S.puff(6 - (t - 640 - k * 60) * .02 - k * 4, -1, t - 640 - k * 60, 460, 4); },
    front(S, t, info, clip) {
      const m = clip.fires[0].muzzle, a = t - 620;
      // muzzle: violet-white blast and pressure rings, then the round
      if (a >= 0 && a < 170) { const r = a < 50 ? 12 : a < 100 ? 9 : 5, cx = m.x + r - 2; S.disc(cx, m.y, r, '#9b5cff'); S.disc(cx, m.y, r - 2, '#d9c2ff'); S.disc(cx, m.y, Math.max(1, r - 5), '#ffffff'); S.line(cx, m.y, cx + r + 10, m.y, '#d9c2ff'); }
      for (let k = 0; k < 3; k++) { const s = a - 30 - k * 70; if (s >= 0 && s < 420) { const u = s / 420, rx = 3 + u * 16, ry = 3 + u * 22; S.ell(m.x + 6 + u * 14, m.y, rx * .5, ry, 'rgba(210,180,255,' + (.9 * (1 - u)).toFixed(2) + ')'); S.ell(m.x + 6 + u * 14, m.y, rx * .5 + 1, ry + 1, 'rgba(155,92,255,' + (.6 * (1 - u)).toFixed(2) + ')'); } }
      if (a >= 60 && a < 280) { const u = (a - 60) / 220, x = m.x + 8 + (52 - m.x - 8) * u; S.disc(x, m.y, 4, '#0b0f15'); S.disc(x, m.y, 3, '#c9a8ff'); S.disc(x, m.y, 1, '#ffffff'); for (let k = 1; k < 4; k++) S.rect(x - k * 6, m.y - 2 + k % 2, 3, 3 - k % 2, 'rgba(180,140,255,' + (.6 - k * .15).toFixed(2) + ')'); }
      if (a > 0 && a < 500) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.6)');
    }
  }
];
function p_sign(t) { return t < 1980 ? -1 : 1; }


// Points that a clip's effects start from, taken from the pose at the moment of the shot or the throw.
const clipById = id => CLIPS.find(c => c.id === id);
clipById('slam').fire = drawFigure(poseAt(clipById('slam'), 620));

/* ---------- Hero Select: shared renderer for one Hero stage ---------- */
const selTile = document.createElement('canvas'); selTile.width = SW; selTile.height = SH;
(() => {
  const g = selTile.getContext('2d'), half = 36;
  for (let dy = -half / 2; dy < half / 2; dy++) {
    const hw = half - 2 * Math.abs(dy + .5) + 1;
    for (let dx = -hw; dx < hw; dx++) { g.fillStyle = Math.abs(dx) >= hw - 2 ? '#2a3440' : '#1b222b'; g.fillRect(Math.round(OX + dx), Math.round(OY + dy), 1, 1); }
  }
})();
const selKits = new WeakMap();
function selRender(ctx, clip, t) {
  const p = poseAt(clip, t);
  if ('cape' in p) { p.cape += 3 * Math.sin(t / 260); p.sash += 4 * Math.sin(t / 330); }
  const info = drawFigure(p);
  if (!selKits.has(ctx)) selKits.set(ctx, fxKit(ctx));
  const S = selKits.get(ctx), sh = clip.shake ? clip.shake(t) : [0, 0];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, SW, SH); ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, sh[0], sh[1]);
  ctx.drawImage(selTile, 0, 0);
  ctx.globalAlpha = p.ringA === undefined ? 1 : p.ringA; S.ell(0, 0, 19, 9, '#2ec4b6'); S.ell(0, 0, 18, 8.4, '#2ec4b6'); ctx.globalAlpha = 1;
  if (clip.back) clip.back(S, t, info, clip);
  ctx.globalAlpha = p.alpha; ctx.drawImage(fig, 0, 0); ctx.globalAlpha = 1;
  if (clip.useCtx) clip.useCtx(ctx);
  if (info.cigar && !p.cigarOff) cigarSmoke(S, t, info);
  if (clip.front) clip.front(S, t, info, clip);
}
const breathe = (t, per) => .5 - .5 * Math.cos(t / per * Math.PI * 2);

/* Bruiser on the Hero Select screen: idle with the muzzle at the sky, ready = swing down and three shots */

// The muzzle and breech of the shots, for the effects of the clips that fire.
for (const clip of CLIPS) if (clip.fireAts) clip.fires = clip.fireAts.map(t => drawFigure(poseAt(clip, t)));
const SHOTS = [1320, 2040, 2760];
const SEL_IDLE = {
  dur: 2000,
  tracks: {
    armF: [[0, -167], [1000, -177], [2000, -167]], head: [[0, -9], [1000, -16], [2000, -9]],
    stretch: [[0, 1], [1000, 1.08], [2000, 1]], crouch: [[0, 1.4], [1000, 0], [2000, 1.4]],
    padDy: [[0, 1], [300, 1], [1250, -2], [2000, 1]], padL: [[0, -3], [1250, 10], [2000, -3]], padR: [[0, 3], [1250, -10], [2000, 3]],
    armB: [[0, 2], [1000, 12], [2000, 2]]
  },
  pose(t, p) { p.armFront = 1; },
  front(S, t, info) { if (t > 1000 && t < 1500) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.55)'); S.puff(info.cigar.x + 3, info.cigar.y - 3 - (t - 1300) * .01, t - 1300, 600, 3); }
};
const kick = (t0, rest, peak, back) => [[t0, rest], [t0 + 40, rest], [t0 + 130, peak, 'out'], [t0 + 420, back], [t0 + 600, rest]];
const SEL_READY = {
  tracks: {
    armF: [[0, -170], [360, -178], [700, -78, 'back'], [960, -94]].concat(kick(1320, -94, -152, -86), kick(2040, -94, -152, -86), kick(2760, -94, -160, -84), [[3600, -93]]),
    lean: [[0, 0], [360, -8], [700, 12, 'back'], [960, 4]].concat(kick(1320, 4, -16, 8), kick(2040, 4, -16, 8), kick(2760, 4, -22, 10), [[3600, 2]]),
    dx: [[0, 0], [960, 0]].concat(kick(1320, 0, -5, -2), kick(2040, 0, -5, -2), kick(2760, 0, -7, -3)),
    head: [[0, -12], [360, -16], [700, 8, 'back'], [960, 2]].concat(kick(1320, 2, -20, 8), kick(2040, 2, -20, 8), kick(2760, 2, -26, 10), [[3600, 0]]),
    padDy: [[0, 0], [700, -3, 'out'], [960, 0]].concat(kick(1320, 0, -5, 2), kick(2040, 0, -5, 2), kick(2760, 0, -7, 3)),
    padL: [[0, 0], [700, 14, 'out'], [960, 0]].concat(kick(1320, 0, 26, -8), kick(2040, 0, 26, -8), kick(2760, 0, 32, -10)),
    padR: [[0, 0], [700, -14, 'out'], [960, 0]].concat(kick(1320, 0, -26, 8), kick(2040, 0, -26, 8), kick(2760, 0, -32, 10)),
    crouch: [[0, 0], [700, 3, 'out'], [960, 2]].concat(kick(1320, 2, 5, 2), kick(2040, 2, 5, 2), kick(2760, 2, 6, 2), [[3600, 1]]),
    armB: [[0, 4], [700, -20, 'back'], [960, -10]].concat(kick(1320, -10, 46, 0), kick(2040, -10, 46, 0), kick(2760, -10, 56, 0), [[3600, 4]])
  },
  pose(t, p) { p.armFront = t < 520 ? 1 : 0; if (t > 3600) { const b = breathe(t - 3600, 2000); p.stretch = 1 + .06 * b; p.armF -= 3 * b; p.padDy = -2 * b; } },
  shake: t => { let x = 0, y = 0; for (const t0 of SHOTS) { const s = shakeAt(t, t0, 200, 2); x += s[0]; y += s[1]; } return [x, y]; },
  back(S, t) { for (const t0 of SHOTS) S.puff(-10 - (t - t0) * .02, -1, t - t0 - 40, 360, 3); },
  front(S, t, info) {
    const m = SEL_FIRE.muzzle;
    for (const t0 of SHOTS) {
      const a = t - t0;
      if (a >= 0 && a < 140) {
        const r = a < 50 ? 9 : a < 100 ? 7 : 4, cx = m.x + r - 2;
        S.disc(cx, m.y, r, '#ff7a1a'); S.disc(cx, m.y, r - 2, '#ffd24a'); S.disc(cx, m.y, Math.max(1, r - 5), '#ffffff');
        S.line(cx, m.y, cx + r + 8, m.y, '#ffd24a'); S.line(cx, m.y, cx + r, m.y - r - 3, '#ff7a1a'); S.line(cx, m.y, cx + r, m.y + r + 3, '#ff7a1a'); S.line(cx, m.y, cx - 2, m.y - r - 4, '#ffd24a');
      }
      if (a >= 40 && a < 190) { const x = m.x + 8 + (a - 40) * .2; S.rect(x - 10, m.y - 1, 10, 2, 'rgba(255,160,60,.45)'); S.rect(x, m.y - 2, 8, 4, '#ff8a2a'); S.rect(x + 2, m.y - 1, 5, 2, '#fff3c0'); }
      if (a >= 190 && a < 330) { const u = (a - 190) / 140; S.disc(m.x + 40, m.y, 2 + 3 * u, 'rgba(255,200,120,' + (1 - u).toFixed(2) + ')'); }
      for (let k = 0; k < 3; k++) S.puff(m.x + 4 + k * 3, m.y - (a - 120 - k * 50) * .016, a - 120 - k * 50, 600, 4);
      const s = a - 60;
      if (s >= 0 && s < 900) { const b = SEL_FIRE.breech, x = b.x - s * .03, y0 = b.y - 6 - .1 * s + .00017 * s * s, y = Math.min(y0, -1), flat = y0 >= -1 || Math.floor(s / 100) % 2; S.rect(x, y, flat ? 3 : 1, flat ? 1 : 3, '#d0483a'); S.rect(x, y, 1, 1, '#f2c14a'); }
      if (a > 0 && a < 400) S.disc(info.cigar.x, info.cigar.y, 1, 'rgba(255,170,60,.6)');
    }
  }
};
const SEL_FIRE = drawFigure(poseAt(SEL_READY, 1320));
const SEL_EXPORT = { readyEnd: 3600, holdDur: 2000, still: 1350 };
