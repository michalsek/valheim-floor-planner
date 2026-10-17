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
  /** Prefabs whose models are settled (drawn, drawing nothing, or failed). */
  done: number;
  total: number;
  /** Prefabs waiting for the game folder to be reconnected. */
  blocked: number;
}

/** Model loading in the 3D view; null while boxes are drawn. */
export const modelLoadAtom = atom<ModelLoad | null>(null);

/** Bumped after the folder is reconnected, so blocked models are asked for again. */
export const modelRetryAtom = atom<number>(0);
