// Tilly's clips for the hangar of the Hero Select (apps/web/src/hangar-select.ts). Appended to the Controller rig by `export.mjs --hangar`,
// after export-tail.js, so it can use the rig's figure, poses, effects and the Hero Select clips (SEL_IDLE, SEL_READY). The figure is the
// one of the map; only the choreography is the hangar's: the same clips, frame counts and times as the strips it replaces
// (`CLIPS` and `BRIDGES` in hangar-select.ts), which the exporter checks.

const HANGAR_FRAMES = { idle: 40, tolift: 2, act: 27, toidle: 2, selecti: 30, select: 23, hold: 88, desel: 15, bridge: 27 };
const HANGAR_MS = { idle: 2000, tolift: 120, act: 2700, toidle: 120, selecti: 1800, select: 1500, hold: 4400, desel: 1000 };

const lerp = (a, b, u) => a + (b - a) * u;
/** A pose halfway between two poses (every number blends; the rest comes from `a`). */
function blendPose(a, b, u) {
  const p = Object.assign({}, a);
  for (const k in b) if (typeof b[k] === 'number' && typeof a[k] === 'number') p[k] = lerp(a[k], b[k], u);
  return p;
}
/** A clip that is a blend between two moments of other clips, eased by `ease`. */
function blendClip(from, tFrom, to, tTo, ease = EASE.io) {
  return { tracks: {}, dur: 1, pose(u, p) { Object.assign(p, blendPose(poseAt(from, tFrom), poseAt(to, tTo), ease(Math.max(0, Math.min(1, u))))); } };
}

/* ---------- idle: the arm up, juggling nothing: the Hero Select idle without the drone ---------- */
// Raised higher than on the map: up from her back and over her head, as in the strips this replaces.
const UP_H = { g1: -18, g2: 52, g3: 52 };
const shiftTrack = (keys, by) => keys.map(([t, v, e]) => [t, v + by, e]);
const H_IDLE = {
  tracks: Object.assign({}, SEL_IDLE.tracks, { g1: shiftTrack(SEL_IDLE.tracks.g1, UP_H.g1 - UP.g1), g2: shiftTrack(SEL_IDLE.tracks.g2, UP_H.g2 - UP.g2), g3: shiftTrack(SEL_IDLE.tracks.g3, UP_H.g3 - UP.g3) }),
  front(S, t, info) { sparks(S, info.hold.x, info.hold.y, (t - 1600) * 2, 'rgba(111,240,208,.9)', 3); }
};

/* ---------- act: the original of the hangar strip. She works on the third arm with both hands over her head (frames 0 to 12), it shoots up and its claw tears
 off and flies away (13 to 17), she is shocked while the piece falls and the arm folds back (18 to 21), swings her left arm at it (22, 23), holds the arm up
 (24) and is back at work (25, 26). One frame of the strip is 100 ms. ---------- */
