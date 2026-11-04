// The look of the Fog of War: a slowly drifting cloud layer over the tiles the Squad does not see (issue #275).
// Presentation only. The pure parts (the fog shape per tile, the drift over time, the cloud pattern) are tested without
// a browser; `FogClouds` draws them with one mesh and one small shader, so a frame costs one draw call and no allocation.
// The fog shape is a function of the Squad's own sight only; enemies and hidden state never enter it (ADR 0005).
import { type Grid, type GridPosition } from "game-core";
import { BufferImageSource, Container, Mesh, MeshGeometry, Shader } from "pixi.js";
import { footprintCorners, litTiles } from "./terrain";
import { FOG_CLOUDS } from "./terrain-style";

/** A tile this far (in tiles, centre to centre) from the nearest seen tile or more is fully fogged. */
const FEATHER_TILES = 2;

/**
 * Fog per tile, row by row (0 = no cloud, 1 = full): 0 for a seen tile, 1 from `FEATHER_TILES` away from the seen area,
 * graded in between, so the edge of the seen area is soft over about one tile. A plain function of the seen tiles.
 */
export function fogAlphas(width: number, height: number, seen: ReadonlySet<string>): Float32Array {
  const alphas = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      alphas[row * width + col] = seen.has(`${col},${row}`) ? 0 : Math.min(1, nearestSeen(seen, col, row) / FEATHER_TILES);
    }
  }
  return alphas;
}

function nearestSeen(seen: ReadonlySet<string>, col: number, row: number): number {
  let nearest = FEATHER_TILES;
  for (let dRow = -FEATHER_TILES; dRow <= FEATHER_TILES; dRow++) {
    for (let dCol = -FEATHER_TILES; dCol <= FEATHER_TILES; dCol++) {
      if (seen.has(`${col + dCol},${row + dRow}`)) nearest = Math.min(nearest, Math.hypot(dCol, dRow));
    }
  }
  return nearest;
}

/** The fog of a Squad's view: only its visible tiles and the tiles its own Heroes stand on count, never an enemy. */
export function fogShape(grid: Pick<Grid, "width" | "height">, visibleTiles: readonly GridPosition[], ownHeroPositions: readonly GridPosition[]): Float32Array {
  return fogAlphas(grid.width, grid.height, litTiles(visibleTiles, ownHeroPositions));
}

export type CloudLayer = "a" | "b";

/** Where a layer has drifted to `ms` after the start, in world pixels (a layer's texture is shifted by this). Zero with reduced motion. */
export function driftOffset(layer: CloudLayer, ms: number, reducedMotion: boolean): { x: number; y: number } {
  if (reducedMotion) return { x: 0, y: 0 };
  const { speed, direction } = FOG_CLOUDS[layer];
  const length = Math.hypot(direction.x, direction.y);
  const travelled = (speed * ms) / 1000;
  return { x: (direction.x / length) * travelled, y: (direction.y / length) * travelled };
}

/** The drift as a fraction of the cloud period, wrapped to 0..1 so the shader keeps its precision however long the game runs. */
export function driftUv(layer: CloudLayer, ms: number, reducedMotion: boolean): { u: number; v: number } {
  const { x, y } = driftOffset(layer, ms, reducedMotion);
  const { period } = FOG_CLOUDS[layer];
  const wrap = (value: number) => ((value / period) % 1 + 1) % 1;
  return { u: wrap(x), v: wrap(y) };
}

/** A tileable cloud pattern, `size` by `size` values in 0..255: periodic value noise of three octaves, the same every time. */
export function cloudPattern(size: number): Uint8Array {
  const octaves = [{ cells: 4, weight: 0.5 }, { cells: 8, weight: 0.3 }, { cells: 16, weight: 0.2 }];
  const hash = (x: number, y: number, octave: number) => {
    let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(octave + 1, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      octaves.forEach(({ cells, weight }, octave) => {
        const gx = (x / size) * cells;
        const gy = (y / size) * cells;
        const [x0, y0] = [Math.floor(gx), Math.floor(gy)];
        const ease = (t: number) => t * t * (3 - 2 * t);
        const [tx, ty] = [ease(gx - x0), ease(gy - y0)];
        const corner = (cx: number, cy: number) => hash(cx % cells, cy % cells, octave);
        const top = corner(x0, y0) * (1 - tx) + corner(x0 + 1, y0) * tx;
        const bottom = corner(x0, y0 + 1) * (1 - tx) + corner(x0 + 1, y0 + 1) * tx;
        sum += weight * (top * (1 - ty) + bottom * ty);
      });
      values[y * size + x] = sum;
    }
  }
  // Stretch to the full range so the clouds always use the whole alpha span.
  const low = Math.min(...values);
  const high = Math.max(...values);
  return Uint8Array.from(values, (value) => Math.round(((value - low) / (high - low)) * 255));
}

