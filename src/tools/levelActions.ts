/**
 * Moving between levels and moving things up and down them: shared by the Levels bar,
 * PageUp / PageDown and the Pick click. The current level is the work datum (session
 * state, never undone); moving objects is one history entry.
 */
import { clampElevation, roundElevation } from '../model/elevation';
import { itemsFrom, levelAbove, levelBelow, shiftElevation } from '../model/levels';
import { unionItems } from '../model/selection';
import type { Vec2 } from '../model/types';
import { getLibrary } from '../store/libraryInstance';
import { hoverAtom, selectionAtom } from '../store/selection';
import { elevationStepAtom, levelPickAtom, workDatumAtom } from '../store/session';
import type { ScreenPoint } from '../viewport/viewportMath';

import { pickTop } from './picking';
import { commitCommands } from './Select/selectActions';
import type { ToolContext } from './types';

export type LevelDirection = 1 | -1;

/** Makes `elevation` (clamped to the allowed range) the current level. */
export const setWorkElevation = (ctx: ToolContext, elevation: number): void => {
  const next = roundElevation(clampElevation(elevation));
  if (next === ctx.get(workDatumAtom)) return;
  ctx.set(workDatumAtom, next);
  // What was hovered is on another level now.
  ctx.set(hoverAtom, null);
};

/** One step up or down, onto the step's grid (2.3 steps up to 3 with a 1 m step). */
export const stepLevel = (ctx: ToolContext, dir: LevelDirection): void => {
  const step = ctx.get(elevationStepAtom);
  const at = ctx.get(workDatumAtom) / step;
  const onGrid = Math.abs(at - Math.round(at)) < 1e-6 ? Math.round(at) : null;
  const next = onGrid !== null ? onGrid + dir : dir > 0 ? Math.ceil(at) : Math.floor(at);
  setWorkElevation(ctx, next * step);
};

/** The next level with something on it, above or below; false when there is none. */
export const jumpLevel = (ctx: ToolContext, dir: LevelDirection): boolean => {
  const plan = ctx.plan.getPlan();
  const datum = ctx.get(workDatumAtom);
  const next = (dir > 0 ? levelAbove : levelBelow)(plan, datum, getLibrary());
  if (next === null) return false;
  setWorkElevation(ctx, next);
  return true;
};

/**
 * Moves the selection one step up or down, and the current level with it. `ripple`
 * takes along everything from the current level up (the floors above a raised storey).
 */
export const moveSelectionLevel = (
  ctx: ToolContext,
  dir: LevelDirection,
  ripple: boolean
): boolean => {
  const plan = ctx.plan.getPlan();
  const datum = ctx.get(workDatumAtom);
  const selection = ctx.get(selectionAtom);
  const items = ripple ? unionItems(selection, itemsFrom(plan, datum)) : selection;
  const dy = dir * ctx.get(elevationStepAtom);
  const cmds = shiftElevation(plan, items, dy);
  if (cmds.length === 0) return false;
  const label = ripple ? 'Move levels' : dir > 0 ? 'Move up a level' : 'Move down a level';
  if (!commitCommands(ctx, label, cmds)) return false;
  setWorkElevation(ctx, datum + dy);
  return true;
};

/** The Pick click: the level moves to the top of the piece clicked, on the step's grid. */
export const pickLevel = (ctx: ToolContext, screen: ScreenPoint, world: Vec2 | null): void => {
  ctx.set(levelPickAtom, false);
  const top = pickTop(ctx, screen, world);
  if (top === null) return;
  const step = ctx.get(elevationStepAtom);
  setWorkElevation(ctx, Math.round(top / step) * step);
};
