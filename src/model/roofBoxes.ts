/**
 * Raw roof pieces as 3D boxes (`rawBoxes.ts`): a straight piece is a slab tilted down
 * its slope, ridges and corners are their shapes, gable walls stand as they are. Pure.
 */
import type { Library } from '../catalog/library';

import { boxAxes } from './geometry/orient';
import type { PieceShape } from './geometry/shapes';
import type { PieceBox } from './pieceBoxes';
import { pieceAnchor, pivotFrom } from './piecePivot';
import type { Vec3 } from './types';

/** A roof slab's thickness (metres): straight roof pieces are drawn as one. */
const ROOF_SLAB = 0.12;

/** What a roof prefab is in its family: a cover piece, or a gable wall. */
export type RoofRole = 'straight' | 'ridge' | 'outer' | 'inner' | 'gableTri' | 'gablePeak';

/** A placed roof piece, as `roofBody` reads it. */
export interface RoofPiece {
  prefab: string;
  shape: PieceShape;
  /** The middle of the box its snap points span (absolute height). */
  center: Vec3;
  /** That box in the piece's own frame: x along the eave (or wall), y its rise, z its run. */
  size: Vec3;
  /** Turn about +y (three.js sense) of the piece's own frame. */
  yaw: number;
  /** The slope (radians) of a cover piece; 0 for gable walls. */
  slope: number;
}

/** The fields of a box that a roof piece's shape decides. */
export type RoofBody = Pick<
  PieceBox,
  'center' | 'size' | 'rotationY' | 'tiltX' | 'shape' | 'pivot'
>;

/**
 * A roof piece's box. A straight piece is a slab tilted down its slope with its
 * underside on the roof plane, so it covers the wall top it rests on; ridges and
 * corners are their shape in the box its snap points span, lifted as much, so the tops
 * meet; gable walls stand as they are. The model's pivot comes from that box. Piece
 * frames are in planner space: downhill is local −z.
 */
export const roofBody = (piece: RoofPiece, lib: Pick<Library, 'catalog'>): RoofBody => {
  const anchor = pieceAnchor(lib.catalog.pieces.get(piece.prefab), piece.size);
  const common = { rotationY: piece.yaw, pivot: pivotFrom(piece.center, piece.yaw, anchor) };
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
