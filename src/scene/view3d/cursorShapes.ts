/** The 3D cursor's marks on the plane it lies on, as polylines (metres). Pure. */
import type { Polyline } from '../../model/geometry/box';
import type { Vec2 } from '../../model/types';

/** Arm length and centre ring radius, in screen px at the cursor (as in 2D). */
export const ARM_PX = 10;
export const RING_PX = 3;
const RING_SEGMENTS = 12;

/** A small ring of radius `r` about `p`. */
export const ringAt = (p: Vec2, r: number): Polyline => ({
  points: Array.from({ length: RING_SEGMENTS }, (_, i) => {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    return { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
  }),
  closed: true,
});

/** The snap cursor: a cross with arms `arm` long and a ring of radius `ring` about `p`. */
export const crossAt = (p: Vec2, arm: number, ring: number): Polyline[] => [
  {
    points: [
      { x: p.x - arm, z: p.z },
      { x: p.x + arm, z: p.z },
    ],
    closed: false,
  },
  {
    points: [
      { x: p.x, z: p.z - arm },
      { x: p.x, z: p.z + arm },
    ],
    closed: false,
  },
  ringAt(p, ring),
];
