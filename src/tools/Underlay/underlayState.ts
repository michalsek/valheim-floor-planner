import { atom } from 'jotai';

import type { Vec2 } from '../../model/types';

/** The Underlay tool's gesture (session state, never in history). */
export type UnderlayGesture =
  | { phase: 'idle' }
  /** Moving the image; previewed through `editPreviewAtom`, committed on release. */
  | { phase: 'dragging'; start: Vec2; origin0: Vec2 }
  /** Calibration: waiting for the first point, the second, then the distance between. */
  | { phase: 'calibA' }
  | { phase: 'calibB'; a: Vec2 }
  | { phase: 'calibDistance'; a: Vec2; b: Vec2 };

export const UNDERLAY_IDLE: UnderlayGesture = { phase: 'idle' };

export const underlayGestureAtom = atom<UnderlayGesture>(UNDERLAY_IDLE);

/** A one-line hint for the options bar ("Pick a different point"). */
export const underlayHintAtom = atom<string | null>(null);

/** Translate the calibrated underlay so point A lands on the nearest grid point. */
export const snapAnchorAtom = atom<boolean>(true);
