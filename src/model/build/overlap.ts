/**
 * How deep a ghost goes into the pieces around it (M17 §5): the separating-axis
 * penetration depth of two oriented boxes. Only deep overlaps are flagged (advisory):
 * real builds clip a lot (poles through log walls), and the game tests clipping only
 * for a few pieces. Shapes count as their whole box. Pure.
 */
import { crossVec3, dotVec3, normalizeVec3 } from '../geometry/ray';
import { boxAxes, boxCorners, type OrientedBox } from '../geometry/orient';
import type { PieceBox } from '../pieceBoxes';
import type { Vec3 } from '../types';

/** An overlap this deep or more is flagged (metres; planner). */
export const DEEP_OVERLAP = 0.5;

const solid = (box: OrientedBox): OrientedBox => ({ ...box, shape: 'box' });

/** The two boxes' overlap along an axis (≤ 0 when they are apart along it). */
const overlapAlong = (axis: Vec3, a: readonly Vec3[], b: readonly Vec3[]): number => {
  const range = (corners: readonly Vec3[]) => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of corners) {
      const d = dotVec3(c, axis);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    return { min, max };
  };
  const ra = range(a);
  const rb = range(b);
  return Math.min(ra.max, rb.max) - Math.max(ra.min, rb.min);
};

/**
 * How far one box goes into the other: the smallest overlap over the 15 separating
 * axes (each box's 3 face normals and the 9 edge crosses); 0 when they are apart or
 * only touch.
 */
export const penetration = (a: OrientedBox, b: OrientedBox): number => {
  const ca = boxCorners(solid(a));
  const cb = boxCorners(solid(b));
  const fa = boxAxes(a);
  const fb = boxAxes(b);
  const crosses = fa.flatMap((u) =>
    fb.map((v) => crossVec3(u, v)).filter((c) => Math.hypot(c.x, c.y, c.z) > 1e-6)
  );
  let depth = Infinity;
  for (const axis of [...fa, ...fb, ...crosses.map(normalizeVec3)]) {
    const d = overlapAlong(axis, ca, cb);
    if (d <= 0) return 0;
    depth = Math.min(depth, d);
  }
  return depth;
};

export interface DeepOverlap {
  /** Index of the ghost box. */
  ghost: number;
  box: PieceBox;
  depth: number;
}

/** Every pair of a ghost box and a nearby box overlapping by `DEEP_OVERLAP` or more. */
export const deepOverlaps = (
  ghosts: readonly OrientedBox[],
  near: readonly PieceBox[],
  limit = DEEP_OVERLAP
): DeepOverlap[] =>
  ghosts.flatMap((g, ghost) =>
    near.flatMap((box) => {
      const depth = penetration(g, box);
      return depth >= limit ? [{ ghost, box, depth }] : [];
    })
  );
