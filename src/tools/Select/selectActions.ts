/** Selection edits shared by the Select tool's keys and the Inspector. */
import {
  duplicateCommands,
  removeCommands,
  rotateCommands,
  translateCommands,
} from '../../model/editCommands';
import { setFromRaw } from '../../model/build/ghostSet';
import { newId } from '../../model/newId';
import { itemsAt } from '../../model/levels';
import { snapAnchorAt } from '../../model/geometry/propGeometry';
import { snapToGrid } from '../../model/geometry/snap';
import { itemsLabel, type Selection, type SelectionItem } from '../../model/selection';
import type { Plan, Vec2 } from '../../model/types';
import type { PlanCommand } from '../../model/commands';
import { getLibrary } from '../../store/libraryInstance';
import { selectionAtom } from '../../store/selection';
import { snapStepAtom, workDatumAtom } from '../../store/session';
import { armedSetAtom, buildYawAtom, carriedCopiesAtom } from '../Build/buildState';
import type { ToolContext } from '../types';

import { isRawOnly } from './snapMove';

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

/**
 * The step a move of `items` goes in: the snap step, but at least 1 m when floors or
 * openings move. Floors stay on the metre grid their tiles need, and openings slide
 * in whole metres, so a 0.5 m step would never move them. (`toolMinSnapAtom` does the
 * same for the cursor of a tool that draws on that grid.)
 */
export const moveStep = (items: Selection, step: number): number =>
  items.some((item) => item.kind === 'floor' || item.kind === 'opening' || item.kind === 'roof')
    ? Math.max(step, 1)
    : step;

export const clearSelection = (ctx: ToolContext): boolean => {
  if (ctx.get(selectionAtom).length === 0) return false;
  ctx.set(selectionAtom, []);
  return true;
};

/** Everything on the current level. */
export const selectAll = (ctx: ToolContext): void => {
  ctx.set(selectionAtom, itemsAt(ctx.plan.getPlan(), ctx.get(workDatumAtom), getLibrary()));
};

export const deleteSelection = (ctx: ToolContext): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const cmds = removeCommands(ctx.plan.getPlan(), items, getLibrary());
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
  const step = moveStep(items, ctx.get(snapStepAtom));
  const anchor = anchorOf(ctx.plan.getPlan(), items[0]);
  const d = anchoredDelta(anchor, { x: dx * step, z: dz * step }, step);
  commitCommands(ctx, 'Nudge', translateCommands(ctx.plan.getPlan(), items, d, getLibrary()));
  return true;
};

/** Copies the selection one snap step down and right, and selects the copies. */
export const duplicateSelection = (ctx: ToolContext): boolean => {
  const items = ctx.get(selectionAtom);
  if (items.length === 0) return false;
  const step = moveStep(items, ctx.get(snapStepAtom));
  const d = { x: step, z: step };
  const copy = duplicateCommands(ctx.plan.getPlan(), items, d, newId, getLibrary());
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
 * turned as it is, so each click drops a copy; Esc ends. False for any other selection.
 */
export const carryCopies = (ctx: ToolContext): boolean => {
  const plan = ctx.plan.getPlan();
  const items = ctx.get(selectionAtom);
  if (!isRawOnly(plan, items)) return false;
  const first = plan.rawPieces[items[0]!.id]!;
  const pieces = items.map((item) => plan.rawPieces[item.id]!);
  ctx.set(armedSetAtom, setFromRaw(pieces, first.id));
  ctx.set(buildYawAtom, first.rotation.yaw);
  ctx.set(carriedCopiesAtom, true);
  return true;
};
