import { boxFromCorners } from '../../model/geometry/box';
import { EPS } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import { floorFamilyIdAtom, toolMinSnapAtom } from '../../store/session';
import { isUndoKey } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { FloorIcon } from './FloorIcon';
import { FloorOptions } from './FloorOptions';
import { FloorPreview } from './FloorPreview';
import { FLOOR_IDLE, floorDragAtom } from './floorState';
import { FloorWorldPreview } from './FloorWorldPreview';

/** Floor tiles are at least 1 m, so the tool snaps to whole metres at least. */
const FLOOR_MIN_SNAP = 1;

const cancel = (ctx: ToolContext): boolean => {
  if (ctx.get(floorDragAtom).phase === 'idle') return false;
  ctx.set(floorDragAtom, FLOOR_IDLE);
  return true;
};

/**
 * Drag a rectangle to lay a floor of the chosen family. Snaps to at least 1 m (Alt
 * turns snapping off). Esc or Mod+Z mid-drag cancels.
 */
export const floorTool: Tool = {
  id: 'floor',
  label: 'Floor',
  shortcut: 'b',
  icon: FloorIcon,
  cursor: 'crosshair',
  onActivate(ctx) {
    ctx.set(toolMinSnapAtom, FLOOR_MIN_SNAP);
  },
  onDeactivate(ctx) {
    ctx.set(toolMinSnapAtom, 0);
    cancel(ctx);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    ctx.set(floorDragAtom, { phase: 'drag', a: e.snapped, b: e.snapped });
  },
  onPointerMove(e, ctx) {
    const drag = ctx.get(floorDragAtom);
    if (drag.phase === 'drag') ctx.set(floorDragAtom, { ...drag, b: e.snapped });
  },
  onPointerUp(e, ctx) {
    const drag = ctx.get(floorDragAtom);
    if (drag.phase === 'idle') return;
    ctx.set(floorDragAtom, FLOOR_IDLE);
    const { min, max } = boxFromCorners(drag.a, e.snapped);
    if (max.x - min.x < EPS || max.z - min.z < EPS) return;
    const floor = { id: newId(), familyId: ctx.get(floorFamilyIdAtom), min, max };
    ctx.plan.dispatch({ type: 'floor.insert', floor }, { label: 'Add floor' });
  },
  onPointerCancel: cancel,
  onKeyDown(e, ctx) {
    if (isUndoKey(e) || e.key === 'Escape') return cancel(ctx);
    return false;
  },
  Preview: FloorPreview,
  WorldPreview: FloorWorldPreview,
  Options: FloorOptions,
};
