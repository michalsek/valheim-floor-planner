/**
 * Splits a wall run into game pieces. Panel walls are centred on the drawn line;
 * block walls put a face on it and fill a strip of their thickness on `run.side`.
 */
import { minPieceHeight, stripOffset, type WallFamily } from '../catalog/wallFamilies';

import { fillFace, type FaceHole } from './fillFace';
import {
  addVec,
  cross,
  EPS,
  isLoop,
  pointAlong,
  runSegments,
  sideNormal,
  type Segment,
} from './geometry/polyline';
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

/**
 * An opening's gap: on `segment` (numbered as `runSegments` numbers them), `start`
 * metres from the segment's first point along the drawn line.
 */
export interface WallCut {
  segment: number;
  start: number;
  width: number;
  height: number;
}

export const splitWall = (
  run: WallRun,
  family: WallFamily,
  cuts: readonly WallCut[] = []
): SplitResult => {
  // The numbering cuts, hit tests and the Inspector use.
  const segs = runSegments(run);
  const closed = isLoop(run, segs);
  const courseHeight = minPieceHeight(family);
  const isBlock = family.snapKind === 'face';
  const t = family.thickness;

  const pieces: PlacedPiece[] = [];
  const issues: SplitIssue[] = [];

  segs.forEach((seg, index) => {
    const { start, end } = isBlock ? blockSpan(segs, index, closed, run.side, t) : NO_ADJUST;
    const length = seg.length + end - start;
    if (length < EPS) {
      issues.push({ kind: 'tooShort', segment: index });
      return;
    }
    const holes: FaceHole[] = cuts
      .filter((cut) => cut.segment === index)
      .map((cut) => ({ start: cut.start - start, width: cut.width, height: cut.height }));
    const fill = fillFace(family.pieces, length, run.height, holes);
    const normal = sideNormal(seg.dir, run.side);
    const across = stripOffset(family);
    const rotation = Math.atan2(seg.dir.z, seg.dir.x);
    const perCourse = new Map<number, number>();

    for (const { piece, offset, base } of fill.placed) {
      const along = start + offset + piece.length / 2;
      const course = Math.round(base / courseHeight);
      const n = perCourse.get(course) ?? 0;
      perCourse.set(course, n + 1);
      pieces.push({
        key: `${run.id}:${index}:${course}:${n}`,
        kind: 'wall',
        prefab: piece.prefab,
        material: family.material,
        sourceId: run.id,
        segment: index,
        course,
        base,
        height: piece.height,
        center: addVec(pointAlong(seg, along), { x: normal.x * across, z: normal.z * across }),
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

/** The segments before and after segment `index`, where the run has them. */
const neighbours = (
  segs: readonly Segment[],
  index: number,
  closed: boolean
): { prev: Segment | undefined; next: Segment | undefined } => {
  const n = segs.length;
  return {
    prev: n > 1 && (closed || index > 0) ? segs[(index - 1 + n) % n] : undefined,
    next: n > 1 && (closed || index < n - 1) ? segs[(index + 1) % n] : undefined,
  };
};

/**
 * What a block wall's strips do at a corner: 'overlap' where the turn is towards the
 * strip side, 'gap' where it is away from it; null for a straight join or a run end.
 */
export type CornerKind = 'overlap' | 'gap' | null;

const cornerKind = (dIn: Segment | undefined, dOut: Segment | undefined, side: WallSide) => {
  if (!dIn || !dOut) return null;
  const turn = cross(dIn.dir, dOut.dir);
  if (Math.abs(turn) < EPS) return null;
  return turn > 0 === (side === 'right') ? 'overlap' : 'gap';
};

/** The kind of corner at each end of segment `index`. */
export const segmentCorners = (
  segs: readonly Segment[],
  index: number,
  closed: boolean,
  side: WallSide
): { start: CornerKind; end: CornerKind } => {
  const seg = segs[index];
  const { prev, next } = neighbours(segs, index, closed);
  return { start: cornerKind(prev, seg, side), end: cornerKind(seg, next, side) };
};

/**
 * Block-wall span adjustments at the segment's two corners. The incoming segment (in
 * drawing order) owns the corner column. Where the strips overlap the outgoing one
 * starts `t` later; where they leave a gap, the incoming one runs on by `t`.
 */
const blockSpan = (
  segs: readonly Segment[],
  index: number,
  closed: boolean,
  side: WallSide,
  t: number
): { start: number; end: number } => {
  const corners = segmentCorners(segs, index, closed, side);
  return { start: corners.start === 'overlap' ? t : 0, end: corners.end === 'gap' ? t : 0 };
};
