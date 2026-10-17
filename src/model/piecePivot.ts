/**
 * Where a piece's model goes: the prefab's pivot in the world, so the model (in its
 * raw local space) lines up with the piece's box. Pure.
 *
 * A placed piece's box is centred on a point of the prefab's local space, its anchor:
 * per axis, the middle of its snap points where the box spans them (lengths and wall
 * heights come from snap extents), else the middle of its collider (thicknesses, floor
 * depths, door panels). The pivot is then `centre − R·anchor`, R the box's turn about +y.
 */
import type { PieceDef, V3 } from '../catalog/pieceDefs';
import { LOAD_BEARING_GROUPS, type PropDef } from '../catalog/propDefs';

import type { Vec3 } from './types';

/** How close a box size must be to a snap extent to count as spanning it (metres). */
const SPAN_EPSILON = 0.02;

const AXES = ['x', 'y', 'z'] as const;

const middle = (values: readonly number[]): number =>
  (Math.min(...values) + Math.max(...values)) / 2;

/** The point of the prefab's local space its box (of `size`) is centred on. */
export const pieceAnchor = (def: PieceDef | undefined, size: Vec3): Vec3 => {
  const anchor = { x: 0, y: 0, z: 0 };
  if (!def) return anchor;
  AXES.forEach((axis, i) => {
    const snaps = def.snapPoints.map((p) => p[i]!);
    const snapSpan = snaps.length > 0 ? Math.max(...snaps) - Math.min(...snaps) : 0;
    if (snapSpan > 0 && Math.abs(snapSpan - size[axis]) < SPAN_EPSILON) {
      anchor[axis] = middle(snaps);
    } else if (def.colliderBounds) {
      const [min, max]: readonly [V3, V3] = def.colliderBounds;
      anchor[axis] = (min[i]! + max[i]!) / 2;
    }
  });
  return anchor;
};

/** `centre − R·local`, R a turn of `rotationY` about +y (three.js sense). */
export const pivotFrom = (centre: Vec3, rotationY: number, local: Vec3): Vec3 => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: centre.x - (cos * local.x + sin * local.z),
    y: centre.y - local.y,
    z: centre.z - (-sin * local.x + cos * local.z),
  };
};

/**
 * How high a prop's pivot sits above its elevation: load-bearing props (poles, beams,
 * stairs) stand on it with their whole collider, so their pivot is lifted by the part
 * below it; other props have their pivot on it.
 */
export const propPivotLift = (def: PropDef | undefined): number =>
  def && LOAD_BEARING_GROUPS.has(def.group) ? -def.heightRange.minY : 0;
