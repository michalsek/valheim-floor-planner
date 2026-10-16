import { newId } from '../../model/newId';
import type { Vec2 } from '../../model/types';
import { isUndoKey } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { draftToRun, nextDraftAction } from './wallDraft';
import { WallIcon } from './WallIcon';
import { WallOptions } from './WallOptions';
import { WallPreview } from './WallPreview';
import {
  flipWallSide,
  wallDraftAtom,
  wallInputAtom,
  wallSettingsAtom,
  type WallInput,
} from './wallState';
import { WallWorldPreview } from './WallWorldPreview';

const commit = (ctx: ToolContext, points: readonly Vec2[], closed: boolean): void => {
  const run = draftToRun(newId(), points, closed, ctx.get(wallSettingsAtom));
  ctx.set(wallDraftAtom, null);
  if (run) ctx.plan.dispatch({ type: 'wall.insert', wall: run }, { label: 'Add wall' });
};

/** Commits an open run of at least 2 points, or cancels. False when not drawing. */
const finish = (ctx: ToolContext): boolean => {
  const draft = ctx.get(wallDraftAtom);
  if (!draft) return false;
  if (draft.points.length >= 2) commit(ctx, draft.points, false);
  else ctx.set(wallDraftAtom, null);
  return true;
};

/** Removes the last point (removing the only one cancels). False when not drawing. */
const removeLastPoint = (ctx: ToolContext): boolean => {
  const draft = ctx.get(wallDraftAtom);
  if (!draft) return false;
  const [first, ...rest] = draft.points;
  ctx.set(
    wallDraftAtom,
    rest.length > 0 ? { ...draft, points: [first, ...rest.slice(0, -1)] } : null
  );
  return true;
};

const cancel = (ctx: ToolContext): boolean => {
  if (!ctx.get(wallDraftAtom)) return false;
  ctx.set(wallDraftAtom, null);
  return true;
};

const setInput = (ctx: ToolContext, changes: Partial<WallInput>): void =>
  ctx.set(wallInputAtom, (input) => ({ ...input, ...changes }));

/**
 * While drawing, Mod+Z takes back the last point. Holding it must stop at the empty
 * draft: its repeats don't go on to undo the plan.
 */
const onUndoKey = (e: KeyboardEvent, ctx: ToolContext): boolean => {
  if (removeLastPoint(ctx)) {
    setInput(ctx, { undoHeld: ctx.get(wallDraftAtom) === null });
    return true;
  }
  if (e.repeat) return ctx.get(wallInputAtom).undoHeld;
  setInput(ctx, { undoHeld: false });
  return false;
};

/**
 * Click to add orthogonal points; click the start to close the loop; double-click or
 * Enter to finish an open run. Backspace (or Mod+Z) removes a point, Esc cancels and
 * F flips a block wall's strip.
 */
export const wallTool: Tool = {
  id: 'wall',
  label: 'Wall',
  shortcut: 'w',
  icon: WallIcon,
  cursor: 'crosshair',
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const draft = ctx.get(wallDraftAtom);
    const action = nextDraftAction(draft?.points ?? [], e.snapped);
    if (action.kind === 'add') {
      ctx.set(
        wallDraftAtom,
        draft
          ? { ...draft, points: [...draft.points, action.p] }
          : { points: [action.p], afterClose: ctx.get(wallInputAtom).closedOnLastDown }
      );
    }
    if (action.kind === 'close' && draft) commit(ctx, draft.points, true);
    setInput(ctx, { closedOnLastDown: action.kind === 'close' });
  },
  // Its two pointer-downs already added (then ignored) the point.
  onDoubleClick(_e, ctx) {
    const draft = ctx.get(wallDraftAtom);
    // The double-click's first click closed a loop and its second started this draft.
    if (draft?.afterClose && draft.points.length === 1) return;
    finish(ctx);
  },
  onKeyDown(e, ctx) {
    if (isUndoKey(e)) return onUndoKey(e, ctx);
    if (e.ctrlKey || e.metaKey) return false;
    switch (e.key) {
      case 'Enter':
        return finish(ctx);
      case 'Escape':
        return cancel(ctx);
      case 'Backspace':
      case 'Delete':
        return removeLastPoint(ctx);
      case 'f':
      case 'F':
        return !e.repeat && flipWallSide(ctx);
      default:
        return false;
    }
  },
  onDeactivate(ctx) {
    ctx.set(wallDraftAtom, null);
  },
  Preview: WallPreview,
  WorldPreview: WallWorldPreview,
  Options: WallOptions,
};
