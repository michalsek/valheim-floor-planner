import type { Library } from '../catalog/library';
import { propRect } from '../catalog/propDefs';

import type { WorldBox } from './geometry/box';
import { propCorners } from './geometry/propGeometry';
import { rawOutline } from './rawBoxes';
import { roofGeometry } from './roofs/roofGeometry';
import type { Plan, Vec2 } from './types';
import { underlayRect } from './underlay';

/**
 * The box around everything in the plan (roofs' eaves and the underlay included); null
 * for an empty plan.
 */
export const planBounds = (
  plan: Plan,
  lib: Pick<Library, 'propDefs' | 'catalog' | 'roofFamilies' | 'gableWallSets'>
): WorldBox | null => {
  const underlay = plan.underlay && underlayRect(plan.underlay);
  const points: Vec2[] = [
    ...Object.values(plan.walls).flatMap((run) => run.points),
    ...Object.values(plan.dimensions).flatMap((d) => [d.a, d.b]),
    ...Object.values(plan.floors).flatMap((f) => [f.min, f.max]),
    ...Object.values(plan.props).flatMap((p) =>
      propCorners(p.position, p.rotation, propRect(lib.propDefs, p.prefab))
    ),
    ...Object.values(plan.roofs).flatMap((r) => roofGeometry(r).frame.ring),
    ...Object.values(plan.rawPieces).flatMap((piece) => rawOutline(piece, lib)),
    ...(underlay ? [underlay.min, underlay.max] : []),
  ];
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return {
    min: { x: Math.min(...xs), z: Math.min(...zs) },
    max: { x: Math.max(...xs), z: Math.max(...zs) },
  };
};
