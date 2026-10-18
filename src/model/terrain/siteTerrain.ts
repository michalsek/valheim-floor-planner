/**
 * The ground of an imported site (`ImportFrame.terrain`): decoding its heights, the
 * world ↔ plan mapping, and the ground height under a point, a polygon or a rectangle.
 *
 * Heights are plan heights (world y − `origin.y`), so the ground and the plan's boxes
 * share one frame. Between vertices the ground is the terrain collider's: each 1 m quad
 * split along its (x + 1, z)–(x, z + 1) diagonal in world terms (research §8), so pieces
 * meet the drawn ground where support says they do. Pure: base64 via `atob` / `btoa`.
 */
import { rotate } from '../geometry/propGeometry';
import type { ImportFrame, SiteTerrain, Vec2 } from '../types';

/** A decoded patch: plan heights (metres) at world vertices `(x0 + col, z0 + row)`. */
export interface TerrainGrid {
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  /** Row-major, row = world z. */
  heights: Float32Array;
}

/** The plan frame of an import: where plan (0, 0, 0) is in the world, and its turn. */
export type SiteFrame = Pick<ImportFrame, 'origin' | 'yaw'>;

/** int16 centimetres: ±327.67 m about `origin.y`. */
const CM_LIMIT = 32767;

const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(text);
};

const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/**
 * Plan heights (metres) as `SiteTerrain.heights`: int16 little-endian centimetres in
 * base64. `clamped` counts values beyond ±327.67 m, which are clamped.
 */
export const encodeHeights = (metres: ArrayLike<number>): { heights: string; clamped: number } => {
  const view = new DataView(new ArrayBuffer(metres.length * 2));
  let clamped = 0;
  for (let i = 0; i < metres.length; i++) {
    const cm = Math.round(metres[i]! * 100);
    if (Math.abs(cm) > CM_LIMIT) clamped++;
    view.setInt16(2 * i, Math.max(-CM_LIMIT, Math.min(CM_LIMIT, cm)), true);
  }
  return { heights: toBase64(new Uint8Array(view.buffer)), clamped };
};

/** `SiteTerrain.heights` back as metres; null when it isn't base64. */
export const decodeHeights = (heights: string): Float32Array | null => {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(heights);
  } catch {
    return null;
  }
  if (bytes.length % 2 !== 0) return null;
  const view = new DataView(bytes.buffer);
  return Float32Array.from(
    { length: bytes.length / 2 },
    (_, i) => view.getInt16(2 * i, true) / 100
  );
};

const grids = new WeakMap<SiteTerrain, TerrainGrid>();

/** The decoded patch (once per terrain object; the plan's undo history shares them). */
export const terrainGrid = (terrain: SiteTerrain): TerrainGrid => {
  let grid = grids.get(terrain);
  if (!grid) {
    const { x0, z0, cols, rows } = terrain;
    const heights = decodeHeights(terrain.heights) ?? new Float32Array(cols * rows);
    grids.set(terrain, (grid = { x0, z0, cols, rows, heights }));
  }
  return grid;
};

/** The world point (game axes) of a plan point: turn by `yaw`, then mirror z. */
export const planToWorld = (frame: SiteFrame, p: Vec2): Vec2 => {
  const u = rotate(p, frame.yaw);
  return { x: frame.origin.x + u.x, z: frame.origin.z - u.z };
};

export const worldToPlan = (frame: SiteFrame, w: Vec2): Vec2 =>
  rotate({ x: w.x - frame.origin.x, z: frame.origin.z - w.z }, -frame.yaw);

/** The collider's height at a world point; null off the patch. */
export const groundAtWorld = (grid: TerrainGrid, x: number, z: number): number | null => {
  const u = x - grid.x0;
  const w = z - grid.z0;
  if (!(u >= 0 && w >= 0 && u <= grid.cols - 1 && w <= grid.rows - 1)) return null;
  const i = Math.min(Math.floor(u), grid.cols - 2);
  const j = Math.min(Math.floor(w), grid.rows - 2);
  const fu = u - i;
  const fw = w - j;
  const h = grid.heights;
  const at = (di: number, dj: number) => h[(j + dj) * grid.cols + i + di]!;
  if (fu + fw <= 1) {
    const h00 = at(0, 0);
    return h00 + (at(1, 0) - h00) * fu + (at(0, 1) - h00) * fw;
  }
  const h11 = at(1, 1);
  return h11 + (at(0, 1) - h11) * (1 - fu) + (at(1, 0) - h11) * (1 - fw);
};

/** The ground's plan height under a plan point; null off the patch. */
export const groundAt = (grid: TerrainGrid, frame: SiteFrame, p: Vec2): number | null => {
  const w = planToWorld(frame, p);
  return groundAtWorld(grid, w.x, w.z);
};

/** Even-odd test of a point against a polygon. */
const inside = (p: Vec2, ring: readonly Vec2[]): boolean => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) {
      hit = !hit;
    }
  }
  return hit;
};

/** Spacing of the samples along a footprint's edges (metres). */
export const EDGE_STEP = 0.5;

/**
 * The highest ground under a plan polygon (a body's footprint): the max over its
 * corners, every `EDGE_STEP` along its edges and the vertices inside it, within a few
 * millimetres of the exact max of the piecewise-linear ground. Null when it is all off
 * the patch.
 */
export const groundUnder = (
  grid: TerrainGrid,
  frame: SiteFrame,
  polygon: readonly Vec2[]
): number | null => {
  const ring = polygon.map((p) => planToWorld(frame, p));
  let best = -Infinity;
  const sample = (x: number, z: number) => {
    const h = groundAtWorld(grid, x, z);
    if (h !== null && h > best) best = h;
  };
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / EDGE_STEP));
    for (let s = 0; s < steps; s++) {
      sample(a.x + ((b.x - a.x) * s) / steps, a.z + ((b.z - a.z) * s) / steps);
    }
  });
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  for (let x = Math.ceil(Math.min(...xs)); x <= Math.max(...xs); x++) {
    for (let z = Math.ceil(Math.min(...zs)); z <= Math.max(...zs); z++) {
      if (inside({ x, z }, ring)) sample(x, z);
    }
  }
  return best === -Infinity ? null : best;
};

/**
 * The ground's lowest and highest plan height over a plan rectangle (its corners and the
 * vertices inside it); null when it is all off the patch.
 */
export const groundRange = (
  grid: TerrainGrid,
  frame: SiteFrame,
  rect: { min: Vec2; max: Vec2 }
): { min: number; max: number } | null => {
  const { min, max } = rect;
  const corners = [min, { x: max.x, z: min.z }, max, { x: min.x, z: max.z }];
  const ring = corners.map((p) => planToWorld(frame, p));
  let low = Infinity;
  let high = -Infinity;
  const add = (h: number | null) => {
    if (h === null) return;
    low = Math.min(low, h);
    high = Math.max(high, h);
  };
  ring.forEach((w) => add(groundAtWorld(grid, w.x, w.z)));
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const x0 = Math.max(grid.x0, Math.ceil(Math.min(...xs)));
  const x1 = Math.min(grid.x0 + grid.cols - 1, Math.max(...xs));
  const z0 = Math.max(grid.z0, Math.ceil(Math.min(...zs)));
  const z1 = Math.min(grid.z0 + grid.rows - 1, Math.max(...zs));
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (inside({ x, z }, ring)) add(grid.heights[(z - grid.z0) * grid.cols + x - grid.x0]!);
    }
  }
  return low === Infinity ? null : { min: low, max: high };
};
