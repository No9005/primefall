/** The design frame every scene is drawn in, in design pixels (ADR 0026, rule 5). */
export const DESIGN_WIDTH = 960;
export const DESIGN_HEIGHT = 444;
/** The canvas never gets more device pixels than this on its long side (ADR 0026, rule 7). */
export const MAX_CANVAS_SIDE = 2560;

export interface StageFit {
  /** Design pixels to window (CSS) pixels. */
  scale: number;
  /** Window position of the design frame's top-left corner. */
  offsetX: number;
  offsetY: number;
  /** Design pixels visible beyond the frame on each side; a scene continues its picture there. */
  visible: { left: number; right: number; top: number; bottom: number };
  /** Device pixels per window pixel, capped so the canvas stays within MAX_CANVAS_SIDE. */
  resolution: number;
}

/** Fits the design frame completely inside the window (no bars: the canvas fills the whole window). */
export function computeFit(windowWidth: number, windowHeight: number, devicePixelRatio: number): StageFit {
  const scale = Math.min(windowWidth / DESIGN_WIDTH, windowHeight / DESIGN_HEIGHT);
  const offsetX = (windowWidth - DESIGN_WIDTH * scale) / 2;
  const offsetY = (windowHeight - DESIGN_HEIGHT * scale) / 2;
  const resolution = Math.min(devicePixelRatio, MAX_CANVAS_SIDE / Math.max(windowWidth, windowHeight));
  return {
    scale,
    offsetX,
    offsetY,
    visible: { left: offsetX / scale, right: offsetX / scale, top: offsetY / scale, bottom: offsetY / scale },
    resolution,
  };
}
