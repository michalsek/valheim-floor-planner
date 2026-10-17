/** Convex outlines on the plane: hulls, point and box tests, area. Pure. */
import type { Vec2 } from '../types';

import type { BoxMode, WorldBox } from './box';

const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** The convex hull (Andrew's monotone chain), without repeated points. */
export const convexHull = (points: readonly Vec2[]): Vec2[] => {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  if (sorted.length < 3) return sorted;
  const half = (list: readonly Vec2[]): Vec2[] => {
    const out: Vec2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2)!, out.at(-1)!, p) <= 1e-12) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
};

export const polygonArea = (points: readonly Vec2[]): number =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length]!;
      return sum + p.x * q.z - q.x * p.z;
    }, 0) / 2
  );

const edgeNormals = (hull: readonly Vec2[]): Vec2[] =>
  hull.map((p, i) => {
    const q = hull[(i + 1) % hull.length]!;
    const length = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    return { x: -(q.z - p.z) / length, z: (q.x - p.x) / length };
  });

const project = (points: readonly Vec2[], axis: Vec2): [number, number] => {
  const values = points.map((p) => p.x * axis.x + p.z * axis.z);
  return [Math.min(...values), Math.max(...values)];
};

/** Whether `p` is on the convex outline or within `tol` of it. */
export const pointInConvex = (p: Vec2, hull: readonly Vec2[], tol: number): boolean =>
  hull.length >= 3 &&
  edgeNormals(hull).every((axis) => {
    const [lo, hi] = project(hull, axis);
    const v = p.x * axis.x + p.z * axis.z;
    return v >= lo - tol && v <= hi + tol;
  });

/** Box selection of a convex outline: 'contain' wholly inside, 'touch' overlapping. */
export const convexBoxTest = (hull: readonly Vec2[], box: WorldBox, mode: BoxMode): boolean => {
  const inBox = (p: Vec2) =>
    p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;
  if (mode === 'contain') return hull.length > 0 && hull.every(inBox);
  const corners = [
    box.min,
    { x: box.max.x, z: box.min.z },
    box.max,
    { x: box.min.x, z: box.max.z },
  ];
  return [{ x: 1, z: 0 }, { x: 0, z: 1 }, ...edgeNormals(hull)].every((axis) => {
    const [p0, p1] = project(hull, axis);
    const [q0, q1] = project(corners, axis);
    return p1 >= q0 && q1 >= p0;
  });
};
