/** Roof edits the Inspector makes: settings, wall top, and re-fitting to the room. */
import { ringArea, ringBox, pointInRing } from '../../model/geometry/rings';
import { levelPlan } from '../../model/levels';
import type { Roof, Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { commitCommands } from '../Select/selectActions';
import type { ToolContext } from '../types';

import { outlineAt } from './roofPlacement';
import { roofSeat } from './roofSeat';
import { isRectangle } from './roofState';
import type { RoofFields } from './RoofSettingsFields';

/** The roof's fields as the settings fields show them. */
export const roofFields = (roof: Roof): RoofFields => ({
  familyId: roof.familyId,
  pitch: roof.pitch,
  kind: roof.kind,
  ridge: roof.ridgeAxis,
  lowSide: roof.lowSide,
  eave: roof.overhang.eave,
  gable: roof.overhang.gable,
  gableWalls: roof.gableWalls,
});

/** Settings-field changes as roof changes. */
export const roofChanges = (roof: Roof, changes: Partial<RoofFields>): Partial<Roof> => {
  const { ridge, lowSide, eave, gable, ...rest } = changes;
  return {
    ...rest,
    ...(ridge && ridge !== 'auto' ? { ridgeAxis: ridge } : {}),
    ...(lowSide && lowSide !== 'auto' ? { lowSide } : {}),
    ...(eave !== undefined || gable !== undefined
      ? { overhang: { eave: eave ?? roof.overhang.eave, gable: gable ?? roof.overhang.gable } }
      : {}),
  };
};

export const patchRoof = (ctx: ToolContext, roof: Roof, changes: Partial<Roof>, label: string) =>
  commitCommands(ctx, label, [{ type: 'roof.patch', id: roof.id, changes }]);

/** The middle of the outline's 1 m square nearest its centre (walls may have moved). */
const insidePoint = (outline: readonly Vec2[]): Vec2 | null => {
  const { min, max } = ringBox(outline);
  const centre = { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 };
  let best: Vec2 | null = null;
  for (let z = min.z + 0.5; z < max.z; z++) {
    for (let x = min.x + 0.5; x < max.x; x++) {
      const p = { x, z };
      const nearer =
        !best ||
        Math.hypot(x - centre.x, z - centre.z) < Math.hypot(best.x - centre.x, best.z - centre.z);
      if (nearer && pointInRing(p, outline)) best = p;
    }
  }
  return best;
};

/**
 * Re-reads the room under the roof (its building when the roof covered more than the
 * room) and the wall tops around it, seating it on lower walls that reach its level
 * (`roofSeat`); roofs don't follow wall edits by themselves. False when there is no
 * room under it.
 */
export const refitRoof = (ctx: ToolContext, roof: Roof): boolean => {
  const all = ctx.plan.getPlan();
  const walls = Object.values(all.walls);
  const p = insidePoint(roof.outline);
  if (!p) return false;
  // The rooms of the level whose walls hold it up (a roof drawn at their tops).
  const plan = levelPlan(all, roofSeat(walls, roof.outline, roof.elevation).elevation, getLibrary());
  const room = outlineAt(plan, p, false);
  if (!room) return false;
  const building = ringArea(roof.outline) > ringArea(room) ? outlineAt(plan, p, true) : null;
  const outline = building ?? room;
  const changes: Partial<Roof> = {
    outline,
    ...roofSeat(walls, outline, roof.elevation),
    ...(isRectangle(outline) ? {} : { kind: 'hip' }),
  };
  return patchRoof(ctx, roof, changes, 'Re-fit roof');
};
