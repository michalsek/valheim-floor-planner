import { atom } from 'jotai';

import { samePoint } from '../../model/geometry/polyline';
import type { Vec2 } from '../../model/types';

/** Transient ruler state. It lives in the session, never in the plan document. */
export type RulerState =
  { phase: 'idle' } | { phase: 'placing'; a: Vec2 } | { phase: 'done'; a: Vec2; b: Vec2 };

export const RULER_IDLE: RulerState = { phase: 'idle' };

export const rulerAtom = atom<RulerState>(RULER_IDLE);

/**
 * What the ruler shows: the finished A→B, or B on the cursor while placing (null until
 * the cursor moves off A); null when idle. Shared by both views.
 */
export const measuredLine = (
  state: RulerState,
  cursor: Vec2 | undefined
): { a: Vec2; b: Vec2 | null } | null => {
  if (state.phase === 'idle') return null;
  if (state.phase === 'done') return { a: state.a, b: state.b };
  return { a: state.a, b: cursor && !samePoint(state.a, cursor) ? cursor : null };
};
