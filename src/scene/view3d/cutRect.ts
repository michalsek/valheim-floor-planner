/** Where the 3D view's cut outline lies on the plan. Pure. */
import type { WorldBox } from '../../model/geometry/box';
import type { Bounds3 } from '../../model/geometry/bounds3';

/** How far the outline stands off the shown pieces (metres): close, so it hugs the build. */
export const CUT_MARGIN = 0.5;

/** The cut outline around shown pieces with these bounds; null without any. */
export const cutRect = (bounds: Bounds3 | null): WorldBox | null =>
  bounds && {
    min: { x: bounds.min.x - CUT_MARGIN, z: bounds.min.z - CUT_MARGIN },
    max: { x: bounds.max.x + CUT_MARGIN, z: bounds.max.z + CUT_MARGIN },
  };
