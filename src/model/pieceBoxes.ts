/**
 * The plan as boxes in 3D: every derived piece and every prop, at its real size and
 * height. Pure; the 3D view draws them as instances and picks them by raycast.
 *
 * Vertical convention: a level's walking surface is its datum. Floors hang below it
 * (top at the datum, bottom at datum − thickness); walls, openings and props stand on
 * it (at datum + `piece.base`, props at their collider's height span).
 */
import type { Library } from '../catalog/library';
import { APPROX_HEIGHT, propRect, type PropGroup } from '../catalog/propDefs';

import type { Derived } from './derivePlan';
import { boxArea } from './geometry/box';
import type { Bounds3 } from './geometry/bounds3';
import { propCentre } from './geometry/propGeometry';
import type { Hit } from './hitTest';
import { propArea } from './props';
import type { SelectionItem } from './selection';
import { isOddTile } from './splitFloor';
import type { PlacedPiece, Plan, Prop, Vec3 } from './types';

export type PieceBoxKind = 'wall' | 'floor' | 'opening' | 'prop';

export interface PieceBox {
  /** Unique among the boxes of one plan. */
  key: string;
  /** The plan object the box belongs to. */
  item: SelectionItem;
  /** What hovering the box means, as the 2D hit test would say it. */
  hit: Hit;
  kind: PieceBoxKind;
  /** The piece's material; null for props. */
  material: string | null;
  /** The prop's group; null for pieces (and unknown props). */
  group: PropGroup | null;
  /** The darker shade of a floor's checkerboard. */
  odd: boolean;
  center: Vec3;
  size: Vec3;
  /** Turn about +y (radians, three.js sense: counter-clockwise seen from above). */
  rotationY: number;
}

/** Door and gate panels are drawn this thin at most, so the gap still reads as one. */
export const PANEL_THICKNESS = 0.12;

const DEG = Math.PI / 180;

/** The shortest prop box, so a prop whose collider is all below its pivot still shows. */
const MIN_PROP_HEIGHT = 0.1;

const hitOf = (piece: PlacedPiece, plan: Plan): Hit => {
  const id = piece.sourceId;
  switch (piece.kind) {
    case 'wall':
      return { kind: 'wall', id, segment: piece.segment, distance: 0 };
    case 'opening':
      return { kind: 'opening', id, distance: 0 };
    case 'floor': {
      const floor = plan.floors[id];
      return { kind: 'floor', id, area: floor ? boxArea(floor) : 0 };
    }
  }
};

const pieceBox = (piece: PlacedPiece, plan: Plan, datum: number): PieceBox => {
  const { length, thickness } = piece.footprint;
  const across = piece.kind === 'opening' ? Math.min(PANEL_THICKNESS, thickness) : thickness;
  const bottom = piece.kind === 'floor' ? datum - piece.height : datum + piece.base;
  return {
    key: piece.key,
    item: { kind: piece.kind, id: piece.sourceId },
    hit: hitOf(piece, plan),
    kind: piece.kind,
    material: piece.material,
    group: null,
    odd: piece.kind === 'floor' && isOddTile(piece),
    center: { x: piece.center.x, y: bottom + piece.height / 2, z: piece.center.z },
    size: { x: length, y: piece.height, z: across },
    // The plan's angle turns +x towards +z (clockwise seen from above).
    rotationY: -piece.rotation,
  };
};

const propBox = (prop: Prop, lib: Pick<Library, 'propDefs'>, datum: number): PieceBox => {
  const def = lib.propDefs.get(prop.prefab);
  const rect = propRect(lib.propDefs, prop.prefab);
  const range = def?.heightRange ?? APPROX_HEIGHT;
  // Props stand on the datum: a collider reaching below the pivot (a floor brazier, a
  // torch's spike, a lantern pole) would otherwise be drawn underground. M11 may give
  // props a real base (a floor's top, a wall) instead.
  const minY = Math.max(range.minY, 0);
  const maxY = Math.max(range.maxY, minY + MIN_PROP_HEIGHT);
  const centre = propCentre(prop.position, prop.rotation, rect);
  const item = { kind: 'prop', id: prop.id } as const;
  return {
    key: `prop:${prop.id}`,
    item,
    hit: { ...item, area: propArea(lib.propDefs, prop.prefab) },
    kind: 'prop',
    material: null,
    group: def?.group ?? null,
    odd: false,
    center: { x: centre.x, y: datum + (minY + maxY) / 2, z: centre.z },
    size: { x: rect.maxX - rect.minX, y: maxY - minY, z: rect.maxZ - rect.minZ },
    rotationY: -prop.rotation * DEG,
  };
};

/** Every piece (all courses) and prop of a level whose walking surface is at `datum`. */
export const pieceBoxes = (
  derived: Pick<Derived, 'pieces'>,
  plan: Plan,
  lib: Pick<Library, 'propDefs'>,
  datum = 0
): PieceBox[] => [
  ...derived.pieces.map((piece) => pieceBox(piece, plan, datum)),
  ...Object.values(plan.props).map((prop) => propBox(prop, lib, datum)),
];

/** The axis-aligned box around every box (turns included); null when there are none. */
export const boxesBounds = (boxes: readonly PieceBox[]): Bounds3 | null => {
  if (boxes.length === 0) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const { center, size, rotationY } of boxes) {
    const cos = Math.abs(Math.cos(rotationY));
    const sin = Math.abs(Math.sin(rotationY));
    const half = {
      x: (size.x * cos + size.z * sin) / 2,
      y: size.y / 2,
      z: (size.x * sin + size.z * cos) / 2,
    };
    for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] = Math.min(min[axis], center[axis] - half[axis]);
      max[axis] = Math.max(max[axis], center[axis] + half[axis]);
    }
  }
  return { min, max };
};