const LOOP = { g1: -15, g2: 70, g3: 135 };
const FR = n => n * 100;
const H_ACT = {
  tracks: {
    // the third arm: an arch over her head that rocks while she works, straight up when it tears, folded back, angled when she holds it up
    g1: K([0, LOOP.g1], [FR(6), LOOP.g1 - 10], [FR(7), LOOP.g1 + 6, 'out'], [FR(9), LOOP.g1 - 12], [FR(10), LOOP.g1 + 4, 'out'], [FR(12), LOOP.g1], [FR(13), -3, 'out'], [FR(17), -1], [FR(18), -20, 'back'], [FR(20), LOOP.g1 + 6], [FR(24), LOOP.g1 + 14], [FR(24.5), -26, 'out'], [FR(25), LOOP.g1]),
    g2: K([0, LOOP.g2], [FR(6), LOOP.g2 + 10], [FR(7), LOOP.g2 - 6, 'out'], [FR(9), LOOP.g2 + 8], [FR(10), LOOP.g2 - 8, 'out'], [FR(12), LOOP.g2], [FR(13), 2, 'out'], [FR(17), 4], [FR(18), 40, 'back'], [FR(20), LOOP.g2 - 6], [FR(24), LOOP.g2 - 20], [FR(24.5), 10, 'out'], [FR(25), LOOP.g2]),
    g3: K([0, LOOP.g3], [FR(7), LOOP.g3 - 10], [FR(10), LOOP.g3 + 8], [FR(12), LOOP.g3], [FR(13), 0, 'out'], [FR(17), 2], [FR(18), 70, 'back'], [FR(20), LOOP.g3 - 10], [FR(24), LOOP.g3 - 40], [FR(24.5), 14, 'out'], [FR(25), LOOP.g3]),
    claw: K([0, .3], [FR(2), 1], [FR(3), .1], [FR(5), .9], [FR(6), .2], [FR(9), 1], [FR(10), .2], [FR(12), .5], [FR(24), .8], [FR(27), .3]),
    armF: K([0, -150], [FR(12), -150], [FR(13), -168, 'out'], [FR(21), -160], [FR(22), -92, 'back'], [FR(23), -58, 'out'], [FR(23.9), -62], [FR(24.2), -170, 'out'], [FR(25), -150], [FR(27), -150]),
    // her robot arm reaches across her chest, below her face, to hold the end of the third arm
    armB: K([0, -100], [FR(12), -100], [FR(13), 24], [FR(22), 24], [FR(24), -100], [FR(27), -100]),
    armBFront: K([0, 1], [FR(13) - 1, 1], [FR(13), 0, 'step'], [FR(24) - 1, 0], [FR(24), 1, 'step']),
    head: K([0, 2], [FR(12), 2], [FR(13), -10, 'out'], [FR(17), -12], [FR(18), 8], [FR(21), 10], [FR(22), 14], [FR(24), -6], [FR(27), 2]),
    lean: K([0, 0], [FR(13), -8, 'out'], [FR(16), -6], [FR(18), 6, 'out'], [FR(21), 8], [FR(22), 14, 'out'], [FR(23), 16], [FR(24), -2], [FR(27), 0]),
    stretch: K([0, 1], [FR(13), 1.09, 'out'], [FR(17), 1.06], [FR(18), .93, 'out'], [FR(21), .95], [FR(24), 1.05], [FR(27), 1]),
    pony: K([0, 0], [FR(13), -22, 'out'], [FR(16), 12], [FR(18), 24, 'out'], [FR(22), -10], [FR(24), -18], [FR(27), 0]),
    core: K([0, 1], [FR(13), 2.2, 'in'], [FR(18), 2.6], [FR(22), 1.4], [FR(27), 1]),
    // the claw is off from the moment the arm shoots up until she has it back; she is shocked while the piece flies and falls
    // empty hands: the emitter of her left arm is not in her hand while she works
    noGun: K([0, 1], [FR(27), 1]),
    noClaw: K([0, 0], [FR(13) - 1, 0], [FR(13), 1, 'step'], [FR(24.5) - 1, 1], [FR(24.5), 0, 'step']),
    shock: K([0, 0], [FR(13) - 1, 0], [FR(13), 1, 'step'], [FR(24) - 1, 1], [FR(24), 0, 'step'])
  },
  back(S, t, info) {
    // steam from the joint where the claw tore off (frames 16 to 19)
    for (let k = 0; k < 3; k++) { const age = t - FR(16) - k * 120; S.puff(info.claw.x - 3 + k, info.claw.y + 16 - age * .02, age, 460, 3); }
  },
  front(S, t, info) {
    const INK = '#0b0f15';
    const piece = (x, y) => { S.rect(x - 5, y - 3, 11, 7, INK); S.rect(x - 4, y - 2, 9, 5, '#5a6672'); S.rect(x - 4, y - 2, 5, 2, '#9aa6b2'); S.rect(x - 3, y, 3, 2, '#6ae0ff'); S.rect(x + 2, y - 4, 2, 2, '#9aa6b2'); };
    // the piece flies off up and to the right (13 to 15), hangs at the top (16, 17), falls (18 to 20), bounces and lies on the floor (20 to 22)
    const rise = (t - FR(13)) / FR(1.5);
    if (t >= FR(13) && t < FR(18)) { const u = Math.max(0, Math.min(1, rise)); piece(Math.round(info.claw.x + 6 + (30 - info.claw.x - 6) * u), Math.round(info.claw.y - 4 + (-100 - info.claw.y + 4) * u + (t > FR(15.5) ? 2 * Math.sin(t / 60) : 0))); }
    if (t >= FR(18) && t < FR(22.9)) { const u = Math.min(1, (t - FR(18)) / FR(2)); let y = -100 + 92 * u * u; if (t > FR(20)) y = -8 - 5 * Math.sin(Math.min(1, (t - FR(20)) / FR(.6)) * Math.PI); piece(30 + (t > FR(20) ? 3 : 0), Math.round(y)); }
    // speed lines and a spark where it tears off, shock strokes over her head, the streak of the swing
    if (t >= FR(13) && t < FR(16)) { for (let i = 0; i < 4; i++) S.rect(-18 + i * 3, -104, 1, 12, '#e6edf2'); sparks(S, 8, -87, (t - FR(13)) * 1.2, '#fff3c0', 3); S.line(6, -90, 11, -86, '#fff3c0'); }
    if (t >= FR(20) && t < FR(22)) { S.line(-14, -96, -8, -92, '#fff3c0'); S.rect(0, -100, 1, 5, '#fff3c0'); S.line(14, -96, 9, -92, '#fff3c0'); }
    if (t >= FR(23) && t < FR(24)) for (let i = 0; i < 6; i++) { S.line(info.muzzle.x - 30 + i * 2, info.muzzle.y - 18 + i * 3, info.muzzle.x - 2 + i * 6, info.muzzle.y + i, i < 3 ? 'rgba(255,170,90,.75)' : 'rgba(255,230,200,.7)'); }
    if (t >= FR(24) && t < FR(24.6)) piece(info.muzzle.x + 1, info.muzzle.y - 7);
    sparks(S, info.hold.x, info.hold.y, t - FR(2), '#fff3c0', 2);
    sparks(S, info.hold.x, info.hold.y, t - FR(25), '#fff3c0', 2);
  }
};

