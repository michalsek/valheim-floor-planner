import { hoverAtom, selectionAtom } from '../../store/selection';
import { cursorStyleAtom } from '../../store/session';
import { isMod, isRedoKey, isUndoKey, rotateStep } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import {
  clearSelection,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  rotateItems,
  selectAll,
} from './selectActions';
import { SelectIcon } from './SelectIcon';
import {
  cancelGesture,
  onSelectDown,
  onSelectMove,
  onSelectOffPlane,
  onSelectUp,
} from './selectPointer';
import { SelectPreview } from './SelectPreview';
import { SelectOverlay3d } from './SelectPreview3d';
import { selectGestureAtom, sinkHotAtom } from './selectState';
import { isRawOnly, turnCarry, wheelCarry } from './snapMove';

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Keys the idle tool acts on; during a gesture they are swallowed instead. */
const isEditKey = (e: KeyboardEvent): boolean => {
  const key = e.key.toLowerCase();
  // Mod+PageUp / PageDown move the selection a step (`useToolKeyboard`).
  if (isMod(e)) return key === 'd' || key === 'a' || key === 'pageup' || key === 'pagedown';
  return e.key === 'Delete' || e.key === 'Backspace' || e.key in ARROWS || rotateStep(e) !== null;
};

/**
 * Mid-gesture: Esc and Mod+Z (or redo) cancel it, leaving the plan unchanged, and
 * edit keys are swallowed so they can't change the plan under the preview.
 */
const onGestureKey = (e: KeyboardEvent, ctx: ToolContext): boolean => {
  if (e.key === 'Escape' || isUndoKey(e) || isRedoKey(e)) return cancelGesture(ctx);
  const g = ctx.get(selectGestureAtom);
  const turn = rotateStep(e);
  if (g.phase === 'carrying' && turn !== null) {
    ctx.set(selectGestureAtom, { ...g, carry: turnCarry(ctx, g.carry, turn) });
    return true;
  }
  return isEditKey(e);
};

const onIdleKey = (e: KeyboardEvent, ctx: ToolContext): boolean => {
  const turn = rotateStep(e);
  if (turn !== null) return rotateItems(ctx, turn);
  if (e.altKey || e.shiftKey) return false;
  if (isMod(e)) {
    const key = e.key.toLowerCase();
    if (key === 'd') {
      // Raw pieces only: Mod+D carries copies into Build (`useToolKeyboard`).
      if (isRawOnly(ctx.plan.getPlan(), ctx.get(selectionAtom))) return false;
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
 * Click to select (Shift toggles), drag a selected item to move the selection (raw
 * pieces snap as in Build; the wheel and R turn them mid-drag), or drag on empty space
 * to box-select; in 3D, the sink handle lowers a grounded selection. Delete, arrows
 * (nudge), R / Shift+R (turn props), Mod+D (duplicate; raw pieces: carry copies into
 * Build), Mod+A and Esc act on the selection.
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
  onPointerOffPlane: onSelectOffPlane,
  // Clicking empty sky in 3D clears the selection, as clicking empty ground does.
  onPointerMiss(e, ctx) {
    if (e.button === PRIMARY_BUTTON && !e.shiftKey) clearSelection(ctx);
  },
  onPointerLeave(ctx) {
    if (ctx.get(selectGestureAtom).phase !== 'idle') return;
    ctx.set(hoverAtom, null);
    ctx.set(cursorStyleAtom, null);
    ctx.set(sinkHotAtom, false);
  },
  // While a snap-move carries raw pieces, the wheel turns them.
  onWheel(e, ctx) {
    const g = ctx.get(selectGestureAtom);
    if (g.phase !== 'carrying') return false;
    ctx.set(selectGestureAtom, { ...g, carry: wheelCarry(ctx, g.carry, e) });
    return true;
  },
  onKeyDown(e, ctx) {
    return ctx.get(selectGestureAtom).phase === 'idle' ? onIdleKey(e, ctx) : onGestureKey(e, ctx);
  },
  onDeactivate(ctx) {
    cancelGesture(ctx);
    ctx.set(hoverAtom, null);
    ctx.set(cursorStyleAtom, null);
    ctx.set(sinkHotAtom, false);
  },
  Preview: SelectPreview,
  Overlay3d: SelectOverlay3d,
};
