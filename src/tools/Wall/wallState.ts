import { atom } from 'jotai';

import { nearestWallHeight } from '../../catalog/wallFamilies';
import { getLibrary } from '../../store/libraryInstance';
import {
  wallFamilyIdAtom,
  wallHeightAtom,
  wallSideAtom,
  type SessionAccess,
} from '../../store/session';

import type { DraftPoints, WallSettings } from './wallDraft';

export interface WallDraft {
  /** The clicked vertices. */
  points: DraftPoints;
  /**
   * Started by the click right after a loop was closed. If that click was the second
   * half of a double-click, the double-click must not cancel this new draft.
   */
  afterClose: boolean;
}

/** The wall being drawn (session state, never in history). */
export const wallDraftAtom = atom<WallDraft | null>(null);

/** Small facts about the last input, for the double-click and undo-repeat guards. */
export interface WallInput {
  /** The last pointer-down closed a loop. */
  closedOnLastDown: boolean;
  /** A held Mod+Z emptied the draft; its repeats must not undo the plan. */
  undoHeld: boolean;
}

export const wallInputAtom = atom<WallInput>({ closedOnLastDown: false, undoHeld: false });

export const wallSettingsAtom = atom<WallSettings>((get) => ({
  familyId: get(wallFamilyIdAtom),
  side: get(wallSideAtom),
  height: get(wallHeightAtom),
}));

/** Applies settings changes; a family change also snaps the height to one it can build. */
export const updateWallSettings = (ctx: SessionAccess, changes: Partial<WallSettings>): void => {
  if (changes.familyId !== undefined) {
    const family = getLibrary().wallFamilies.get(changes.familyId);
    if (!family) return;
    ctx.set(wallFamilyIdAtom, changes.familyId);
    ctx.set(wallHeightAtom, nearestWallHeight(family, changes.height ?? ctx.get(wallHeightAtom)));
  } else if (changes.height !== undefined) {
    ctx.set(wallHeightAtom, changes.height);
  }
  if (changes.side !== undefined) ctx.set(wallSideAtom, changes.side);
};

/** Flips a block wall's strip to the other side; returns false for panel families. */
export const flipWallSide = (ctx: SessionAccess): boolean => {
  if (getLibrary().wallFamilies.get(ctx.get(wallFamilyIdAtom))?.snapKind !== 'face') return false;
  ctx.set(wallSideAtom, (side) => (side === 'right' ? 'left' : 'right'));
  return true;
};
