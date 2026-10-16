/** Axis-aligned world boxes: box selection, and floor rectangles (a `Floor` is one). */
import type { Vec2 } from '../types';

import { runSegments } from './polyline';

export interface WorldBox {
  min: Vec2;
  max: Vec2;
}

/** 'contain' selects what lies wholly inside the box; 'touch', what the box touches. */
export type BoxMode = 'contain' | 'touch';

/** A drawn line: a wall run, a dimension line, an outline. */
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

export const boxArea = (box: WorldBox): number => {
  const { x, z } = boxSize(box);
  return x * z;
};

/** The overlap of two boxes, or null when they don't overlap (touching edges don't). */
export const boxIntersection = (a: WorldBox, b: WorldBox): WorldBox | null => {
  const min = { x: Math.max(a.min.x, b.min.x), z: Math.max(a.min.z, b.min.z) };
  const max = { x: Math.min(a.max.x, b.max.x), z: Math.min(a.max.z, b.max.z) };
  return max.x > min.x && max.z > min.z ? { min, max } : null;
};

/** The box's outline, clockwise on screen from `min`. */
export const boxOutline = (box: WorldBox): Polyline => ({
  points: [box.min, { x: box.max.x, z: box.min.z }, box.max, { x: box.min.x, z: box.max.z }],
  closed: true,
});

export const pointInBox = (p: Vec2, box: WorldBox): boolean =>
  p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;

/** Exact for axis-aligned segments (the only kind walls have); a bounding test otherwise. */
const segmentTouchesBox = (a: Vec2, b: Vec2, box: WorldBox): boolean =>
  Math.max(a.x, b.x) >= box.min.x &&
  Math.min(a.x, b.x) <= box.max.x &&
  Math.max(a.z, b.z) >= box.min.z &&
  Math.min(a.z, b.z) <= box.max.z;

/**
 * Whether a line lies wholly inside the box ('contain') or touches it ('touch'). A
 * single point (an opening's anchor) is a line too: it touches when it is inside.
 */
export const lineInBox = ({ points, closed }: Polyline, box: WorldBox, mode: BoxMode): boolean =>
  mode === 'contain'
    ? points.every((p) => pointInBox(p, box))
    : points.some((p) => pointInBox(p, box)) ||
      runSegments({ points: [...points], closed }).some((s) => segmentTouchesBox(s.a, s.b, box));
