/**
 * Pure hit test for pinned dimensions (no tool or React imports, so it can move to
 * `model/geometry/hitTest.ts` with M4's selection).
 */
import { dimensionLine } from '../../model/geometry/dimension';
import { distanceToSegment } from '../../model/geometry/measure';
import type { Dimension, DimId, Vec2 } from '../../model/types';

/** The dimension whose drawn line is nearest to `p`, within `tol` metres. */
export const hitDimension = (
  dims: Record<DimId, Dimension>,
  p: Vec2,
  tol: number
): DimId | null => {
  let best: { id: DimId; distance: number } | null = null;
  for (const dim of Object.values(dims)) {
    const line = dimensionLine(dim);
    const distance = distanceToSegment(p, line.a, line.b);
    if (distance <= tol && (!best || distance < best.distance)) best = { id: dim.id, distance };
  }
  return best?.id ?? null;
};
