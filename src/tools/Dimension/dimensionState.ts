import { atom } from 'jotai';

import type { DimId, Vec2 } from '../../model/types';

/** The dimension being drawn (session state, never in history). */
type DimensionDraft =
  { phase: 'idle' } | { phase: 'b'; a: Vec2 } | { phase: 'offset'; a: Vec2; b: Vec2 };

export const DIMENSION_IDLE: DimensionDraft = { phase: 'idle' };

export const dimensionDraftAtom = atom<DimensionDraft>(DIMENSION_IDLE);

/** The pinned dimension Delete or Alt+click would remove (the tool is idle and over it). */
export const dimensionHoverIdAtom = atom<DimId | null>(null);
