/**
 * Splits a wall run into game pieces. Panel walls are centred on the drawn line;
 * block walls put a face on it and fill a strip of their thickness on `run.side`.
 */
import { minPieceHeight, type WallFamily } from '../catalog/wallFamilies';

import { fillFace } from './fillFace';
import { cross, EPS, normalizeRun, segments, sideNormal, type Segment } from './geometry/polyline';
import type { PlacedPiece, WallRun, WallSide } from './types';

export type SplitIssue =
  /** Face area (m²) that whole pieces can't fill. */
  | { kind: 'unfilled'; segment: number; area: number }
  /** A block segment no longer than the wall is thick: the corners use it all up. */
  | { kind: 'tooShort'; segment: number };

export interface SplitResult {
  pieces: PlacedPiece[];
  issues: SplitIssue[];
}

export const splitWall = (run: WallRun, family: WallFamily): SplitResult => {
  const points = normalizeRun(run.points, run.closed);
  const closed = run.closed && points.length > 2;
  const segs = segments(points, closed);
  const courseHeight = minPieceHeight(family);
  const isBlock = family.snapKind === 'face';
  const t = family.thickness;

  const pieces: PlacedPiece[] = [];
  const issues: SplitIssue[] = [];

  segs.forEach((seg, index) => {
    const { start, end } = isBlock ? blockSpan(segs, seg, index, closed, run.side, t) : NO_ADJUST;
    const length = seg.length + end - start;
    if (length < EPS) {
      issues.push({ kind: 'tooShort', segment: index });
      return;
    }
    const fill = fillFace(family.pieces, length, run.height);
    const normal = sideNormal(seg.dir, run.side);
    const across = isBlock ? t / 2 : 0;
    const rotation = Math.atan2(seg.dir.z, seg.dir.x);
    const perCourse = new Map<number, number>();

    for (const { piece, offset, base } of fill.placed) {
      const along = start + offset + piece.length / 2;
      const course = Math.round(base / courseHeight);
      const n = perCourse.get(course) ?? 0;
      perCourse.set(course, n + 1);
      pieces.push({
        key: `${run.id}:${index}:${course}:${n}`,
        prefab: piece.prefab,
        material: family.material,
        sourceId: run.id,
        segment: index,
        course,
        base,
        height: piece.height,
        center: {
          x: seg.a.x + seg.dir.x * along + normal.x * across,
          z: seg.a.z + seg.dir.z * along + normal.z * across,
        },
        rotation,
        footprint: { length: piece.length, thickness: piece.thickness },
      });
    }

    const area = fill.unfilled.reduce((sum, r) => sum + r.length * r.height, 0);
    if (area > EPS) issues.push({ kind: 'unfilled', segment: index, area });
  });

  return { pieces, issues };
};

const NO_ADJUST = { start: 0, end: 0 };

/**
 * Block-wall span adjustments at the segment's two corners. The incoming segment (in
 * drawing order) owns the corner column. Where the strips overlap (the turn is towards
 * the strip side) the outgoing one starts `t` later; where they leave a gap, the
 * incoming one runs on by `t`.
 */
const blockSpan = (
  segs: readonly Segment[],
  seg: Segment,
  index: number,
  closed: boolean,
  side: WallSide,
  t: number
): { start: number; end: number } => {
  const n = segs.length;
  const prev = n > 1 && (closed || index > 0) ? segs[(index - 1 + n) % n] : undefined;
  const next = n > 1 && (closed || index < n - 1) ? segs[(index + 1) % n] : undefined;

  /** True when the strips overlap at the corner, false for a gap, null when straight. */
  const overlaps = (dIn: Segment, dOut: Segment): boolean | null => {
    const turn = cross(dIn.dir, dOut.dir);
    if (Math.abs(turn) < EPS) return null;
    return turn > 0 === (side === 'right');
  };

  const startOverlap = prev ? overlaps(prev, seg) : null;
  const endOverlap = next ? overlaps(seg, next) : null;
  return { start: startOverlap === true ? t : 0, end: endOverlap === false ? t : 0 };
};
