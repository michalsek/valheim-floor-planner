/**
 * Raw pieces (imported game pieces kept as they are): the rules a stored one meets
 * (commands and file parsing share them), and the prefab's collider from the catalogue
 * (`rawBoxes.ts` places it). Pure.
 */
import type { Library } from '../catalog/library';
import type { PieceDef } from '../catalog/pieceDefs';
import { APPROX_RECT, type LocalRect } from '../catalog/propDefs';

import { elevationProblem } from './elevation';
import type { RawPiece } from './types';

/** Raw pieces per plan: a large base is a few thousand. */
export const MAX_RAW_PIECES = 20_000;
/** How far a piece may sit above or below its level (metres). */
export const MAX_RAW_HEIGHT = 256;

type CatalogLib = Pick<Library, 'catalog'>;

const finite = (...values: number[]): boolean => values.every(Number.isFinite);

/** Why `piece` can't be stored, or null when it can. */
export const rawPieceProblem = (piece: RawPiece): string | null => {
  const { position: p, rotation: r } = piece;
  if (piece.prefab.length === 0) return 'a piece needs a prefab';
  if (!finite(p.x, p.y, p.z)) return 'a piece needs a finite position';
  if (Math.abs(p.y) > MAX_RAW_HEIGHT)
    return `a piece sits at most ${MAX_RAW_HEIGHT} m off its level`;
  if (!finite(r.yaw, r.pitch, r.roll)) return 'a piece needs a finite rotation';
  return elevationProblem(piece.elevation);
};

/** The collider's footprint in the prefab's local plan (a 1 × 1 stand-in without one). */
export const rawRect = (def: PieceDef | undefined): LocalRect => {
  const bounds = def?.colliderBounds;
  if (!bounds) return APPROX_RECT;
  const [min, max] = bounds;
  return { minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2] };
};

/** The collider's height span about the pivot (a 1 m stand-in standing on it). */
export const rawSpan = (def: PieceDef | undefined): { minY: number; maxY: number } => {
  const bounds = def?.colliderBounds;
  return bounds ? { minY: bounds[0][1], maxY: bounds[1][1] } : { minY: 0, maxY: 1 };
};

export const rawDef = (lib: CatalogLib, piece: Pick<RawPiece, 'prefab'>): PieceDef | undefined =>
  lib.catalog.pieces.get(piece.prefab);
