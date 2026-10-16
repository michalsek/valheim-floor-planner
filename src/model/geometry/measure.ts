import type { Vec2 } from '../types';

export interface Measurement {
  length: number;
  dx: number;
  dz: number;
}

/** Distance and per-axis deltas from `a` to `b`, in metres. */
export const measure = (a: Vec2, b: Vec2): Measurement => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return { length: Math.hypot(dx, dz), dx, dz };
};
