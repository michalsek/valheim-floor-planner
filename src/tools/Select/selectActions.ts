/** Selection edits shared by the Select tool's keys and the Inspector. */
import {
  duplicateCommands,
  removeCommands,
  rotateCommands,
  translateCommands,
} from '../../model/editCommands';
import { setFromRaw } from '../../model/build/ghostSet';
import { raiseCommands, type CutDirection } from '../../model/cut';
import { newId } from '../../model/newId';
import { snapAnchorAt } from '../../model/geometry/propGeometry';
import { snapToGrid } from '../../model/geometry/snap';
import {
  allItems,
  itemExists,
  itemsLabel,
  type Selection,
  type SelectionItem,
} from '../../model/selection';
import type { Plan, Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { selectionAtom } from '../../store/selection';
import { cutStepAtom, snapStepAtom } from '../../store/session';
import { armCopiesAtom } from '../Build/buildState';
import { commitCommands } from '../commitCommands';
import { cutView } from '../picking';
import type { ToolContext } from '../types';

import { isRawOnly } from './snapMove';

export const clearSelection = (ctx: ToolContext): boolean => {
  if (ctx.get(selectionAtom).length === 0) return false;
  ctx.set(selectionAtom, []);
  return true;
};

/** Everything shown (below the cut). */
export const selectAll = (ctx: ToolContext): void => {
  ctx.set(selectionAtom, allItems(cutView(ctx)));
};

/** Deletes the selected items the cut shows (never a hidden one), as one entry. */
export const deleteSelection = (ctx: ToolContext): boolean => {
  const view = cutView(ctx);
  const items = ctx.get(selectionAtom).filter((item) => itemExists(view, item));
  if (items.length === 0) return false;
  const cmds = removeCommands(ctx.plan.getPlan(), items);
  commitCommands(ctx, itemsLabel('Delete', items), cmds);
  return true;
};

/**
 * The snap anchor of the item a move is about (see `PropDef.snap`): a pole's axis, a
 * beam's end. Snapped moves put it on the grid; null for other items.
 */
export const anchorOf = (plan: Plan, item: SelectionItem | undefined): Vec2 | null => {
  const prop = item?.kind === 'prop' ? plan.props[item.id] : undefined;
  return prop ? snapAnchorAt(prop, getLibrary().propDefs.get(prop.prefab)?.snap) : null;
};

/** `d` adjusted so that `anchor` (if any) ends on the `step` grid. */
export const anchoredDelta = (anchor: Vec2 | null, d: Vec2, step: number): Vec2 => {
  if (!anchor) return d;
  const to = snapToGrid({ x: anchor.x + d.x, z: anchor.z + d.z }, step);
  return { x: to.x - anchor.x, z: to.z - anchor.z };
};

/**
 * Moves the selection by `steps` snap steps along x and z (one "Nudge" entry); a
 * selected pole or beam first lands its anchor on the grid.
 */
export const nudgeSelection = (ctx: ToolContext, dx: number, dz: number): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const step = ctx.get(snapStepAtom);
  const anchor = anchorOf(ctx.plan.getPlan(), items[0]);
  const d = anchoredDelta(anchor, { x: dx * step, z: dz * step }, step);
  commitCommands(ctx, 'Nudge', translateCommands(ctx.plan.getPlan(), items, d));
  return true;
};

/** Copies the selection one snap step down and right, and selects the copies. */
export const duplicateSelection = (ctx: ToolContext): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const step = ctx.get(snapStepAtom);
  const d = { x: step, z: step };
  const copy = duplicateCommands(ctx.plan.getPlan(), items, d, newId);
  if (commitCommands(ctx, itemsLabel('Duplicate', items), copy.cmds)) {
    ctx.set(selectionAtom, copy.items);
  }
  return true;
};

/**
 * Turns the props and raw pieces in `items` (the selection by default) by `deltaDeg`
 * about their centres, as one entry; false when there is nothing to turn.
 */
export const rotateItems = (
  ctx: ToolContext,
  deltaDeg: number,
  items: Selection = ctx.get(selectionAtom)
): boolean => {
  const props = items.filter((item) => item.kind === 'prop' || item.kind === 'raw');
  const cmds = rotateCommands(ctx.plan.getPlan(), props, deltaDeg, getLibrary());
  if (cmds.length === 0) return false;
  commitCommands(ctx, itemsLabel('Rotate', props), cmds);
  return true;
};

/**
 * Raw pieces only (Mod+D): arms Build with a copy of the selection about its first piece,
 * turned as it is, so each click drops a copy; Esc ends (and gives back the Build turn).
 * False for any other selection.
 */
export const carryCopies = (ctx: ToolContext): boolean => {
  const plan = ctx.plan.getPlan();
  const items = ctx.get(selectionAtom);
  if (!isRawOnly(plan, items)) return false;
  const first = plan.rawPieces[items[0]!.id]!;
  const pieces = items.map((item) => plan.rawPieces[item.id]!);
  ctx.set(armCopiesAtom, setFromRaw(pieces, first.id), first.rotation.yaw);
  return true;
};

/** Moves the selection one step up or down (Mod+PageUp / PageDown), as one entry. */
export const raiseSelection = (ctx: ToolContext, dir: CutDirection): boolean => {
  const step = dir * ctx.get(cutStepAtom);
  const cmds = raiseCommands(ctx.plan.getPlan(), ctx.get(selectionAtom), step);
  if (cmds.length === 0) return false;
  return commitCommands(ctx, dir > 0 ? 'Move up' : 'Move down', cmds);
};