const CLOUD_SIZE = 128;

const VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vWorld;
out vec2 vMask;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vWorld = aPosition;
  vMask = aUV;
}`;

// Two cloud layers (different scale, speed and direction) mixed into one density; the per-tile fog texture scales it.
// The output is premultiplied: tint * alpha, alpha.
const FRAGMENT = `
precision highp float;
in vec2 vWorld;
in vec2 vMask;
out vec4 finalColor;
uniform sampler2D uCloud;
uniform sampler2D uMask;
uniform vec4 uDrift;
uniform vec4 uPeriods;
uniform vec4 uAlpha;
uniform vec3 uTint;
void main() {
  float fog = texture(uMask, vMask).a;
  float a = texture(uCloud, vWorld * uPeriods.x + uDrift.xy).r;
  float b = texture(uCloud, vWorld * uPeriods.y + uDrift.zw + vec2(0.37, 0.61)).r;
  float density = smoothstep(0.2, 0.8, 0.5 * (a + b));
  float alpha = fog * mix(uAlpha.x, uAlpha.y, density);
  finalColor = vec4(uTint * alpha, alpha);
}`;

function rgb(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

/** The cloud layer of one board: a mesh over the grid footprint, turned with the view angle, with its own drift loop. */
export class FogClouds {
  readonly container = new Container();
  private readonly geometry: MeshGeometry;
  private readonly maskPixels: Uint8Array;
  private readonly maskSource: BufferImageSource;
  private readonly cloudSource: BufferImageSource;
  private readonly drift = new Float32Array(4);
  private readonly start = performance.now();
  private frame = 0;

  constructor(
    private readonly grid: Pick<Grid, "width" | "height">,
    angle: number,
    private readonly reducedMotion: boolean,
  ) {
    const { width, height } = grid;
    // One texel per tile, linearly filtered: texel centres sit on tile centres, so the mask is feathered between tiles.
    this.maskPixels = new Uint8Array(width * height * 4).fill(255);
    this.maskSource = new BufferImageSource({ resource: this.maskPixels, width, height, scaleMode: "linear", addressMode: "clamp-to-edge" });
    const pattern = cloudPattern(CLOUD_SIZE);
    const cloudPixels = new Uint8Array(CLOUD_SIZE * CLOUD_SIZE * 4).fill(255);
    pattern.forEach((value, index) => (cloudPixels[index * 4] = value));
    this.cloudSource = new BufferImageSource({ resource: cloudPixels, width: CLOUD_SIZE, height: CLOUD_SIZE, scaleMode: "linear", addressMode: "repeat" });

    // The quad covers the grid footprint; its uv is the position in the grid, from the first tile's edge to the last one's.
    this.geometry = new MeshGeometry({
      positions: new Float32Array(8),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.setAngle(angle);
    const { a, b } = FOG_CLOUDS;
    const shader = Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uCloud: this.cloudSource,
        uMask: this.maskSource,
        fogUniforms: {
          uDrift: { value: this.drift, type: "vec4<f32>" },
          uPeriods: { value: new Float32Array([1 / a.period, 1 / b.period, 0, 0]), type: "vec4<f32>" },
          uAlpha: { value: new Float32Array([FOG_CLOUDS.thinAlpha, FOG_CLOUDS.denseAlpha, 0, 0]), type: "vec4<f32>" },
          uTint: { value: new Float32Array(rgb(FOG_CLOUDS.tint)), type: "vec3<f32>" },
        },
      },
    });
    this.shader = shader;
    this.container.addChild(new Mesh({ geometry: this.geometry, shader }));
    this.tick();
  }

  private readonly shader: Shader;

  /** Moves the quad to the footprint of the grid at a view angle (the clouds themselves stay in world space). */
  setAngle(angle: number): void {
    const positions = this.geometry.positions;
    footprintCorners(this.grid as Grid, angle).forEach(({ x, y }, index) => {
      positions[index * 2] = x;
      positions[index * 2 + 1] = y;
    });
    this.geometry.getBuffer("aPosition").update();
  }

  /** Sets the fog per tile (`fogAlphas` order); the texture is uploaded now, not every frame. */
  setFog(alphas: Float32Array): void {
    alphas.forEach((alpha, index) => (this.maskPixels[index * 4 + 3] = Math.round(alpha * 255)));
    this.maskSource.update();
  }

  private tick = (): void => {
    const now = performance.now() - this.start;
    const a = driftUv("a", now, this.reducedMotion);
    const b = driftUv("b", now, this.reducedMotion);
    this.drift[0] = a.u;
    this.drift[1] = a.v;
    this.drift[2] = b.u;
    this.drift[3] = b.v;
    this.shader.resources.fogUniforms.update();
    if (!this.reducedMotion) this.frame = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.container.destroy({ children: true });
    this.maskSource.destroy();
    this.cloudSource.destroy();
  }
}
