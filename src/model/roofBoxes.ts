/**
 * Roof pieces as 3D boxes: a straight piece is a slab tilted down its slope, ridges and
 * corners are their shapes, gable walls stand as they are. Used for derived roofs and
 * for imported raw roof pieces. Pure.
 */
import type { Library } from '../catalog/library';

import { boxAxes } from './geometry/orient';
import type { PieceBox } from './pieceBoxes';
import { pieceAnchor, pivotFrom } from './piecePivot';
import type { RoofPiece } from './roofs/roofPiece';

/** A roof slab's thickness (metres): straight roof pieces are drawn as one. */
export const ROOF_SLAB = 0.12;

/** Who a roof box belongs to: a derived roof (default) or an imported raw piece. */
export type RoofBoxOwner = Pick<PieceBox, 'key' | 'item' | 'hit' | 'kind'> & {
  /** Hidden with the Roofs toggle (a derived roof's covering cells). */
  cover: boolean;
};

/**
 * A roof piece's box. A straight piece is a slab tilted down its slope with its
 * underside on the roof plane, so it covers the wall top it rests on; ridges and
 * corners are their shape in their cell's box, lifted as much, so the tops meet; gable
 * walls stand as they are. The model's pivot comes from the cell box, which spans the
 * prefab's snap points. Piece frames are in planner space: downhill is local −z.
 */
export const roofBox = (
  piece: RoofPiece,
  elevation: number,
  lib: Pick<Library, 'catalog'>,
  owner?: RoofBoxOwner
): PieceBox => {
  const item = { kind: 'roof', id: piece.sourceId } as const;
  const anchor = pieceAnchor(lib.catalog.pieces.get(piece.prefab), piece.size);
  const { cover, ...own } = owner ?? {
    key: piece.key,
    item,
    hit: { ...item, distance: 0 },
    kind: 'roof' as const,
    cover: piece.cell !== null,
  };
  const common = {
    ...own,
    material: piece.material,
    group: null,
    odd: false,
    elevation,
    rotationY: piece.yaw,
    prefab: piece.prefab,
    pivot: pivotFrom(piece.center, piece.yaw, anchor),
    ...(cover ? { roofCover: true as const } : {}),
  };
  if (piece.slope === 0) {
    return { ...common, center: piece.center, size: piece.size, shape: piece.shape };
  }
  if (piece.shape !== 'box') {
    const lift = ROOF_SLAB / Math.cos(piece.slope);
    const center = { ...piece.center, y: piece.center.y + lift };
    return { ...common, center, size: piece.size, shape: piece.shape };
  }
  // Tilted so its −z (downhill) end goes down.
  const tiltX = -piece.slope;
  const size = { x: piece.size.x, y: ROOF_SLAB, z: Math.hypot(piece.size.y, piece.size.z) };
  const [, up] = boxAxes({ rotationY: piece.yaw, tiltX });
  const half = ROOF_SLAB / 2;
  const center = {
    x: piece.center.x + up.x * half,
    y: piece.center.y + up.y * half,
    z: piece.center.z + up.z * half,
  };
  return { ...common, center, size, tiltX };
};

/** Roof pieces' boxes, each at its roof's elevation (`elevationOf`). */
export const roofPieceBoxes = (
  pieces: readonly RoofPiece[],
  lib: Pick<Library, 'catalog'>,
  elevationOf: (roofId: string) => number = () => 0
): PieceBox[] => pieces.map((piece) => roofBox(piece, elevationOf(piece.sourceId), lib));
