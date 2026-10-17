import { wallAt } from '../../model/hitTest';
import { newId } from '../../model/newId';
import type { Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { getDerived } from '../../store/planHooks';
import { openingFamilyAtom } from '../../store/session';
import { hitTolerance } from '../hitTolerance';
import { levelView, pickWallPoint } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext, ToolPointerEvent } from '../types';

import { OpeningIcon } from './OpeningIcon';
import { OpeningOptions } from './OpeningOptions';
import { placeOpening, type Placement } from './openingPlacement';
import { OpeningPreview } from './OpeningPreview';
import { OpeningOverlay3d, OpeningPreview3d } from './OpeningPreview3d';
import { openingDefAtom, openingHoverAtom } from './openingState';
import { OpeningWorldPreview } from './OpeningWorldPreview';

const placementAt = (ctx: ToolContext, p: Vec2, free: boolean): Placement | null => {
  const def = ctx.get(openingDefAtom);
  if (!def) return null;
  const plan = levelView(ctx);
  const { openings } = getDerived(plan);
  return placeOpening(plan, openings, getLibrary().wallFamilies, def, p, hitTolerance(ctx), free);
};

/**
 * Updates the hover placement (Alt places freely). Hovering a wall whose family has
 * openings of its own first switches the picker to them; other walls keep the list.
 */
const hover = (ctx: ToolContext, e: ToolPointerEvent): Placement | null => {
  const p = pickWallPoint(ctx, e);
  const free = e.altKey;
  const plan = levelView(ctx);
  const wall = wallAt(plan, p, hitTolerance(ctx), getLibrary().wallFamilies);
  const family = wall && getLibrary().wallFamilies.get(plan.walls[wall.id]?.familyId ?? '');
  if (family && family.openings.length > 0) ctx.set(openingFamilyAtom, family.id);
  const placement = placementAt(ctx, p, free);
  ctx.set(openingHoverAtom, placement);
  return placement;
};

/**
 * Hover a wall to see where the chosen door, gate or grate would go (its start snaps
 * to whole metres along the segment; Alt places it freely); click to cut it in.
 */
export const openingTool: Tool = {
  id: 'opening',
  label: 'Opening',
  shortcut: 'o',
  icon: OpeningIcon,
  cursor: 'crosshair',
  onPointerMove(e, ctx) {
    hover(ctx, e);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const placement = hover(ctx, e);
    const def = ctx.get(openingDefAtom);
    if (!placement?.valid || !def) return;
    const opening = {
      id: newId(),
      wallId: placement.wallId,
      prefab: def.prefab,
      at: placement.center,
    };
    ctx.plan.dispatch({ type: 'opening.insert', opening }, { label: `Add ${def.label}` });
    hover(ctx, e);
  },
  onPointerLeave(ctx) {
    ctx.set(openingHoverAtom, null);
  },
  onDeactivate(ctx) {
    ctx.set(openingHoverAtom, null);
  },
  Preview: OpeningPreview,
  WorldPreview: OpeningWorldPreview,
  Preview3d: OpeningPreview3d,
  Overlay3d: OpeningOverlay3d,
  Options: OpeningOptions,
};
