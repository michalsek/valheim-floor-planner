/** Where the 3D view's level plate lies on the plan. Pure. */
import type { WorldBox } from '../../model/geometry/box';
import type { Bounds3 } from '../../model/geometry/bounds3';

/** How far the plate reaches past the plan (metres), before snapping. */
export const PLATE_MARGIN = 4;
/** The plate's edges lie on this grid (metres): the 2 m grid lines. */
const PLATE_SNAP = 2;
/** Half the side of the plate of an empty plan, about the origin. */
const EMPTY_HALF = 12;

const down = (v: number) => Math.floor(v / PLATE_SNAP) * PLATE_SNAP;
const up = (v: number) => Math.ceil(v / PLATE_SNAP) * PLATE_SNAP;

/**
 * The plate under a plan with these bounds: its plan extent plus `PLATE_MARGIN`,
 * snapped out to the 2 m grid; a 24 m square on the origin without bounds.
 */
export const plateRect = (bounds: Bounds3 | null): WorldBox => {
  if (!bounds) {
    return { min: { x: -EMPTY_HALF, z: -EMPTY_HALF }, max: { x: EMPTY_HALF, z: EMPTY_HALF } };
  }
  const { min, max } = bounds;
  return {
    min: { x: down(min.x - PLATE_MARGIN), z: down(min.z - PLATE_MARGIN) },
    max: { x: up(max.x + PLATE_MARGIN), z: up(max.z + PLATE_MARGIN) },
  };
};
