/**
 * The shapes the support check works with. Contacts, support points and the ground
 * test only go through `SupportShape` (its bounds, centre of mass, closest point and
 * overlap test), so M12's roof wedges and tilted pieces can bring their own shape: a
 * wedge touches a wall's top edge, and that edge is its support point. `boxShape` is the
 * one for `PieceBox`es, which only ever turn about y.
 */
import type { PieceBox } from '../pieceBoxes';
import type { Vec3 } from '../types';

/** An axis-aligned box. */
export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export interface SupportShape {
  /** The axis-aligned box around the shape (the broad phase and the ground test). */
  aabb: Aabb;
  /** Its centre of mass. */
  com: Vec3;
  /** The point of the shape closest to `p` (`p` itself when inside). */
  closestPoint(p: Vec3): Vec3;
  /**
   * Whether the shapes are in contact: within `eps` of each other (each grown by it),
   * over a face of at least `minFace` in both directions across the contact (an edge
   * or a corner alone doesn't hold anything up).
   */
  touches(other: SupportShape, eps: number, minFace: number): boolean;
}

type PlanDir = { x: number; z: number };

/** A box turned about +y (three.js sense, as `PieceBox.rotationY`), with its plan axes. */
interface Obb {
  center: Vec3;
  /** Half the box's size along its own axes. */
  half: Vec3;
  /** Its own x and z axes on the plan. */
  u: PlanDir;
  v: PlanDir;
}

/** Half the box's extent along a plan direction `d` (unit). */
const radiusAlong = ({ half, u, v }: Obb, d: PlanDir): number =>
  half.x * Math.abs(u.x * d.x + u.z * d.z) + half.z * Math.abs(v.x * d.x + v.z * d.z);

/** How far the boxes' extents overlap along a plan direction (negative: a gap). */
const overlapAlong = (a: Obb, b: Obb, d: PlanDir): number => {
  const distance = Math.abs((b.center.x - a.center.x) * d.x + (b.center.z - a.center.z) * d.z);
  return radiusAlong(a, d) + radiusAlong(b, d) - distance;
};

/** Whether two boxes' plan axes are the same lines (turned by a multiple of 90°). */
const aligned = (a: Obb, b: Obb): boolean =>
  Math.abs(a.u.x * b.u.z - a.u.z * b.u.x) < 1e-9 || Math.abs(a.u.x * b.u.x + a.u.z * b.u.z) < 1e-9;

/**
 * Separating axes on the plan (each box's two axes) with each box grown by `eps`, then
 * the overlap across the contact: of the y overlap and the plan's two (along the
 * tightest axis and across it), the smallest is the contact's normal and the other two
 * must reach `minFace`.
 */
const obbsTouch = (a: Obb, b: Obb, eps: number, minFace: number): boolean => {
  const oy = a.half.y + b.half.y - Math.abs(a.center.y - b.center.y);
  if (oy < -2 * eps) return false;
  const axes = aligned(a, b) ? [a.u, a.v] : [a.u, a.v, b.u, b.v];
  let normal = a.u;
  let tightest = Infinity;
  for (const axis of axes) {
    const overlap = overlapAlong(a, b, axis);
    if (overlap < -2 * eps) return false;
    if (overlap < tightest) {
      tightest = overlap;
      normal = axis;
    }
  }
  const across = overlapAlong(a, b, { x: -normal.z, z: normal.x });
  // The two largest of the three reach `minFace` when at least two of them do.
  return Number(oy >= minFace) + Number(tightest >= minFace) + Number(across >= minFace) >= 2;
};

const clamp = (n: number, h: number): number => Math.min(h, Math.max(-h, n));

const obbClosestPoint = (box: Obb, p: Vec3): Vec3 => {
  const { u, v } = box;
  const d = { x: p.x - box.center.x, z: p.z - box.center.z };
  const lu = clamp(d.x * u.x + d.z * u.z, box.half.x);
  const lv = clamp(d.x * v.x + d.z * v.z, box.half.z);
  return {
    x: box.center.x + u.x * lu + v.x * lv,
    y: box.center.y + clamp(p.y - box.center.y, box.half.y),
    z: box.center.z + u.z * lu + v.z * lv,
  };
};

const obbAabb = (box: Obb): Aabb => {
  const r = { x: radiusAlong(box, { x: 1, z: 0 }), z: radiusAlong(box, { x: 0, z: 1 }) };
  const { center: c, half } = box;
  return {
    min: { x: c.x - r.x, y: c.y - half.y, z: c.z - r.z },
    max: { x: c.x + r.x, y: c.y + half.y, z: c.z + r.z },
  };
};

const boxes = new WeakMap<SupportShape, Obb>();

/** A piece's or prop's box as a support shape; its centre is its centre of mass. */
export const boxShape = (box: Pick<PieceBox, 'center' | 'size' | 'rotationY'>): SupportShape => {
  const c = Math.cos(box.rotationY);
  const s = Math.sin(box.rotationY);
  const obb: Obb = {
    center: box.center,
    half: { x: box.size.x / 2, y: box.size.y / 2, z: box.size.z / 2 },
    u: { x: c, z: -s },
    v: { x: s, z: c },
  };
  const shape: SupportShape = {
    aabb: obbAabb(obb),
    com: box.center,
    closestPoint: (p) => obbClosestPoint(obb, p),
    // Another kind of shape knows how it touches a box.
    touches: (other, eps, minFace) => {
      const theirs = boxes.get(other);
      return theirs ? obbsTouch(obb, theirs, eps, minFace) : other.touches(shape, eps, minFace);
    },
  };
  boxes.set(shape, obb);
  return shape;
};
