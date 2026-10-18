/** Rays in 3D and their hits on pieces' boxes and shapes (the 3D view's picking). Pure. */
import type { Vec3 } from '../types';

import { boxAxes, toLocal, toLocalDir, type OrientedBox } from './orient';
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

/** A hit on a piece: how far along the ray, and the surface's unit normal there (facing the ray). */
export interface RayHit {
  t: number;
  normal: Vec3;
}

const AXES = ['x', 'y', 'z'] as const;

/**
 * Where the ray enters the box, and the entry face's world normal; null when it misses.
 * A ray that starts inside a box doesn't hit it: front faces only are drawn, so the
 * camera sees out of it. Slab test in the box's own frame.
 */
export const rayBoxHit = (r: Ray3, box: TurnedBox): RayHit | null => {
  const origin = toLocal(r.origin, box);
  const dir = toLocalDir(r.dir, box);
  let near = -Infinity;
  let far = Infinity;
  let face = { axis: 0, sign: 1 };
  for (const [i, axis] of AXES.entries()) {
    const half = box.size[axis] / 2;
    if (Math.abs(dir[axis]) < 1e-12) {
      if (Math.abs(origin[axis]) > half) return null;
      continue;
    }
    const t1 = (-half - origin[axis]) / dir[axis];
    const t2 = (half - origin[axis]) / dir[axis];
    if (Math.min(t1, t2) > near) {
      near = Math.min(t1, t2);
      face = { axis: i, sign: dir[axis] > 0 ? -1 : 1 };
    }
    far = Math.min(far, Math.max(t1, t2));
  }
  if (!(near <= far && near >= 0)) return null;
  return { t: near, normal: scaleVec3(boxAxes(box)[face.axis]!, face.sign) };
};

/** Where the ray enters the box (distance along it), or null (see `rayBoxHit`). */
export const rayBox = (r: Ray3, box: TurnedBox): number | null => rayBoxHit(r, box)?.t ?? null;

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
 * Where the ray first meets a shaped box's triangles, and that triangle's world normal
 * (facing the ray); null on a miss. Tested in the unit box (an affine map keeps
 * distances along the ray); normals go back by the inverse transpose of the scale.
 */
export const rayShapeHit = (r: Ray3, box: TurnedBox): RayHit | null => {
  const { size } = box;
  const scale = (v: Vec3): Vec3 => ({ x: v.x / size.x, y: v.y / size.y, z: v.z / size.z });
  const origin = scale(toLocal(r.origin, box));
  const dir = scale(toLocalDir(r.dir, box));
  const tris = SHAPE_TRIANGLES[box.shape ?? 'box'];
  let best: { t: number; at: number } | null = null;
  for (let at = 0; at < tris.length; at += 9) {
    const t = rayTriangle(origin, dir, tris, at);
    if (t !== null && (best === null || t < best.t)) best = { t, at };
  }
  if (best === null) return null;
  const vertex = (k: number): Vec3 => ({
    x: tris[best.at + 3 * k]!,
    y: tris[best.at + 3 * k + 1]!,
    z: tris[best.at + 3 * k + 2]!,
  });
  const a = vertex(0);
  const unit = crossVec3(subVec3(vertex(1), a), subVec3(vertex(2), a));
  const [ax, ay, az] = boxAxes(box);
  const n = scale(unit);
  const world = normalizeVec3(
    addVec3(addVec3(scaleVec3(ax, n.x), scaleVec3(ay, n.y)), scaleVec3(az, n.z))
  );
  return { t: best.t, normal: dotVec3(world, r.dir) > 0 ? scaleVec3(world, -1) : world };
};

/** The ray against what the box holds (the box itself, or its shape), with the normal. */
export const rayPieceHit = (r: Ray3, box: TurnedBox): RayHit | null =>
  (box.shape ?? 'box') === 'box' ? rayBoxHit(r, box) : rayShapeHit(r, box);

/** The ray against what the box holds: the box itself, or its shape. */
export const rayPiece = (r: Ray3, box: TurnedBox): number | null => rayPieceHit(r, box)?.t ?? null;

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
