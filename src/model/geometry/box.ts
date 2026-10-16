/** Axis-aligned world boxes, for box selection. */
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

const pointInBox = (p: Vec2, box: WorldBox): boolean =>
  p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;

/** Exact for axis-aligned segments (the only kind walls have); a bounding test otherwise. */
const segmentTouchesBox = (a: Vec2, b: Vec2, box: WorldBox): boolean =>
  Math.max(a.x, b.x) >= box.min.x &&
  Math.min(a.x, b.x) <= box.max.x &&
  Math.max(a.z, b.z) >= box.min.z &&
  Math.min(a.z, b.z) <= box.max.z;

/** Whether a line lies wholly inside the box ('contain') or touches it ('touch'). */
export const lineInBox = ({ points, closed }: Polyline, box: WorldBox, mode: BoxMode): boolean =>
  mode === 'contain'
    ? points.every((p) => pointInBox(p, box))
    : runSegments({ points: [...points], closed }).some((s) => segmentTouchesBox(s.a, s.b, box));
