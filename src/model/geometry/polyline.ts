import type { PlacedPiece, Vec2, WallRun, WallSide } from '../types';

/** Tolerance for comparing lengths and coordinates in metres. */
export const EPS = 1e-6;

export interface Segment {
  a: Vec2;
  b: Vec2;
  /** Unit direction from `a` to `b`. */
  dir: Vec2;
  length: number;
}

export const samePoint = (p: Vec2, q: Vec2): boolean =>
  Math.abs(p.x - q.x) < EPS && Math.abs(p.z - q.z) < EPS;

/** z-component of the 2D cross product. On screen (+z down), positive is a right turn. */
export const cross = (u: Vec2, v: Vec2): number => u.x * v.z - u.z * v.x;

export const dot = (u: Vec2, v: Vec2): number => u.x * v.x + u.z * v.z;

/** Unit vector from `a` to `b`, or null when they coincide. */
export const direction = (a: Vec2, b: Vec2): Vec2 | null => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  return length < EPS ? null : { x: dx / length, z: dz / length };
};

/**
 * Removes repeated points and merges collinear, same-direction vertices (across the
 * start of a closed loop too), so 3 m + 3 m in a straight line becomes one 6 m segment.
 * A reversal (going back along the same line) is kept.
 */
export const normalizeRun = (points: readonly Vec2[], closed: boolean): Vec2[] => {
  const unique: Vec2[] = [];
  for (const p of points) {
    const last = unique[unique.length - 1];
    if (!last || !samePoint(last, p)) unique.push(p);
  }
  if (closed) {
    while (unique.length > 1 && samePoint(unique[0]!, unique[unique.length - 1]!)) unique.pop();
  }

  const isRedundant = (prev: Vec2, p: Vec2, next: Vec2): boolean => {
    const dIn = direction(prev, p);
    const dOut = direction(p, next);
    return !!dIn && !!dOut && Math.abs(cross(dIn, dOut)) < EPS && dot(dIn, dOut) > 0;
  };

  let result = unique;
  let changed = true;
  while (changed && result.length > 2) {
    changed = false;
    const n = result.length;
    for (let i = 0; i < n; i++) {
      const isEnd = !closed && (i === 0 || i === n - 1);
      if (isEnd) continue;
      const prev = result[(i - 1 + n) % n]!;
      const next = result[(i + 1) % n]!;
      if (isRedundant(prev, result[i]!, next)) {
        result = result.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return result;
};

/** Keeps `p` on an axis through `prev`: the dominant axis wins, a tie goes to x. */
export const constrainOrthogonal = (prev: Vec2, p: Vec2): Vec2 =>
  Math.abs(p.x - prev.x) >= Math.abs(p.z - prev.z) ? { x: p.x, z: prev.z } : { x: prev.x, z: p.z };

/** The run's segments in drawing order; a closed run has one back to the start. */
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

/**
 * A run's segments after normalisation: the numbering `splitWall` uses, so segment
 * indices from hit tests and the Inspector match the pieces'.
 */
export const runSegments = (run: Pick<WallRun, 'points' | 'closed'>): Segment[] => {
  const points = normalizeRun(run.points, run.closed);
  return segments(points, run.closed && points.length > 2);
};

/** Whether a run is a real loop (as `runSegments` treats it): closed, with 3+ segments. */
export const isLoop = (run: Pick<WallRun, 'closed'>, segs: readonly Segment[]): boolean =>
  run.closed && segs.length > 2;

/** The point `t` metres along a segment from its first point. */
export const pointAlong = (seg: Pick<Segment, 'a' | 'dir'>, t: number): Vec2 => ({
  x: seg.a.x + seg.dir.x * t,
  z: seg.a.z + seg.dir.z * t,
});

/** `p` moved by `d`. */
export const addVec = (p: Vec2, d: Vec2): Vec2 => ({ x: p.x + d.x, z: p.z + d.z });

/** Unit normal pointing to `side` of a segment heading along `dir` (as seen on screen). */
export const sideNormal = (dir: Vec2, side: WallSide): Vec2 =>
  side === 'right' ? { x: -dir.z, z: dir.x } : { x: dir.z, z: -dir.x };

/** The four corners of a piece's footprint on the plane, in order around it. */
export const footprintCorners = (
  piece: Pick<PlacedPiece, 'center' | 'rotation' | 'footprint'>
): Vec2[] => {
  const { center, rotation, footprint } = piece;
  const u = { x: Math.cos(rotation), z: Math.sin(rotation) };
  const v = { x: -u.z, z: u.x };
  const hl = footprint.length / 2;
  const ht = footprint.thickness / 2;
  const corners: readonly (readonly [number, number])[] = [
    [-hl, -ht],
    [hl, -ht],
    [hl, ht],
    [-hl, ht],
  ];
  return corners.map(([l, t]) => ({
    x: center.x + u.x * l + v.x * t,
    z: center.z + u.z * l + v.z * t,
  }));
};

/**
 * Shoelace area of a closed ring. Positive when the ring runs clockwise on screen
 * (+z is down), which is the orientation committed loops are stored in.
 */
export const signedArea = (points: readonly Vec2[]): number => {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    sum += p.x * q.z - q.x * p.z;
  });
  return sum / 2;
};

/**
 * Turns a closed loop clockwise on screen (keeping its first point), flipping `side`
 * when it reverses so a block strip stays on the same physical side. Afterwards
 * `'right'` is always inside.
 */
export const orientClockwise = <T extends { points: Vec2[]; side: WallSide }>(loop: T): T => {
  if (signedArea(loop.points) >= 0) return loop;
  const [first, ...rest] = loop.points;
  return {
    ...loop,
    points: first ? [first, ...rest.reverse()] : [],
    side: loop.side === 'right' ? 'left' : 'right',
  };
};
