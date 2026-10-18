/**
 * Whether the 3D view draws the real game models or plain boxes (persisted per
 * browser), and how loading the models goes, for the status strip.
 */
import { atom } from 'jotai';

import { persistedAtom } from './browserStorage';

/** Draw the real models (true) or boxes (false) in 3D. */
export const realLookAtom = persistedAtom<boolean>(
  'valheimFloorPlanner.realLook.v1',
  false,
  (stored) => stored === '1',
  (on) => (on ? '1' : '0')
);

export interface ModelLoad {
  /** Prefabs whose models are settled (drawn, or drawing nothing). */
  done: number;
  total: number;
  /** Prefabs waiting for the game folder. */
  blocked: number;
  /** Prefabs whose models couldn't be read (drawn as boxes). */
  failed: number;
  /** Why the last of them failed. */
  failure: string | null;
}

/** Model loading in the 3D view; null while boxes are drawn. */
export const modelLoadAtom = atom<ModelLoad | null>(null);

/** The "models last for this visit only" notice was dismissed (once per visit). */
export const memoryNoticeDismissedAtom = atom<boolean>(false);
