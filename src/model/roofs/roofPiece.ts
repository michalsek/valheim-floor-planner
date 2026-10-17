/** A roof's derived pieces (never stored), and the warnings a roof gets. Pure. */
import type { PieceShape } from '../geometry/shapes';
import type { PlanWarning, RoofId, Vec3 } from '../types';

import type { CellRole } from './roofCells';

export type RoofRole = CellRole | 'gableTri' | 'gablePeak' | 'gableRect' | 'filler';

export interface RoofPiece {
  /** Unique among the plan's boxes: `${roofId}:${i}:${j}` for cells, `${roofId}:g…` for gables. */
  key: string;
  prefab: string;
  material: string;
  sourceId: RoofId;
  role: RoofRole;
  shape: PieceShape;
  /** The middle of the box it covers (absolute height). */
  center: Vec3;
  /** That box in the piece's own frame: x along the eave (or wall), y its rise, z its run. */
  size: Vec3;
  /** Turn about +y (three.js sense) of the piece's own frame. */
  yaw: number;
  /** The roof's slope (radians) for its cells' pieces; 0 for gable walls. */
  slope: number;
  /** Its lattice cell; null for gable walls. */
  cell: { i: number; j: number } | null;
}

export const roofWarning = (
  id: RoofId,
  message: string,
  level: PlanWarning['level'] = 'warning',
  short?: string
): PlanWarning => ({
  source: { kind: 'roof', id },
  segment: null,
  message,
  level,
  ...(short ? { short } : {}),
});
