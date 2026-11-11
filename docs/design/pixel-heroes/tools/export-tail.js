// Appended to every rig in tools/rigs/ by export.mjs. It turns the rig's clips into separate layers per frame:
// the figure, the effects behind it and the effects in front of it. The tile and the Squad ring are not drawn.

const EXPORT_CLIPS = CLIPS.map(c => ({ name: c.id, label: c.name, clip: c, t0: 0, dur: c.dur, loop: !!c.loop, endFrame: !c.loop, still: c.still }))
  .concat([
    { name: 'select_idle', label: 'Hero Select: idle', clip: SEL_IDLE, t0: 0, dur: SEL_IDLE.dur, loop: true, endFrame: false, still: 0 },
    { name: 'select_ready', label: 'Hero Select: ready', clip: SEL_READY, t0: 0, dur: SEL_EXPORT.readyEnd, loop: false, endFrame: false, still: SEL_EXPORT.still },
    { name: 'select_hold', label: 'Hero Select: ready, held', clip: SEL_READY, t0: SEL_EXPORT.readyEnd, dur: SEL_EXPORT.holdDur, loop: true, endFrame: false, still: SEL_EXPORT.readyEnd }
  ]);

const LAYERS = ['figure', 'fx_back', 'fx_front'];
const layerCtx = {};
for (const name of LAYERS) {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  layerCtx[name] = c.getContext('2d', { willReadFrequently: true });
}
const layerKit = { fx_back: fxKit(layerCtx.fx_back), fx_front: fxKit(layerCtx.fx_front) };
const TAU = Math.PI * 2;

// Cloth flutter and cigar smoke run on their own clocks. In a loop they are fitted to the loop length so the last
// frame leads into the first one.
function flutter(pose, t, d) {
  if (!('cape' in pose)) return pose;
  if (d.loop) {
    const a = Math.max(1, Math.round(d.dur / 1634)), b = Math.max(1, Math.round(d.dur / 2073));
    pose.cape += 3 * Math.sin(t / d.dur * a * TAU); pose.sash += 4 * Math.sin(t / d.dur * b * TAU);
  } else { pose.cape += 3 * Math.sin(t / 260); pose.sash += 4 * Math.sin(t / 330); }
  return pose;
}
function smokeTime(t, d) { return d.loop ? t * Math.max(1, Math.round(d.dur / 1500)) * 1500 / d.dur : t; }

function renderLayers(d, i, step) {
  const clip = d.clip, t = d.t0 + i * step, back = layerCtx.fx_back, front = layerCtx.fx_front, figure = layerCtx.figure;
  for (const name of LAYERS) { layerCtx[name].setTransform(1, 0, 0, 1, 0, 0); layerCtx[name].globalAlpha = 1; layerCtx[name].clearRect(0, 0, SW, SH); }
  if (clip.trail && clip.trail(t)) {
    for (const dt of [160, 80]) {
      const tt = d.loop ? ((t - dt - d.t0 + d.dur) % d.dur) + d.t0 : Math.max(d.t0, t - dt);
      const ghost = flutter(poseAt(clip, tt), tt, d); ghost.ghost = 1; drawFigure(ghost);
      back.globalAlpha = dt > 100 ? .22 : .38; back.drawImage(fig, 0, 0); back.globalAlpha = 1;
    }
  }
  const pose = flutter(poseAt(clip, t), t, d), info = drawFigure(pose);
  figure.globalAlpha = pose.alpha; figure.drawImage(fig, 0, 0); figure.globalAlpha = 1;
  if (clip.back) clip.back(layerKit.fx_back, t, info, clip);
  if (typeof CUR !== 'undefined') CUR = front;   // only the Assassin rig draws loose sprites (the flung rifle)
  if (info.cigar && !pose.cigarOff) cigarSmoke(layerKit.fx_front, smokeTime(t, d), info);
  if (clip.front) clip.front(layerKit.fx_front, t, info, clip);
  return {
    shake: clip.shake ? clip.shake(t) : [0, 0],
    ringRed: pose.ringRed > 0,
    ringAlpha: pose.ringA === undefined ? (pose.alpha < .05 ? 0 : 1) : Number(pose.ringA.toFixed(2))
  };
}

return { EXPORT_CLIPS, LAYERS, layerCtx, renderLayers, selRender, SW, SH, OX, OY, FRAME };
