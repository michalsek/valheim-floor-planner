/** Selection edits shared by the Select tool's keys and the Inspector. */
import { duplicateCommands, removeCommands, translateCommands } from '../../model/editCommands';
import { newId } from '../../model/newId';
import { allItems, itemsLabel } from '../../model/selection';
import type { PlanCommand } from '../../model/commands';
import { selectionAtom } from '../../store/selection';
import { snapStepAtom } from '../../store/session';
import type { ToolContext } from '../types';

/** Commits `cmds` as one history entry; true when it worked (or there was nothing to do). */
export const commitCommands = (
  ctx: ToolContext,
  label: string,
  cmds: readonly PlanCommand[]
): boolean => {
  if (cmds.length === 0) return true;
  const result = ctx.plan.transact(label, (dispatch) => cmds.forEach(dispatch));
  if (!result.ok) console.warn(`${label} failed.`, result.error);
  return result.ok;
};

export const clearSelection = (ctx: ToolContext): boolean => {
  if (ctx.get(selectionAtom).length === 0) return false;
  ctx.set(selectionAtom, []);
  return true;
};

export const selectAll = (ctx: ToolContext): void => {
  ctx.set(selectionAtom, allItems(ctx.plan.getPlan()));
};

export const deleteSelection = (ctx: ToolContext): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  commitCommands(ctx, itemsLabel('Delete', items), removeCommands(items));
  return true;
};

/** Moves the selection by `steps` snap steps along x and z (one "Nudge" entry). */
export const nudgeSelection = (ctx: ToolContext, dx: number, dz: number): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const step = ctx.get(snapStepAtom);
  const d = { x: dx * step, z: dz * step };
  commitCommands(ctx, 'Nudge', translateCommands(ctx.plan.getPlan(), items, d));
  return true;
};

/** Copies the selection one snap step down and right, and selects the copies. */
export const duplicateSelection = (ctx: ToolContext): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const step = ctx.get(snapStepAtom);
  const copy = duplicateCommands(ctx.plan.getPlan(), items, { x: step, z: step }, newId);
  if (commitCommands(ctx, itemsLabel('Duplicate', items), copy.cmds)) {
    ctx.set(selectionAtom, copy.items);
  }
  return true;
};
