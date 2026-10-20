import { clampElevation, roundElevation } from '../../model/elevation';
import { offsetThrough } from '../../model/geometry/dimension';
import { samePoint } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import { hoverAtom } from '../../store/selection';
import { commitCommands } from '../commitCommands';
import { isUndoKey } from '../keys';
import { onPlaneAt, pickDimension } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext, ToolPointerEvent } from '../types';

import { DimensionIcon } from './DimensionIcon';
import { DimensionPreview } from './DimensionPreview';
import { DimensionOverlay3d, DimensionPreview3d } from './DimensionPreview3d';
import { DIMENSION_IDLE, dimensionDraftAtom } from './dimensionState';

/**
 * Hovers the pinned dimension under the pointer (in 3D, at its own height): Delete or
 * Alt+click would remove it.
 */
const updateHover = (ctx: ToolContext, e: ToolPointerEvent): void => {
  const hit = pickDimension(ctx, e);
  ctx.set(hoverAtom, hit && { kind: 'dimension', id: hit.id, distance: hit.distance });
};

/** Deletes the hovered dimension; false when none is hovered. */
const deleteHovered = (ctx: ToolContext): boolean => {
  const hover = ctx.get(hoverAtom);
  if (hover?.kind !== 'dimension') return false;
  commitCommands(ctx, 'Delete dimension', [{ type: 'dimension.remove', id: hover.id }]);
  ctx.set(hoverAtom, null);
  return true;
};

/** B, then the offset, on the draft's plane (`on`: the pointer there). */
const placeOnPlane = (ctx: ToolContext, on: ToolPointerEvent): void => {
  const draft = ctx.get(dimensionDraftAtom);
  switch (draft.phase) {
    case 'idle':
      return;
    case 'b':
      if (!samePoint(draft.a, on.snapped)) {
        ctx.set(dimensionDraftAtom, { ...draft, phase: 'offset', b: on.snapped });
      }
      return;
    case 'offset': {
      const { a, b, y } = draft;
      const offset = offsetThrough(a, b, on.snapped);
      const dimension = { id: newId(), a, b, offset, elevation: y };
      commitCommands(ctx, 'Add dimension', [{ type: 'dimension.insert', dimension }]);
      ctx.set(dimensionDraftAtom, DIMENSION_IDLE);
    }
  }
};

/** One step back through the draft; false when there is no draft. */
const stepBack = (ctx: ToolContext): boolean => {
  const draft = ctx.get(dimensionDraftAtom);
  if (draft.phase === 'idle') return false;
  ctx.set(
    dimensionDraftAtom,
    draft.phase === 'offset' ? { phase: 'b', a: draft.a, y: draft.y } : DIMENSION_IDLE
  );
  return true;
};

/**
 * Click A, click B, move aside and click to pin a dimension. It lies flat at the height of
 * the surface under A; in 3D, B and the offset are taken on that plane. While idle, Delete,
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
    if (ctx.get(dimensionDraftAtom).phase === 'idle') updateHover(ctx, e);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const draft = ctx.get(dimensionDraftAtom);
    if (draft.phase === 'idle') {
      updateHover(ctx, e);
      if (e.altKey && deleteHovered(ctx)) return;
      ctx.set(hoverAtom, null);
      const y = roundElevation(clampElevation(e.y));
      ctx.set(dimensionDraftAtom, { phase: 'b', a: e.snapped, y });
      return;
    }
    const on = onPlaneAt(ctx, e, draft.y);
    if (on) placeOnPlane(ctx, on);
  },
  // 3D: B or the offset over the sky, where the draft's plane is still under the pointer.
  onPointerMiss(e, ctx) {
    const draft = ctx.get(dimensionDraftAtom);
    if (e.button !== PRIMARY_BUTTON || draft.phase === 'idle') return;
    const on = onPlaneAt(ctx, e, draft.y);
    if (on) placeOnPlane(ctx, on);
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
