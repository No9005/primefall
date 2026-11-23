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

/* ---------- act: tinkering. The arm folds over her head and works, shoots up and throws a gear, she steams, wrenches with her left arm ---------- */
const LOOP = { g1: -48, g2: 112, g3: 150 };
const H_ACT = {
  tracks: {
    g1: K([0, LOOP.g1], [550, LOOP.g1 - 6], [700, LOOP.g1 + 10, 'out'], [1050, LOOP.g1], [1250, -6, 'out'], [1650, -3], [1750, -14, 'back'], [1900, LOOP.g1 + 8], [2150, LOOP.g1], [2500, -4, 'out'], [2700, LOOP.g1]),
    g2: K([0, LOOP.g2], [550, LOOP.g2 + 8], [700, LOOP.g2 - 10, 'out'], [1050, LOOP.g2], [1250, 6, 'out'], [1650, 4], [1750, 30, 'back'], [1900, LOOP.g2 + 6], [2150, LOOP.g2], [2500, 8, 'out'], [2700, LOOP.g2]),
    g3: K([0, LOOP.g3], [550, LOOP.g3 + 10], [700, LOOP.g3 - 12, 'out'], [1050, LOOP.g3], [1250, 4, 'out'], [1650, 2], [1750, 60, 'back'], [1900, LOOP.g3 - 6], [2150, LOOP.g3], [2500, 10, 'out'], [2700, LOOP.g3]),
    claw: K([0, .3], [500, 1], [600, .1], [700, 1], [800, .1], [1050, .5], [1250, 1], [1650, 1], [1750, 0], [2150, .4], [2500, 1], [2700, .3]),
    armF: K([0, -150], [1100, -150], [1250, -158, 'out'], [1650, -158], [1900, -60, 'back'], [2150, -70], [2250, -112, 'out'], [2400, -40], [2500, -168, 'back'], [2700, -150]),
    armB: K([0, 6], [1100, 6], [1250, -40], [1650, -40], [1900, 14], [2700, 6]),
    head: K([0, 2], [550, -5], [1100, 5], [1250, -10, 'out'], [1650, -10], [1750, 8, 'out'], [2150, 6], [2500, -8], [2700, 2]),
    lean: K([0, 0], [1250, -5, 'out'], [1650, -5], [1750, 3, 'out'], [2150, 3], [2300, 12, 'out'], [2500, -2], [2700, 0]),
    stretch: K([0, 1], [600, 1.03], [1250, 1.08, 'out'], [1650, 1.08], [1750, .93, 'out'], [1900, 1], [2300, .94, 'out'], [2500, 1.05], [2700, 1]),
    pony: K([0, 0], [700, 10], [1250, -16, 'out'], [1750, 20, 'out'], [2300, 8], [2500, -20, 'out'], [2700, 0]),
    core: K([0, 1], [1250, 1.8], [1750, 2.4, 'in'], [2150, 1.6], [2700, 1])
  },
  back(S, t, info) {
    // Steam from the arm joint while she is startled (1750 to 2300 ms).
    for (let k = 0; k < 3; k++) { const age = t - 1750 - k * 160; S.puff(info.elbow.x - 4 - age * .01, info.elbow.y - age * .02, age, 520, 3); }
  },
  front(S, t, info) {
    const GEAR = '#9aa6b2', INK = '#0b0f15';
    // The gear is thrown up by the arm at 1250 ms, hangs, and falls back at 1750 ms.
    const a = t - 1250;
    if (a >= 0 && a < 1000) {
      const rise = a < 300 ? a * .22 : 66 - (a - 300) * .02, y = a < 700 ? info.claw.y - 4 - Math.min(rise, 26) : info.claw.y - 30 + (a - 700) * .09, x = info.claw.x + 4 + a * .01;
      S.disc(x, y, 4, INK); S.disc(x, y, 3, GEAR); S.disc(x, y, 1, INK); S.rect(x - 1, y - 4, 3, 1, '#e6edf2');
      if (a < 320) for (let i = 1; i < 4; i++) S.rect(x - 1, y + 4 + i * 3, 1, 2, 'rgba(230,237,242,' + (.6 - i * .15).toFixed(2) + ')');
    }
    sparks(S, info.hold.x, info.hold.y, t - 100, GLOW + '.9)', 2);
    sparks(S, info.hold.x, info.hold.y, t - 700, '#fff3c0', 2);
    if (t > 2300 && t < 2480) for (let k = 0; k < 3; k++) S.line(info.hold.x - 4 + k * 4, info.hold.y - 4, info.hold.x - 7 + k * 7, info.hold.y - 9, '#fff3c0');
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
