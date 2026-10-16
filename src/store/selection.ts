/**
 * Selection session state: what is selected and hovered, and the edit being dragged.
 * None of it enters undo history; `startSelectionSync` keeps it pointing at objects
 * that exist after every plan change (undo included).
 */
import { atom } from 'jotai';

import { hitItem, type Hit } from '../model/hitTest';
import { itemExists, normalizeSelection, type Selection } from '../model/selection';

import type { PlanCommand } from '../model/commands';
import type { PlanStore } from './planStore';
import type { SessionAccess } from './session';

export const selectionAtom = atom<Selection>([]);

/** What the pointer is over, as the active tool sees it (shared by every tool). */
export const hoverAtom = atom<Hit | null>(null);

/**
 * The commands of a move or corner drag in progress. The canvas draws the plan with
 * them applied; pointer-up commits the same commands as one history entry.
 */
export const editPreviewAtom = atom<readonly PlanCommand[] | null>(null);

/**
 * Prunes the selection and hover after each plan change; loading a plan clears them.
 * Start it before the first render, so React never reads a stale id.
 */
export const startSelectionSync = (plan: PlanStore, session: SessionAccess): (() => void) =>
  plan.subscribe(({ plan: next, source }) => {
    const selection = session.get(selectionAtom);
    const pruned = source === 'load' ? [] : normalizeSelection(next, selection);
    if (pruned !== selection) session.set(selectionAtom, pruned);
    // A vertex index may now point at another corner.
    const hover = session.get(hoverAtom);
    const stale = source === 'load' || hover?.kind === 'vertex';
    if (hover && (stale || !itemExists(next, hitItem(hover)))) {
      session.set(hoverAtom, null);
    }
  });
