/** Pure rules for the wall tool's draft: which click does what, and draft → run. */
import {
  constrainOrthogonal,
  direction,
  dot,
  EPS,
  normalizeRun,
  orientClockwise,
  samePoint,
} from '../../model/geometry/polyline';
import type { Vec2, WallId, WallRun } from '../../model/types';

export type DraftPoints = [Vec2, ...Vec2[]];

export type DraftAction = { kind: 'add'; p: Vec2 } | { kind: 'close' } | { kind: 'ignore' };

/**
 * What a click at `p` does to a draft with `points`. The point is kept orthogonal to
 * the last one; a zero-length segment or a reversal of the previous one is ignored;
 * landing on the start of a draft with at least 3 points closes the loop.
 */
export const nextDraftAction = (points: readonly Vec2[], p: Vec2): DraftAction => {
  const last = points[points.length - 1];
  if (!last) return { kind: 'add', p };
  const q = constrainOrthogonal(last, p);
  const dir = direction(last, q);
  if (!dir) return { kind: 'ignore' };

  const prev = points[points.length - 2];
  const prevDir = prev && direction(prev, last);
  if (prevDir && dot(prevDir, dir) < -1 + EPS) return { kind: 'ignore' };

  const [first] = points;
  if (points.length >= 3 && first && samePoint(q, first)) return { kind: 'close' };
  return { kind: 'add', p: q };
};

export type WallSettings = Pick<WallRun, 'familyId' | 'side' | 'height'>;

/**
 * The run a draft makes at `elevation`, or null when it is too short to be a wall.
 * Closed loops are stored clockwise on screen (the strip keeps its physical side), so
 * on a committed loop `side: 'right'` always means inside.
 */
export const draftToRun = (
  id: WallId,
  points: readonly Vec2[],
  closed: boolean,
  settings: WallSettings,
  elevation = 0
): WallRun | null => {
  const normalized = normalizeRun(points, closed);
  if (normalized.length < (closed ? 3 : 2)) return null;
  const run: WallRun = { id, points: normalized, closed, ...settings, elevation };
  return closed ? orientClockwise(run) : run;
};
