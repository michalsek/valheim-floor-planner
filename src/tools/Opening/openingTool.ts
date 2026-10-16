import { wallAt } from '../../model/hitTest';
import { newId } from '../../model/newId';
import type { Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { getDerived } from '../../store/planHooks';
import { openingFamilyAtom } from '../../store/session';
import { hitTolerance } from '../hitTolerance';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { OpeningIcon } from './OpeningIcon';
import { OpeningOptions } from './OpeningOptions';
import { placeOpening, type Placement } from './openingPlacement';
import { OpeningPreview } from './OpeningPreview';
import { openingDefAtom, openingHoverAtom } from './openingState';
import { OpeningWorldPreview } from './OpeningWorldPreview';

const placementAt = (ctx: ToolContext, p: Vec2, free: boolean): Placement | null => {
  const def = ctx.get(openingDefAtom);
  if (!def) return null;
  const plan = ctx.plan.getPlan();
  const { openings } = getDerived(plan);
  return placeOpening(plan, openings, getLibrary().wallFamilies, def, p, hitTolerance(ctx), free);
};

/**
 * Updates the hover placement. Hovering a wall whose family has openings of its own
 * first switches the picker to them; other walls keep the list.
 */
const hover = (ctx: ToolContext, p: Vec2, free: boolean): Placement | null => {
  const plan = ctx.plan.getPlan();
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
    hover(ctx, e.world, e.altKey);
  },
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const placement = hover(ctx, e.world, e.altKey);
    const def = ctx.get(openingDefAtom);
    if (!placement?.valid || !def) return;
    const opening = {
      id: newId(),
      wallId: placement.wallId,
      prefab: def.prefab,
      at: placement.center,
    };
    ctx.plan.dispatch({ type: 'opening.insert', opening }, { label: `Add ${def.label}` });
    hover(ctx, e.world, e.altKey);
  },
  onPointerLeave(ctx) {
    ctx.set(openingHoverAtom, null);
  },
  onDeactivate(ctx) {
    ctx.set(openingHoverAtom, null);
  },
  Preview: OpeningPreview,
  WorldPreview: OpeningWorldPreview,
  Options: OpeningOptions,
};
