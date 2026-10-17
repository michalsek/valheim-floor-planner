import { offsetThrough } from '../../model/geometry/dimension';
import { hitDimension } from '../../model/hitTest';
import { samePoint } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import type { Vec2 } from '../../model/types';
import { hoverAtom } from '../../store/selection';
import { workDatumAtom } from '../../store/session';
import { hitTolerance } from '../hitTolerance';
import { isUndoKey } from '../keys';
import { levelView } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { DimensionIcon } from './DimensionIcon';
import { DimensionPreview } from './DimensionPreview';
import { DimensionOverlay3d, DimensionPreview3d } from './DimensionPreview3d';
import { DIMENSION_IDLE, dimensionDraftAtom } from './dimensionState';

/** Hovers the pinned dimension under `p`: Delete or Alt+click would remove it. */
const updateHover = (ctx: ToolContext, p: Vec2): void => {
  const hit = hitDimension(levelView(ctx).dimensions, p, hitTolerance(ctx));
  ctx.set(hoverAtom, hit && { kind: 'dimension', ...hit });
};

/** Deletes the hovered dimension; false when none is hovered. */
const deleteHovered = (ctx: ToolContext): boolean => {
  const hover = ctx.get(hoverAtom);
  if (hover?.kind !== 'dimension') return false;
  ctx.plan.dispatch({ type: 'dimension.remove', id: hover.id });
  ctx.set(hoverAtom, null);
  return true;
};

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
        ctx.set(hoverAtom, null);
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
        const dimension = { id: newId(), a, b, offset, elevation: ctx.get(workDatumAtom) };
        ctx.plan.dispatch({ type: 'dimension.insert', dimension });
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
  onPointerLeave(ctx) {
    ctx.set(hoverAtom, null);
  },
  // `startSelectionSync` clears a hover whose dimension an undo removed.
  onDeactivate(ctx) {
    ctx.set(dimensionDraftAtom, DIMENSION_IDLE);
    ctx.set(hoverAtom, null);
  },
  Preview: DimensionPreview,
  Preview3d: DimensionPreview3d,
  Overlay3d: DimensionOverlay3d,
};
