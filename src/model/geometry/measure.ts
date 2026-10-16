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

/** Shortest distance from `p` to the segment a–b. */
export const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const { dx, dz, length } = measure(a, b);
  const t = length === 0 ? 0 : ((p.x - a.x) * dx + (p.z - a.z) * dz) / (length * length);
  const k = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + dx * k), p.z - (a.z + dz * k));
};
