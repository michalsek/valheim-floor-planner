import { hoverAtom } from '../../store/selection';
import { cursorStyleAtom } from '../../store/session';
import { isMod, isRedoKey, isUndoKey } from '../keys';
import type { Tool, ToolContext } from '../types';

import {
  clearSelection,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  selectAll,
} from './selectActions';
import { SelectIcon } from './SelectIcon';
import { cancelGesture, onSelectDown, onSelectMove, onSelectUp } from './selectPointer';
import { SelectPreview } from './SelectPreview';
import { selectGestureAtom } from './selectState';

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Keys the idle tool acts on; during a gesture they are swallowed instead. */
const isEditKey = (e: KeyboardEvent): boolean => {
  const key = e.key.toLowerCase();
  if (isMod(e)) return key === 'd' || key === 'a';
  return e.key === 'Delete' || e.key === 'Backspace' || e.key in ARROWS;
};

/**
 * Mid-gesture: Esc and Mod+Z (or redo) cancel it, leaving the plan unchanged, and
 * edit keys are swallowed so they can't change the plan under the preview.
 */
const onGestureKey = (e: KeyboardEvent, ctx: ToolContext): boolean => {
  if (e.key === 'Escape' || isUndoKey(e) || isRedoKey(e)) return cancelGesture(ctx);
  return isEditKey(e);
};

const onIdleKey = (e: KeyboardEvent, ctx: ToolContext): boolean => {
  if (e.altKey || e.shiftKey) return false;
  if (isMod(e)) {
    const key = e.key.toLowerCase();
    if (key === 'd') {
      duplicateSelection(ctx);
      // Claimed even with nothing selected: unclaimed, Mod+D bookmarks the page.
      return true;
    }
    if (key === 'a') {
      selectAll(ctx);
      return true;
    }
    return false;
  }
  if (e.key === 'Escape') return clearSelection(ctx);
  if (e.key === 'Delete' || e.key === 'Backspace') return deleteSelection(ctx);
  const arrow = ARROWS[e.key];
  return arrow ? nudgeSelection(ctx, arrow[0], arrow[1]) : false;
};

/**
 * Click to select (Shift toggles), drag a selected item to move the selection, drag
 * a selected wall's corner to reshape it, or drag on empty space to box-select.
 * Delete, arrows (nudge), Mod+D (duplicate), Mod+A and Esc act on the selection.
 */
export const selectTool: Tool = {
  id: 'select',
  label: 'Select',
  shortcut: 'v',
  icon: SelectIcon,
  cursor: 'default',
  onPointerDown: onSelectDown,
  onPointerMove: onSelectMove,
  onPointerUp: onSelectUp,
  onPointerCancel: cancelGesture,
  onKeyDown(e, ctx) {
    return ctx.get(selectGestureAtom).phase === 'idle' ? onIdleKey(e, ctx) : onGestureKey(e, ctx);
  },
  onDeactivate(ctx) {
    cancelGesture(ctx);
    ctx.set(hoverAtom, null);
    ctx.set(cursorStyleAtom, null);
  },
  Preview: SelectPreview,
};
