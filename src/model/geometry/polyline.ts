import type { Vec2 } from '../types';

/** Tolerance for comparing lengths and coordinates in metres. */
export const EPS = 1e-6;

interface Segment {
  a: Vec2;
  b: Vec2;
  /** Unit direction from `a` to `b`. */
  dir: Vec2;
  length: number;
}

export const samePoint = (p: Vec2, q: Vec2): boolean =>
  Math.abs(p.x - q.x) < EPS && Math.abs(p.z - q.z) < EPS;

export const dot = (u: Vec2, v: Vec2): number => u.x * v.x + u.z * v.z;

/** Unit vector from `a` to `b`, or null when they coincide. */
export const direction = (a: Vec2, b: Vec2): Vec2 | null => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  return length < EPS ? null : { x: dx / length, z: dz / length };
};

/** A polyline's segments in drawing order; a closed one has one back to the start. */
export const segments = (points: readonly Vec2[], closed: boolean): Segment[] => {
  const count = closed && points.length > 2 ? points.length : points.length - 1;
  const result: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    result.push({
      a,
      b,
      dir: length < EPS ? { x: 1, z: 0 } : { x: dx / length, z: dz / length },
      length,
    });
  }
  return result;
};

/** `p` moved by `d`. */
export const addVec = (p: Vec2, d: Vec2): Vec2 => ({ x: p.x + d.x, z: p.z + d.z });

/** Unit normal pointing to `side` of a segment heading along `dir` (as seen on screen). */
export const sideNormal = (dir: Vec2, side: 'left' | 'right'): Vec2 =>
  side === 'right' ? { x: -dir.z, z: dir.x } : { x: dir.z, z: -dir.x };
