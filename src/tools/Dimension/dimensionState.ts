import { atom } from 'jotai';

import { offsetThrough } from '../../model/geometry/dimension';
import { samePoint } from '../../model/geometry/polyline';
import type { Vec2 } from '../../model/types';

/**
 * The dimension being drawn (session state, never in history), at height `y`: the
 * surface under A (absolute).
 */
type DimensionDraft =
  | { phase: 'idle' }
  | { phase: 'b'; a: Vec2; y: number }
  | { phase: 'offset'; a: Vec2; b: Vec2; y: number };

export const DIMENSION_IDLE: DimensionDraft = { phase: 'idle' };

export const dimensionDraftAtom = atom<DimensionDraft>(DIMENSION_IDLE);

/**
 * The dimension being drawn: B on the cursor (null until it moves off A), then the
 * offset through it; null when idle. Shared by both views.
 */
export const draftLine = (
  draft: DimensionDraft,
  cursor: Vec2 | undefined
): { a: Vec2; b: Vec2 | null; offset: number } | null => {
  if (draft.phase === 'idle') return null;
  if (draft.phase === 'b') {
    const b = cursor && !samePoint(draft.a, cursor) ? cursor : null;
    return { a: draft.a, b, offset: 0 };
  }
  const offset = cursor ? offsetThrough(draft.a, draft.b, cursor) : 0;
  return { a: draft.a, b: draft.b, offset };
};
