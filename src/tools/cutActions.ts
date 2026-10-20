/**
 * Moving the cut: shared by the Cut bar, PageUp / PageDown and C. The cut height is
 * session state (never undone). Whatever is placed or moved stays shown: the cut rises
 * to it (`revealPlaced`, via `commitCommands`), so everything visible stays editable;
 * and lowering the cut drops what it hides from the selection.
 */
import { cutShowing, nextStop, prevStop, steppedCut, type CutDirection } from '../model/cut';
import type { PlanCommand } from '../model/commands';
import { clampElevation, roundElevation } from '../model/elevation';
import { boxBottom } from '../model/pieceBoxes';
import { itemExists, type Selection, type SelectionItem } from '../model/selection';
import { getLibrary } from '../store/libraryInstance';
import { getCutPlan, getPieceBoxes, getStoreyStops } from '../store/planHooks';
import { hoverAtom, selectionAtom } from '../store/selection';
import { cutHeightAtom, cutStepAtom, lastCutAtom } from '../store/session';

import type { ToolContext } from './types';

/**
 * Sets the cut to `h` (clamped to the allowed range and mm-rounded), or All for null. The
 * hover goes, and the selection keeps only what the new cut shows.
 */
export const setCut = (ctx: ToolContext, h: number | null): void => {
  const next = h === null ? null : roundElevation(clampElevation(h));
  if (next !== null) ctx.set(lastCutAtom, next);
  if (next === ctx.get(cutHeightAtom)) return;
  ctx.set(cutHeightAtom, next);
  ctx.set(hoverAtom, null);
  const selection = ctx.get(selectionAtom);
  const view = getCutPlan(ctx.plan.getPlan(), next);
  const shown = selection.filter((item) => itemExists(view, item));
  if (shown.length !== selection.length) ctx.set(selectionAtom, shown);
};

/** One step up or down on the step's grid; up past everything is All. */
export const stepCut = (ctx: ToolContext, dir: CutDirection): void => {
  const boxes = getPieceBoxes(ctx.plan.getPlan());
  const top =
    boxes.length === 0 ? null : boxes.reduce((m, b) => Math.max(m, boxBottom(b)), -Infinity);
  setCut(ctx, steppedCut(ctx.get(cutHeightAtom), dir, ctx.get(cutStepAtom), top));
};

/**
 * The next storey stop up (past the top one: All) or down (none below: no change);
 * nothing without stops.
 */
export const jumpStop = (ctx: ToolContext, dir: CutDirection): void => {
  const stops = getStoreyStops(ctx.plan.getPlan());
  const h = ctx.get(cutHeightAtom);
  if (stops.length === 0) return;
  if (dir > 0) {
    if (h !== null) setCut(ctx, nextStop(stops, h));
    return;
  }
  const next = prevStop(stops, h);
  if (next !== null) setCut(ctx, next);
};

/** C: from a cut to All; from All back to the last cut, else the highest stop. */
export const toggleAll = (ctx: ToolContext): void => {
  if (ctx.get(cutHeightAtom) !== null) {
    setCut(ctx, null);
    return;
  }
  const stops = getStoreyStops(ctx.plan.getPlan());
  const back = ctx.get(lastCutAtom) ?? stops.at(-1)?.height ?? null;
  if (back !== null) setCut(ctx, back);
};

/** Raises the cut, if needed, so every item of `items` shows (onto the step's grid). */
export const showItems = (ctx: ToolContext, items: Selection): void => {
  const h = ctx.get(cutHeightAtom);
  const plan = ctx.plan.getPlan();
  const next = cutShowing(h, plan, items, ctx.get(cutStepAtom), getLibrary());
  if (next !== h) setCut(ctx, next);
};

/** The item a command adds or changes, if any. */
const touched = (cmd: PlanCommand): SelectionItem[] => {
  switch (cmd.type) {
    case 'raw.insert':
      return [{ kind: 'raw', id: cmd.piece.id }];
    case 'prop.insert':
      return [{ kind: 'prop', id: cmd.prop.id }];
    case 'dimension.insert':
      return [{ kind: 'dimension', id: cmd.dimension.id }];
    case 'raw.patch':
      return [{ kind: 'raw', id: cmd.id }];
    case 'prop.patch':
      return [{ kind: 'prop', id: cmd.id }];
    case 'dimension.patch':
      return [{ kind: 'dimension', id: cmd.id }];
    default:
      return [];
  }
};

/**
 * After committed `cmds`: the cut rises, if needed, so what they placed or moved shows
 * (as Mod+PageUp does). Undoing them leaves the cut where it is.
 */
export const revealPlaced = (ctx: ToolContext, cmds: readonly PlanCommand[]): void =>
  showItems(ctx, cmds.flatMap(touched));
