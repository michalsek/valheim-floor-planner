import { offsetThrough } from '../../model/geometry/dimension';
import { samePoint } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import type { Vec2 } from '../../model/types';
import { viewportAtom } from '../../store/session';
import { isUndoKey } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { hitDimension } from './dimensionHit';
import { DimensionIcon } from './DimensionIcon';
import { DimensionPreview } from './DimensionPreview';
import { DIMENSION_IDLE, dimensionDraftAtom, dimensionHoverIdAtom } from './dimensionState';

/** How close (in screen px) the pointer must be to a dimension line to hover it. */
const HIT_TOL_PX = 6;

const updateHover = (ctx: ToolContext, p: Vec2): void => {
  const tol = HIT_TOL_PX / ctx.get(viewportAtom).zoom;
  ctx.set(dimensionHoverIdAtom, hitDimension(ctx.plan.getPlan().dimensions, p, tol));
};

/** Deletes the hovered dimension; false when none is hovered. */
const deleteHovered = (ctx: ToolContext): boolean => {
  const id = ctx.get(dimensionHoverIdAtom);
  if (!id) return false;
  ctx.plan.dispatch({ type: 'dimension.remove', id });
  ctx.set(dimensionHoverIdAtom, null);
  return true;
};

/** Stops clearing the hover on plan changes (set while the tool is active). */
let stopHoverReset: (() => void) | null = null;

/** One step back through the draft; false when there is no draft. */
const stepBack = (ctx: ToolContext): boolean => {
  const draft = ctx.get(dimensionDraftAtom);
  if (draft.phase === 'idle') return false;
  ctx.set(
    dimensionDraftAtom,
    draft.phase === 'offset' ? { phase: 'b', a: draft.a } : DIMENSION_IDLE
  );
  return true;
};

/**
 * Click A, click B, move aside and click to pin a dimension. While idle, Delete,
 * Backspace or Alt+click removes the hovered dimension. Esc cancels; Mod+Z steps back
 * through the draft.
 */
export const dimensionTool: Tool = {
  id: 'dimension',
  label: 'Dimension',
  shortcut: 'd',
  icon: DimensionIcon,
  cursor: 'crosshair',
  onPointerMove(e, ctx) {
    if (ctx.get(dimensionDraftAtom).phase === 'idle') updateHover(ctx, e.world);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const draft = ctx.get(dimensionDraftAtom);
    switch (draft.phase) {
      case 'idle':
        updateHover(ctx, e.world);
        if (e.altKey && deleteHovered(ctx)) return;
        ctx.set(dimensionHoverIdAtom, null);
        ctx.set(dimensionDraftAtom, { phase: 'b', a: e.snapped });
        return;
      case 'b':
        if (!samePoint(draft.a, e.snapped)) {
          ctx.set(dimensionDraftAtom, { phase: 'offset', a: draft.a, b: e.snapped });
        }
        return;
      case 'offset': {
        const { a, b } = draft;
        const offset = offsetThrough(a, b, e.snapped);
        ctx.plan.dispatch({ type: 'dimension.insert', dimension: { id: newId(), a, b, offset } });
        ctx.set(dimensionDraftAtom, DIMENSION_IDLE);
        return;
      }
    }
  },
  onKeyDown(e, ctx) {
    if (isUndoKey(e)) return stepBack(ctx);
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const idle = ctx.get(dimensionDraftAtom).phase === 'idle';
    if (e.key === 'Delete' || e.key === 'Backspace') return idle && deleteHovered(ctx);
    if (e.key !== 'Escape' || idle) return false;
    ctx.set(dimensionDraftAtom, DIMENSION_IDLE);
    return true;
  },
  onActivate(ctx) {
    // An undo or redo can remove the hovered dimension under the pointer.
    stopHoverReset = ctx.plan.subscribe(() => ctx.set(dimensionHoverIdAtom, null));
  },
  onDeactivate(ctx) {
    stopHoverReset?.();
    stopHoverReset = null;
    ctx.set(dimensionDraftAtom, DIMENSION_IDLE);
    ctx.set(dimensionHoverIdAtom, null);
  },
  Preview: DimensionPreview,
};
