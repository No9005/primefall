// The look of a card that goes into the Exile (Deck Damage): it lifts off the pile, then a glowing edge creeps up through it
// from the bottom along a ragged noise line, the card behind the edge turns to charcoal that thins out, and sparks rise
// from the edge, flicker and go out one by one. Pure pixels (no canvas), so it is tested; `DeckBurn.tsx` draws them. The
// look was agreed in an artifact with the product owner (issue 422 chat).

export const GLIMMER = {
  /** Fractions of the burn time (BURN_MS): the card has lifted; the edge appears; the last of the card is gone. */
  liftEnd: 0.22,
  burnStart: 0.14,
  burnEnd: 0.8,
  /** How far the card lifts, and the empty rows above the card that make room for it, in pixels. */
  liftPx: 14,
  headroom: 14,
} as const;

export interface Raster {
  width: number;
  height: number;
  /** RGBA, row by row. */
  data: Uint8ClampedArray;
}

export interface Spark {
  x: number;
  y: number;
  /** The burn time of the pixel it comes from: it starts when the edge has passed there. */
  at: number;
  vx: number;
  vy: number;
  life: number;
  phase: number;
}

/** Deterministic noise in 0..1 from two integers (the same card always burns the same way). */
function hash(a: number, b: number): number {
  let n = Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, scale: number): number {
  const cx = Math.floor(x / scale);
  const cy = Math.floor(y / scale);
  const fx = x / scale - cx;
  const fy = y / scale - cy;
  const ease = (value: number) => value * value * (3 - 2 * value);
  const [u, v] = [ease(fx), ease(fy)];
  const [a, b, c, d] = [hash(cx, cy), hash(cx + 1, cy), hash(cx, cy + 1), hash(cx + 1, cy + 1)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** For every pixel of the card, when the edge reaches it (0 at the bottom to 1 at the top, with a ragged line). */
function glimmerField(width: number, height: number): Float32Array {
  const field = new Float32Array(width * height);
  let low = Infinity;
  let high = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = 0.5 * (1 - y / height) + 0.5 * (0.6 * valueNoise(x, y, 9) + 0.4 * valueNoise(x, y, 3.5));
      field[y * width + x] = value;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  return field.map((value) => (value - low) / (high - low));
}

const SPARK_COUNT = 46;

/** What a card needs to burn: the line the edge follows and the sparks. Made once per card picture. */
export interface Glimmer {
  field: Float32Array;
  sparks: Spark[];
}

export function glimmerOf(width: number, height: number): Glimmer {
  const field = glimmerField(width, height);
  return { field, sparks: glimmerSparks(field, width, height) };
}

function glimmerSparks(field: Float32Array, width: number, height: number): Spark[] {
  return Array.from({ length: SPARK_COUNT }, (_, index) => {
    const x = Math.floor(hash(index, 1) * width);
    const y = Math.floor(hash(index, 2) * height);
    return {
      x,
      y,
      at: field[Math.min(height - 1, y) * width + x]!,
      vx: (hash(index, 3) - 0.5) * 10,
      vy: -(6 + hash(index, 4) * 14),
      life: 0.16 + hash(index, 5) * 0.22,
      phase: hash(index, 6) * 9,
    };
  });
}

/** The front moves from 0 to a little past 1, so that the charcoal behind it has thinned out where the card ends. */
const FRONT_REACH = 1.22;

/**
 * The picture of the card `t` (0 to 1 of the burn time) after it started to burn, as a raster of the card's width and its
 * height plus `GLIMMER.headroom` rows. `withSparks` false leaves the sparks out (for tests).
 */
export function glimmerFrame(card: Raster, { field, sparks }: Glimmer, t: number, withSparks = true): Raster {
  const { width, height } = card;
  const out: Raster = { width, height: height + GLIMMER.headroom, data: new Uint8ClampedArray(width * (height + GLIMMER.headroom) * 4) };
  const lift = Math.min(1, t / GLIMMER.liftEnd);
  const dy = GLIMMER.headroom - Math.round(GLIMMER.liftPx * (1 - (1 - lift) ** 3));
  const front = t < GLIMMER.burnStart ? -1 : ((t - GLIMMER.burnStart) / (GLIMMER.burnEnd - GLIMMER.burnStart)) * FRONT_REACH;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = glimmerPixel(card, x, y, front - field[y * width + x]!, front >= 0);
      const row = y + dy;
      if (!pixel || row < 0 || row >= out.height) continue;
      out.data.set(pixel, (row * width + x) * 4);
    }
  }
  if (withSparks && front >= 0) drawSparks(out, sparks, front, dy);
  return out;
}

/** One pixel of the card: as it was, glowing hot at the edge, glowing red, charcoal that thins out, or gone (undefined). */
function glimmerPixel(card: Raster, x: number, y: number, behind: number, burning: boolean): [number, number, number, number] | undefined {
  const at = (y * card.width + x) * 4;
  const [r, g, b] = [card.data[at]!, card.data[at + 1]!, card.data[at + 2]!];
  if (card.data[at + 3] === 0) return undefined;
  if (!burning || behind <= -0.05) return [r, g, b, 255];
  if (behind <= 0) {
    // Just before the edge: the card warms up.
    const warm = 1 + behind / 0.05;
    return [Math.round(r + (255 - r) * warm * 0.5), Math.round(g + (120 - g) * warm * 0.35), Math.round(b * (1 - warm * 0.4)), 255];
  }
  if (behind < 0.045) {
    const k = behind / 0.045;
    return [255, Math.round(220 - 150 * k), Math.round(80 - 70 * k), 255];
  }
  if (behind < 0.1) {
    const k = (behind - 0.045) / 0.055;
    return [Math.round(200 - 150 * k), Math.round(60 - 45 * k), Math.round(25 - 15 * k), 255];
  }
  if (behind < 0.2) {
    const k = (behind - 0.1) / 0.1;
    // The charcoal thins out in a fixed pattern of holes.
    return (x * 7 + y * 13) % 5 < k * 5 ? undefined : [40, 30, 28, Math.round(255 * (1 - k))];
  }
  return undefined;
}

function drawSparks(out: Raster, sparks: Spark[], front: number, dy: number): void {
  for (const spark of sparks) {
    if (front < spark.at) continue;
    const age = ((front - spark.at) / FRONT_REACH) * (GLIMMER.burnEnd - GLIMMER.burnStart);
    if (age > spark.life) continue;
    const q = age / spark.life;
    const flicker = 0.5 + 0.5 * Math.sin(age * 60 + spark.phase);
    const alpha = (1 - q) * (0.4 + 0.6 * flicker);
    const [r, g, b] = q < 0.5 ? [255, Math.round(190 - 180 * q), 70] : [230, Math.round(90 - 120 * (q - 0.5)), 40];
    const size = q > 0.6 ? 1 : 2;
    const [px, py] = [Math.round(spark.x + spark.vx * age), Math.round(spark.y + dy + spark.vy * age)];
    for (let oy = 0; oy < size; oy++) {
      for (let ox = 0; ox < size; ox++) {
        const [sx, sy] = [px + ox, py + oy];
        if (sx < 0 || sx >= out.width || sy < 0 || sy >= out.height) continue;
        const at = (sy * out.width + sx) * 4;
        if (out.data[at + 3]! > Math.round(alpha * 255)) continue;
        out.data.set([r, g, Math.max(0, b), Math.round(alpha * 255)], at);
      }
    }
  }
}
