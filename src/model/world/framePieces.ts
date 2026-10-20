/**
 * World pieces as raw plan pieces in a plan's frame: plan positions from the frame's
 * origin and yaw, absolute heights above its datum (the world height `origin.y`).
 * Shared by an import (`importCluster`) and the sites it reveals later
 * (`revealSites`). Pure.
 */
import type { Library } from '../../catalog/library';
import type { PieceDef } from '../../catalog/pieceDefs';
import { normalizeDeg } from '../geometry/propGeometry';
import { round6 } from '../geometry/round';
import { rawPieceProblem } from '../rawPieces';
import { worldToPlan, type SiteFrame } from '../terrain/siteTerrain';
import type { RawPiece, Vec2 } from '../types';

import { cloudPiece, type CloudPiece, type PieceCloud } from './pieceCloud';

export type ImportLib = Pick<Library, 'catalog' | 'roofFamilies' | 'gableWallSets'>;

export const snapHeights = (def: PieceDef | undefined): number[] =>
  def?.snapPoints.map((p) => p[1]) ?? [];

/** How far a prefab reaches below and above its pivot (snap points, else collider). */
export const heightSpan = (def: PieceDef | undefined): { low: number; high: number } => {
  const snaps = snapHeights(def);
  if (snaps.length > 0) return { low: Math.min(...snaps), high: Math.max(...snaps) };
  const bounds = def?.colliderBounds;
  return bounds ? { low: bounds[0][1], high: bounds[1][1] } : { low: 0, high: 0 };
};

/** A world piece on its way into a plan. */
export interface FramedPiece {
  piece: CloudPiece;
  def: PieceDef | undefined;
  /** Its pivot on the plan, from the frame's origin. */
  plan: Vec2;
  /** Clockwise on screen, in the frame. */
  yaw: number;
}

/** The cloud's pieces `indices` in `frame` (positions from its origin, yaws from its yaw). */
export const framePieces = (
  cloud: PieceCloud,
  indices: readonly number[],
  frame: SiteFrame,
  lib: ImportLib
): FramedPiece[] =>
  indices.map((i) => {
    const piece = cloudPiece(cloud, i);
    return {
      piece,
      def: lib.catalog.pieces.get(piece.prefab),
      plan: worldToPlan(frame, { x: piece.x, z: piece.z }),
      yaw: normalizeDeg(piece.yaw - frame.yaw),
    };
  });

/**
 * `framed` as raw pieces at their absolute heights above `datum`. Throws when a piece
 * can't be stored (hundreds of metres up a cliff from the datum).
 */
export const rawPiecesInFrame = (
  framed: readonly FramedPiece[],
  datum: number,
  idOf: (k: number) => string
): RawPiece[] =>
  framed.map((p, k): RawPiece => {
    const piece: RawPiece = {
      id: idOf(k),
      prefab: p.piece.prefab,
      position: { x: round6(p.plan.x), y: round6(p.piece.y - datum), z: round6(p.plan.z) },
      rotation: { yaw: p.yaw, pitch: p.piece.pitch, roll: p.piece.roll },
    };
    const problem = rawPieceProblem(piece);
    if (problem) throw new Error(`Can't import ${p.piece.prefab}: ${problem}`);
    return piece;
  });
