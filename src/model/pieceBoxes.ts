/**
 * The plan as boxes in 3D: every prop and raw piece, at its real size and height. Pure;
 * the 3D view draws them as instances, tools draw their previews with the per-kind
 * builders, picking casts rays against them (`geometry/ray.ts`) and the support check
 * takes them as its bodies (`support/`).
 *
 * Vertical convention: a prop stands on its elevation at its collider's height span
 * (stairs, ladders, poles and beams with their whole collider; see `propSpan`). A raw
 * piece's pivot is at its elevation plus its own `position.y`, and its box is the
 * prefab's collider (or roof shape) about that pivot (`rawBoxes.ts`).
 */
import type { Library } from '../catalog/library';
import {
  APPROX_HEIGHT,
  LOAD_BEARING_GROUPS,
  propRect,
  type PropDef,
  type PropGroup,
} from '../catalog/propDefs';

import type { Bounds3 } from './geometry/bounds3';
import { boxCorners } from './geometry/orient';
import type { PieceShape } from './geometry/shapes';
import { propCentre } from './geometry/propGeometry';
import type { Hit } from './hitTest';
import { propPivotLift } from './piecePivot';
import { propArea } from './props';
import { rawBox } from './rawBoxes';
import type { SelectionItem } from './selection';
import type { Plan, Prop, Vec3 } from './types';

export type PieceBoxKind = 'prop' | 'raw';

export interface PieceBox {
  /** Unique among the boxes of one plan. */
  key: string;
  /** The plan object the box belongs to. */
  item: SelectionItem;
  /** What hovering the box means, as the 2D hit test would say it. */
  hit: Hit;
  kind: PieceBoxKind;
  /** The piece's or prop's material; null when unknown. */
  material: string | null;
  /** The prop's group; null for pieces (and unknown props). */
  group: PropGroup | null;
  /** The elevation of the plan object it belongs to (its level). */
  elevation: number;
  center: Vec3;
  size: Vec3;
  /** Turn about +y (radians, three.js sense: counter-clockwise seen from above). */
  rotationY: number;
  /** Tilt about the box's own x axis after the turn (a roof slab down its slope). */
  tiltX?: number;
  /** Roll about the box's own z axis after the tilt (a diagonal beam up its rise). */
  rollZ?: number;
  /** What the box holds, when not a solid box (roof corners, gable triangles). */
  shape?: PieceShape;
  /** A roof's covering piece (not its gable walls): hidden with roofs. */
  roofCover?: true;
  /** The piece's or prop's prefab (its model); null when unknown. */
  prefab: string | null;
  /**
   * Where the prefab's pivot goes, for its model (`piecePivot.ts`). Models turn by
   * `rotationY` only (a roof piece's model is already sloped), unless `modelTurn` says.
   */
  pivot: Vec3;
  /**
   * The model's own turn, Euler 'YXZ' radians, when it isn't `rotationY` alone (an
   * imported piece placed tilted). The box's `tiltX` and `rollZ` shape the box only.
   */
  modelTurn?: Vec3;
}

const DEG = Math.PI / 180;

/** The shortest prop box, so a prop whose collider is all below its pivot still shows. */
const MIN_PROP_HEIGHT = 0.1;

/**
 * Where a prop's box sits above its elevation. Stairs, ladders, poles and beams stand
 * there with their whole collider (a pole's pivot is at its middle); other props with
 * the part above their pivot, as a collider reaching below it (a floor brazier, a
 * torch's spike) would otherwise sink into the floor.
 */
export const propSpan = (def: PropDef | undefined): { bottom: number; height: number } => {
  const range = def?.heightRange ?? APPROX_HEIGHT;
  if (def && LOAD_BEARING_GROUPS.has(def.group)) {
    return { bottom: 0, height: range.maxY - range.minY };
  }
  const bottom = Math.max(range.minY, 0);
  return { bottom, height: Math.max(range.maxY - bottom, MIN_PROP_HEIGHT) };
};

/** A prop's collider box, standing on its elevation (see `propSpan`). */
export const propBox = (
  prop: Pick<Prop, 'id' | 'prefab' | 'position' | 'rotation' | 'elevation'>,
  lib: Pick<Library, 'propDefs'>
): PieceBox => {
  const def = lib.propDefs.get(prop.prefab);
  const rect = propRect(lib.propDefs, prop.prefab);
  const span = propSpan(def);
  const height = span.height;
  const bottom = prop.elevation + span.bottom;
  const centre = propCentre(prop.position, prop.rotation, rect);
  const item = { kind: 'prop', id: prop.id } as const;
  return {
    key: `prop:${prop.id}`,
    item,
    hit: { ...item, area: propArea(lib.propDefs, prop.prefab) },
    kind: 'prop',
    material: def?.material ?? null,
    group: def?.group ?? null,
    elevation: prop.elevation,
    center: { x: centre.x, y: bottom + height / 2, z: centre.z },
    size: { x: rect.maxX - rect.minX, y: height, z: rect.maxZ - rect.minZ },
    rotationY: -prop.rotation * DEG,
    prefab: prop.prefab,
    pivot: { x: prop.position.x, y: prop.elevation + propPivotLift(def), z: prop.position.z },
  };
};

/** Every prop and raw piece of the plan, each at its own elevation: props first. */
export const pieceBoxes = (
  plan: Plan,
  lib: Pick<Library, 'propDefs' | 'catalog' | 'roofFamilies' | 'gableWallSets'>
): PieceBox[] => [
  ...Object.values(plan.props).map((prop) => propBox(prop, lib)),
  ...Object.values(plan.rawPieces).map((piece) => rawBox(piece, lib)),
];

/** The axis-aligned box around every box (turns, tilts and shapes included); null when there are none. */
export const boxesBounds = (boxes: readonly PieceBox[]): Bounds3 | null => {
  if (boxes.length === 0) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const box of boxes) {
    for (const corner of boxCorners(box)) {
      for (const axis of ['x', 'y', 'z'] as const) {
        min[axis] = Math.min(min[axis], corner[axis]);
        max[axis] = Math.max(max[axis], corner[axis]);
      }
    }
  }
  return { min, max };
};
