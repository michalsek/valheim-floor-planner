/** Axis-aligned world boxes: box selection, plan bounds and the 3D cut outline. */
import type { Vec2 } from '../types';

import { segments } from './polyline';

export interface WorldBox {
  min: Vec2;
  max: Vec2;
}

/** 'contain' selects what lies wholly inside the box; 'touch', what the box touches. */
export type BoxMode = 'contain' | 'touch';

/** A drawn line: a dimension line, an outline. */
export interface Polyline {
  points: readonly Vec2[];
  closed: boolean;
}

export const boxFromCorners = (a: Vec2, b: Vec2): WorldBox => ({
  min: { x: Math.min(a.x, b.x), z: Math.min(a.z, b.z) },
  max: { x: Math.max(a.x, b.x), z: Math.max(a.z, b.z) },
});

/** Width (x) and depth (z). */
export const boxSize = (box: WorldBox): Vec2 => ({
  x: box.max.x - box.min.x,
  z: box.max.z - box.min.z,
});

/** The box's outline, clockwise on screen from `min`. */
export const boxOutline = (box: WorldBox): Polyline => ({
  points: [box.min, { x: box.max.x, z: box.min.z }, box.max, { x: box.min.x, z: box.max.z }],
  closed: true,
});

export const pointInBox = (p: Vec2, box: WorldBox): boolean =>
  p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;

/** Exact for axis-aligned segments; a bounding test otherwise. */
const segmentTouchesBox = (a: Vec2, b: Vec2, box: WorldBox): boolean =>
  Math.max(a.x, b.x) >= box.min.x &&
  Math.min(a.x, b.x) <= box.max.x &&
  Math.max(a.z, b.z) >= box.min.z &&
  Math.min(a.z, b.z) <= box.max.z;

/**
 * Whether a line lies wholly inside the box ('contain') or touches it ('touch'). A
 * single point is a line too: it touches when it is inside.
 */
export const lineInBox = ({ points, closed }: Polyline, box: WorldBox, mode: BoxMode): boolean =>
  mode === 'contain'
    ? points.every((p) => pointInBox(p, box))
    : points.some((p) => pointInBox(p, box)) ||
      segments(points, closed).some((s) => segmentTouchesBox(s.a, s.b, box));
