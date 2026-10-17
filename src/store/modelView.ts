/**
 * Whether the 3D view draws the real game models or plain boxes (persisted per
 * browser), and how loading the models goes, for the status strip.
 */
import { atom } from 'jotai';

import { getLocalStorage } from './browserStorage';

const REAL_LOOK_KEY = 'valheimFloorPlanner.realLook.v1';

const readRealLook = (): boolean => {
  try {
    return getLocalStorage()?.getItem(REAL_LOOK_KEY) === '1';
  } catch {
    return false;
  }
};

const writeRealLook = (on: boolean): void => {
  try {
    getLocalStorage()?.setItem(REAL_LOOK_KEY, on ? '1' : '0');
  } catch {
    // Blocked or full storage: the choice lasts for this session only.
  }
};

const realLookBaseAtom = atom<boolean>(readRealLook());

/** Draw the real models (true) or boxes (false) in 3D. */
export const realLookAtom = atom(
  (get) => get(realLookBaseAtom),
  (_get, set, on: boolean) => {
    set(realLookBaseAtom, on);
    writeRealLook(on);
  }
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
