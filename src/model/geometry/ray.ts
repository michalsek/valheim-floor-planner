/** Rays in 3D and their hits on boxes turned about +y (the 3D view's picking). Pure. */
import type { Vec3 } from '../types';

export interface Ray3 {
  origin: Vec3;
  /** Unit length. */
  dir: Vec3;
}

/** A box turned about +y, as `PieceBox` stores it. */
export interface TurnedBox {
  center: Vec3;
  size: Vec3;
  /** Radians, three.js sense (counter-clockwise seen from above). */
  rotationY: number;
}

export const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scaleVec3 = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const dotVec3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const normalizeVec3 = (v: Vec3): Vec3 => scaleVec3(v, 1 / Math.hypot(v.x, v.y, v.z));

export const pointOnRay = (r: Ray3, t: number): Vec3 => addVec3(r.origin, scaleVec3(r.dir, t));

/** `v` in the frame of a box turned by `rotationY` (the inverse turn). */
const unturn = (v: Vec3, rotationY: number): Vec3 => {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return { x: c * v.x - s * v.z, y: v.y, z: s * v.x + c * v.z };
};

/**
 * Where the ray enters the box (distance along it), or null when it misses. A ray that
 * starts inside a box doesn't hit it: front faces only are drawn, so the camera sees
 * out of it. Slab test in the box's own frame.
 */
export const rayBox = (r: Ray3, box: TurnedBox): number | null => {
  const origin = unturn(subVec3(r.origin, box.center), box.rotationY);
  const dir = unturn(r.dir, box.rotationY);
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

/** The nearest box the ray enters, and how far along the ray; null when it misses all. */
export const pickBoxes = <B extends TurnedBox>(
  r: Ray3,
  boxes: readonly B[]
): { box: B; t: number } | null => {
  let best: { box: B; t: number } | null = null;
  for (const box of boxes) {
    const t = rayBox(r, box);
    if (t !== null && (!best || t < best.t)) best = { box, t };
  }
  return best;
};