/* ---------- ready: the drone is thrown up and hovers (the Hero Select clip of the map, with a puff where it appears) ---------- */
const H_READY = Object.assign({}, SEL_READY, {
  front(S, t, info, clip) {
    const q = clip.dronePos(t, info);
    if (t >= 1080 && t < 1400) for (let i = 1; i < 4; i++) S.rect(q.x - 1, q.y + 3 + i * 4, 2, 3, 'rgba(230,237,242,' + (.5 - i * .12).toFixed(2) + ')');
    if (t > 1900) { const w = Math.floor(t / 100) % 2; for (let j = 0; j < 14; j += 2) S.rect(q.x - 1 - j * .3, q.y + 4 + j, 3 + j * .6, 1, 'rgba(111,240,208,' + (w ? '.10)' : '.18)')); }
    if (t >= 900) drone(S, q.x, q.y, t);
    for (let k = 0; k < 3; k++) { const age = t - 1080 - k * 90; S.puff(info.hold.x + 4 + k * 5, info.hold.y - 3 - age * .02, age, 520, 4 + k); }
    sparks(S, info.hold.x, info.hold.y, t - 1080, '#fff3c0', 5);
  }
});
const H_READY_END = 2400;

/* ---------- frames: what each strip of the hangar is rendered from ---------- */
const HANGAR_EXPORT = (() => {
  const idleEnd = poseAt(H_IDLE, 0), actStart = poseAt(H_ACT, 0), actEnd = poseAt(H_ACT, 2700), readyStart = poseAt(H_READY, 0);
  const holdPose = poseAt(H_READY, H_READY_END);
  // Short hops between poses: `tolift` goes from the idle pose into the first pose of the action, `toidle` back. Two frames each.
  const toLift = blendClip(H_IDLE, 0, H_ACT, 0), toIdle = blendClip(H_ACT, 2700, H_IDLE, 0);
  // `desel`: out of the held pose, the arm folds down and lands in the idle pose.
  const desel = blendClip(H_READY, H_READY_END, H_IDLE, 0, EASE.back);
  const list = [
    { name: 'idle', clip: H_IDLE, from: 0, to: 2400, loop: true },
    { name: 'tolift', clip: toLift, from: 0, to: 1, frames: 2, still: true, endpoints: true },
    { name: 'act', clip: H_ACT, from: 0, to: 2700, loop: true },
    { name: 'toidle', clip: toIdle, from: 0, to: 1, frames: 2, still: true, endpoints: true },
    { name: 'selecti', clip: H_READY, from: 0, to: H_READY_END, once: true },
    { name: 'select', clip: H_READY, from: 0, to: H_READY_END, once: true },
    { name: 'hold', clip: H_READY, from: H_READY_END, to: H_READY_END + 4400, loop: true },
    { name: 'desel', clip: desel, from: 0, to: 1, once: true }
  ];
  for (const d of list) { d.frames = d.frames || HANGAR_FRAMES[d.name]; d.ms = HANGAR_MS[d.name]; }
  // The bridge: from every moment of the action, two frames on the way into the first pose of the ready clip.
  const bridges = [];
  for (let m = 0; m < HANGAR_FRAMES.act; m++) {
    const tAct = (m / HANGAR_FRAMES.act) * 2700;
    for (const u of [1 / 3, 2 / 3]) bridges.push({ clip: blendClip(H_ACT, tAct, H_READY, 0, EASE.out), t: u, source: H_ACT, tSource: tAct, u });
  }
  return { list, bridges };
})();
