/**
 * Dragging one corner of a wall run while keeping every segment orthogonal: the
 * segments on either side follow the corner across their axis, so a rectangle stays a
 * rectangle and an L stays an L.
 */
import { EPS, normalizeRun, orientClockwise, signedArea } from './geometry/polyline';
import { snapToGrid } from './geometry/snap';
import type { Vec2, WallRun } from './types';

type Axis = 'x' | 'z';

/** The coordinate a segment changes along; null for a diagonal (hand-edited) one. */
const segmentAxis = (a: Vec2, b: Vec2): Axis | null => {
  if (Math.abs(a.z - b.z) < EPS) return 'x';
  if (Math.abs(a.x - b.x) < EPS) return 'z';
  return null;
};

const across = (axis: Axis): Axis => (axis === 'x' ? 'z' : 'x');

/** `p` projected onto the line through `a` and `b`. */
const projectOnLine = (p: Vec2, a: Vec2, b: Vec2): Vec2 => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz);
  return { x: a.x + dx * t, z: a.z + dz * t };
};

/**
 * Moves vertex `i` to `t` and drags its neighbours along, without normalising, so
 * indices still match `points`. An open run's end slides along its only segment.
 * Otherwise each neighbour takes the corner's move across its segment's axis, and so
 * does each further vertex while the segments stay on that axis (a reversal or
 * spike); a perpendicular segment only changes length, so the walk stops there.
 */
export const moveVertexRaw = (
  points: readonly Vec2[],
  closed: boolean,
  i: number,
  t: Vec2
): Vec2[] => {
  const n = points.length;
  const p = points[i];
  if (!p) return [...points];
  const moved = [...points];

  if (!closed && (i === 0 || i === n - 1)) {
    const neighbour = points[i === 0 ? 1 : n - 2];
    if (neighbour) moved[i] = projectOnLine(t, neighbour, p);
    return moved;
  }

  moved[i] = t;
  const d: Vec2 = { x: t.x - p.x, z: t.z - p.z };
  const shifted = new Set([i]);
  for (const step of [-1, 1]) {
    const next = (j: number): number | null => {
      const k = j + step;
      if (closed) return (k + n) % n;
      return k >= 0 && k < n ? k : null;
    };
    let from = p;
    let axis: Axis | null = null;
    for (let j = next(i); j !== null && !shifted.has(j); j = next(j)) {
      const q = points[j];
      const segment = q && segmentAxis(from, q);
      if (!q || !segment || (axis !== null && segment !== axis)) break;
      axis = segment;
      const shiftAxis = across(axis);
      moved[j] = { ...q, [shiftAxis]: q[shiftAxis] + d[shiftAxis] };
      shifted.add(j);
      from = q;
    }
  }
  return moved;
};

/**
 * The run after dragging vertex `index` to `target`, normalised (a segment that
 * shrinks to nothing merges away), or null when the run would collapse: fewer than 2
 * points open, or fewer than 4 (or no area) closed. A loop that turns inside out is
 * re-oriented clockwise with the strip kept on the same physical side, so a block
 * wall's inside strip stays inside.
 */
export const dragVertex = (
  run: WallRun,
  index: number,
  target: Vec2
): Pick<WallRun, 'points' | 'side'> | null => {
  const points = normalizeRun(moveVertexRaw(run.points, run.closed, index, target), run.closed);
  if (!run.closed) return points.length >= 2 ? { points, side: run.side } : null;
  const area = signedArea(points);
  if (points.length < 4 || Math.abs(area) < EPS) return null;
  const inverted = area * signedArea(run.points) < 0;
  const side = inverted ? (run.side === 'right' ? 'left' : 'right') : run.side;
  const result = orientClockwise({ points, side });
  return { points: result.points, side: result.side };
};

/** Sampling step (metres) for `clampVertexTarget` while snapping is off. */
const FREE_STEP = 0.01;
const MAX_SAMPLES = 2000;

/**
 * The target `dragVertex` accepts nearest to `to`, going back towards `from` (one it
 * accepts) in steps of the snap step (`null`: snapping off). A refused drag then stops
 * just short of the collapse, however sparse the pointer samples were.
 */
export const clampVertexTarget = (
  run: WallRun,
  index: number,
  from: Vec2,
  to: Vec2,
  step: number | null
): Vec2 => {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const n = Math.min(Math.ceil(length / (step ?? FREE_STEP)), MAX_SAMPLES);
  for (let k = n; k > 0; k--) {
    const along = { x: from.x + ((to.x - from.x) * k) / n, z: from.z + ((to.z - from.z) * k) / n };
    const target = step === null ? along : snapToGrid(along, step);
    if (dragVertex(run, index, target)) return target;
  }
  return from;
};
