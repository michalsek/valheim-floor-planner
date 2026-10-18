import { sameLevel } from '../../model/elevation';
import { newId } from '../../model/newId';
import { roofProblem } from '../../model/roofs/roofCheck';
import type { Vec2 } from '../../model/types';
import { selectionAtom } from '../../store/selection';
import { roofsVisibleAtom, toolMinSnapAtom, workDatumAtom } from '../../store/session';
import { isUndoKey } from '../keys';
import { levelView } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext, ToolPointerEvent } from '../types';

import { RoofIcon } from './RoofIcon';
import { RoofOptions } from './RoofOptions';
import { outlineAt, rectOutline } from './roofPlacement';
import { RoofOverlay3d, RoofPreview3d } from './RoofPreview3d';
import { roofSeat, type RoofSeat } from './roofSeat';
import {
  roofDraftAtom,
  roofDragStartAtom,
  roofFromDraft,
  roofSettingsAtom,
  type RoofDraft,
} from './roofState';
import { RoofPreview, RoofWorldPreview } from './RoofWorldPreview';

/** Roofs sit on the 1 m grid. */
const ROOF_MIN_SNAP = 1;

/** What a roof over `outline` drawn on the work level rests on (walls of any level). */
const seatUnder = (ctx: ToolContext, outline: readonly Vec2[]): RoofSeat =>
  roofSeat(Object.values(ctx.plan.getPlan().walls), outline, ctx.get(workDatumAtom));

/** The room (or with Shift the building) under the pointer, as a draft. */
const hoverDraft = (ctx: ToolContext, e: ToolPointerEvent): RoofDraft | null => {
  const plan = levelView(ctx);
  const outline = outlineAt(plan, e.world, e.shiftKey);
  if (!outline) return null;
  return { outline, ...seatUnder(ctx, outline), source: e.shiftKey ? 'building' : 'room' };
};

const dragDraft = (ctx: ToolContext, e: ToolPointerEvent): RoofDraft | null => {
  const start = ctx.get(roofDragStartAtom);
  const outline = start && rectOutline(start, e.snapped);
  if (!outline) return null;
  return { outline, ...seatUnder(ctx, outline), source: 'drag' };
};

const cancel = (ctx: ToolContext): boolean => {
  const busy = ctx.get(roofDragStartAtom) !== null;
  ctx.set(roofDragStartAtom, null);
  ctx.set(roofDraftAtom, null);
  return busy;
};

const sameOutline = (a: readonly Vec2[], b: readonly Vec2[]): boolean => {
  const key = (p: Vec2) => `${p.x},${p.z}`;
  const keys = new Set(a.map(key));
  return a.length === b.length && b.every((p) => keys.has(key(p)));
};

/** Adds the draft's roof, or selects the roof already over that outline on its level. */
const insert = (ctx: ToolContext, draft: RoofDraft): void => {
  // Hidden roofs can't be picked, as on the level view.
  const roofs = ctx.get(roofsVisibleAtom) ? Object.values(ctx.plan.getPlan().roofs) : [];
  const existing = roofs.find(
    (r) => sameLevel(r.elevation, draft.elevation) && sameOutline(r.outline, draft.outline)
  );
  if (existing) {
    ctx.set(selectionAtom, [{ kind: 'roof', id: existing.id }]);
    return;
  }
  const roof = roofFromDraft(draft, ctx.get(roofSettingsAtom), newId());
  if (roofProblem(roof)) return;
  ctx.plan.dispatch({ type: 'roof.insert', roof }, { label: 'Add roof' });
};

/**
 * Roof the room under the pointer (Shift: every room of its building), or drag a
 * rectangle. Esc or Mod+Z mid-drag cancels.
 */
export const roofTool: Tool = {
  id: 'roof',
  label: 'Roof',
  shortcut: 't',
  icon: RoofIcon,
  cursor: 'crosshair',
  onActivate(ctx) {
    ctx.set(toolMinSnapAtom, ROOF_MIN_SNAP);
  },
  onDeactivate(ctx) {
    ctx.set(toolMinSnapAtom, 0);
    cancel(ctx);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    ctx.set(roofDragStartAtom, e.snapped);
  },
  onPointerMove(e, ctx) {
    const dragging = ctx.get(roofDragStartAtom) !== null;
    ctx.set(roofDraftAtom, (dragging && dragDraft(ctx, e)) || hoverDraft(ctx, e));
  },
  onPointerUp(e, ctx) {
    if (ctx.get(roofDragStartAtom) === null) return;
    const draft = dragDraft(ctx, e) ?? hoverDraft(ctx, e);
    ctx.set(roofDragStartAtom, null);
    if (draft) insert(ctx, draft);
    ctx.set(roofDraftAtom, hoverDraft(ctx, e));
  },
  onPointerCancel: cancel,
  onPointerLeave(ctx) {
    if (ctx.get(roofDragStartAtom) === null) ctx.set(roofDraftAtom, null);
  },
  onKeyDown(e, ctx) {
    if (isUndoKey(e) || e.key === 'Escape') return cancel(ctx);
    return false;
  },
  Preview: RoofPreview,
  WorldPreview: RoofWorldPreview,
  Preview3d: RoofPreview3d,
  Overlay3d: RoofOverlay3d,
  Options: RoofOptions,
};
