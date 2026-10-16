import { atom } from 'jotai';

import type { Vec2 } from '../../model/types';

/** Transient ruler state. It lives in the session, never in the plan document. */
export type RulerState =
  { phase: 'idle' } | { phase: 'placing'; a: Vec2 } | { phase: 'done'; a: Vec2; b: Vec2 };

export const RULER_IDLE: RulerState = { phase: 'idle' };

/** Shorter measurements count as "no measurement yet". */
export const MIN_RULER_LENGTH = 1e-6;

export const rulerAtom = atom<RulerState>(RULER_IDLE);
