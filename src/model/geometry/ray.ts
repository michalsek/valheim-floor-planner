/** Rays in 3D and their hits on pieces' boxes and shapes (the 3D view's picking). Pure. */
import type { Vec3 } from '../types';

import { toLocal, toLocalDir, type OrientedBox } from './orient';
import { SHAPE_TRIANGLES } from './shapes';

export interface Ray3 {
  origin: Vec3;
  /** Unit length. */
  dir: Vec3;
}

/** A box turned about +y (and maybe tilted), as `PieceBox` stores it. */
export type TurnedBox = OrientedBox;

export const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scaleVec3 = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const dotVec3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const crossVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const normalizeVec3 = (v: Vec3): Vec3 => scaleVec3(v, 1 / Math.hypot(v.x, v.y, v.z));

export const pointOnRay = (r: Ray3, t: number): Vec3 => addVec3(r.origin, scaleVec3(r.dir, t));

/**
 * Where the ray enters the box (distance along it), or null when it misses. A ray that
 * starts inside a box doesn't hit it: front faces only are drawn, so the camera sees
 * out of it. Slab test in the box's own frame.
 */
export const rayBox = (r: Ray3, box: TurnedBox): number | null => {
  const origin = toLocal(r.origin, box);
  const dir = toLocalDir(r.dir, box);
  let near = -Infinity;
  let far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const half = box.size[axis] / 2;
    if (Math.abs(dir[axis]) < 1e-12) {
      if (Math.abs(origin[axis]) > half) return null;
      continue;
    }
    const t1 = (-half - origin[axis]) / dir[axis];
    const t2 = (half - origin[axis]) / dir[axis];
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
  }
  return near <= far && near >= 0 ? near : null;
};

/** Möller–Trumbore: the distance along the ray to a triangle, either side; null on a miss. */
const rayTriangle = (o: Vec3, d: Vec3, tri: Float32Array, at: number): number | null => {
  const a = { x: tri[at]!, y: tri[at + 1]!, z: tri[at + 2]! };
  const e1 = subVec3({ x: tri[at + 3]!, y: tri[at + 4]!, z: tri[at + 5]! }, a);
  const e2 = subVec3({ x: tri[at + 6]!, y: tri[at + 7]!, z: tri[at + 8]! }, a);
  const p = crossVec3(d, e2);
  const det = dotVec3(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const s = subVec3(o, a);
  const u = dotVec3(s, p) / det;
  if (u < 0 || u > 1) return null;
  const q = crossVec3(s, e1);
  const v = dotVec3(d, q) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dotVec3(e2, q) / det;
  return t >= 0 ? t : null;
};

/**
 * Where the ray first meets a shaped box's triangles, or null. Tested in the unit box
 * (an affine map keeps distances along the ray).
 */
export const rayShape = (r: Ray3, box: TurnedBox): number | null => {
  const { size } = box;
  const scale = (v: Vec3): Vec3 => ({ x: v.x / size.x, y: v.y / size.y, z: v.z / size.z });
  const origin = scale(toLocal(r.origin, box));
  const dir = scale(toLocalDir(r.dir, box));
  const tris = SHAPE_TRIANGLES[box.shape ?? 'box'];
  let best: number | null = null;
  for (let at = 0; at < tris.length; at += 9) {
    const t = rayTriangle(origin, dir, tris, at);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
};

/** The ray against what the box holds: the box itself, or its shape. */
export const rayPiece = (r: Ray3, box: TurnedBox): number | null =>
  (box.shape ?? 'box') === 'box' ? rayBox(r, box) : rayShape(r, box);

/** The nearest box the ray enters, and how far along the ray; null when it misses all. */
export const pickBoxes = <B extends TurnedBox>(
  r: Ray3,
  boxes: readonly B[]
): { box: B; t: number } | null => {
  let best: { box: B; t: number } | null = null;
  for (const box of boxes) {
    const t = rayPiece(r, box);
    if (t !== null && (!best || t < best.t)) best = { box, t };
  }
  return best;
};
