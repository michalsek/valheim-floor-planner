/**
 * Selection session state: what is selected and hovered, and the edit being dragged.
 * None of it enters undo history; `startSelectionSync` keeps it pointing at objects
 * that exist after every plan change (undo included).
 */
import { atom } from 'jotai';

import { hitItem, type Hit } from '../model/hitTest';
import { cutShowing } from '../model/cut';
import { itemExists, normalizeSelection, type Selection } from '../model/selection';

import type { PlanCommand } from '../model/commands';
import type { Plan } from '../model/types';
import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { cutHeightAtom, cutStepAtom, type SessionAccess } from './session';

export const selectionAtom = atom<Selection>([]);

/** What the pointer is over, as the active tool sees it (shared by every tool). */
export const hoverAtom = atom<Hit | null>(null);

/**
 * The commands of a move in progress. The canvas draws the plan with them applied;
 * pointer-up commits the same commands as one history entry.
 */
export const editPreviewAtom = atom<readonly PlanCommand[] | null>(null);

/**
 * After an undo or redo leaves a selected item hidden by the cut (a raise undone), the
 * cut rises to show it; the hover goes, as with any cut change.
 */
const followSelection = (plan: Plan, session: SessionAccess): void => {
  const h = session.get(cutHeightAtom);
  const step = session.get(cutStepAtom);
  const next = cutShowing(h, plan, session.get(selectionAtom), step, getLibrary());
  if (next === h) return;
  session.set(cutHeightAtom, next);
  session.set(hoverAtom, null);
};

/**
 * Prunes the selection and hover after each plan change; loading a plan clears them.
 * Start it before the first render, so React never reads a stale id.
 */
export const startSelectionSync = (plan: PlanStore, session: SessionAccess): (() => void) =>
  plan.subscribe(({ plan: next, source }) => {
    const selection = session.get(selectionAtom);
    const pruned = source === 'load' ? [] : normalizeSelection(next, selection);
    if (pruned !== selection) session.set(selectionAtom, pruned);
    if (source === 'undo' || source === 'redo') followSelection(next, session);
    const hover = session.get(hoverAtom);
    if (hover && (source === 'load' || !itemExists(next, hitItem(hover)))) {
      session.set(hoverAtom, null);
    }
  });
