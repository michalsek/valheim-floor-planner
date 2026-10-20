/**
 * Selection session state: what is selected and hovered, and the edit being dragged.
 * None of it enters undo history; `startSelectionSync` keeps it pointing at objects
 * that exist after every plan change (undo included).
 */
import { atom } from 'jotai';

import { hitItem, type Hit } from '../model/hitTest';
import { cutShowing } from '../model/cut';
import {
  itemExists,
  normalizeSelection,
  type Selection,
  type SelectionItem,
} from '../model/selection';

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

const RECORDS = [
  ['raw', 'rawPieces'],
  ['prop', 'props'],
  ['dimension', 'dimensions'],
] as const;

/** The items `next` adds or changes since `prev` (records compared by identity). */
const changedItems = (prev: Plan, next: Plan): SelectionItem[] =>
  RECORDS.flatMap(([kind, key]) => {
    const before: Record<string, unknown> = prev[key];
    const after: Record<string, unknown> = next[key];
    if (before === after) return [];
    return Object.keys(after)
      .filter((id) => after[id] !== before[id])
      .map((id) => ({ kind, id }));
  });

/**
 * After an undo or redo leaves a selected item hidden by the cut (a raise undone), the
 * cut rises to show it, as it does for what a redo places or moves (`revealPlaced`'s
 * rule); the hover goes, as with any cut change. The cut never drops.
 */
const followSelection = (
  plan: Plan,
  session: SessionAccess,
  redone: readonly SelectionItem[]
): void => {
  const h = session.get(cutHeightAtom);
  const step = session.get(cutStepAtom);
  const items = [...session.get(selectionAtom), ...redone];
  const next = cutShowing(h, plan, items, step, getLibrary());
  if (next === h) return;
  session.set(cutHeightAtom, next);
  session.set(hoverAtom, null);
};

/**
 * Prunes the selection and hover after each plan change; loading a plan clears them.
 * Start it before the first render, so React never reads a stale id.
 */
export const startSelectionSync = (plan: PlanStore, session: SessionAccess): (() => void) => {
  let prev = plan.getPlan();
  return plan.subscribe(({ plan: next, source }) => {
    const before = prev;
    prev = next;
    const selection = session.get(selectionAtom);
    const pruned = source === 'load' ? [] : normalizeSelection(next, selection);
    if (pruned !== selection) session.set(selectionAtom, pruned);
    if (source === 'undo') followSelection(next, session, []);
    if (source === 'redo') followSelection(next, session, changedItems(before, next));
    const hover = session.get(hoverAtom);
    if (hover && (source === 'load' || !itemExists(next, hitItem(hover)))) {
      session.set(hoverAtom, null);
    }
  });
};
