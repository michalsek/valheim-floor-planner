/**
 * World pieces as raw plan pieces in a plan's frame: plan positions from the frame's
 * origin and yaw, heights from its datum, and each piece on the level of the floor it
 * stands on (the wall rule): roof pieces and gable walls included, a roof course goes
 * with the storey whose floor is under its lowest edge, as a wall does. Shared by an
 * import (`importCluster`) and the sites it reveals later (`revealSites`). Pure.
 */
import type { Library } from '../../catalog/library';
import { FLOOR_TILE_PREFABS } from '../../catalog/pieceClasses';
import type { PieceDef } from '../../catalog/pieceDefs';
import { MAX_ELEVATION, MIN_ELEVATION, roundElevation } from '../elevation';
import { normalizeDeg } from '../geometry/propGeometry';
import { rawPieceProblem } from '../rawPieces';
import { rawRoofDef } from '../rawShapes';
import { worldToPlan, type SiteFrame } from '../terrain/siteTerrain';
import type { RawPiece, Vec2 } from '../types';

import { cloudPiece, type CloudPiece, type PieceCloud } from './pieceCloud';

export type ImportLib = Pick<Library, 'catalog' | 'roofFamilies' | 'gableWallSets'>;

/** A floor level needs this many tiles at its height. */
const MIN_LEVEL_TILES = 2;
/** Floor tops this close are one level (metres). */
export const LEVEL_ROUNDING = 0.05;
/** A piece within this of a level's height (above or below) stands on it. */
const LEVEL_TOLERANCE = 0.1;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

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

/** 0 and every floor top with enough tiles (within the elevation range), lowest first. */
const floorLevels = (tops: readonly number[]): number[] => {
  const counts = new Map<number, number>();
  for (const top of tops) {
    // A floor at the datum, drifted a centimetre or two below it, is level 0.
    const near = Math.abs(top) < LEVEL_TOLERANCE ? 0 : top;
    const key = roundElevation(Math.round(near / LEVEL_ROUNDING) * LEVEL_ROUNDING);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const levels = [...counts]
    .filter(([top, n]) => n >= MIN_LEVEL_TILES && top >= MIN_ELEVATION && top <= MAX_ELEVATION)
    .map(([top]) => top);
  return [...new Set([0, ...levels])].sort((a, b) => a - b);
};

export interface FramedRaw {
  pieces: RawPiece[];
  /** Pieces per level, roofs left out. */
  perLevel: Map<number, number>;
}

/**
 * `framed` as raw pieces at heights from `datum`: on their own floors' levels and
 * `levels` (the plan's, for pieces added to it), each on the highest level at or below
 * where it stands (the lowest, under all of them). Throws when a piece can't be stored
 * (hundreds of metres off every level).
 */
export const rawPiecesInFrame = (
  framed: readonly FramedPiece[],
  datum: number,
  lib: ImportLib,
  idOf: (k: number) => string,
  levels: readonly number[] = []
): FramedRaw => {
  const isTile = (p: FramedPiece) => FLOOR_TILE_PREFABS.has(p.piece.prefab);
  const standsAt = (p: FramedPiece) =>
    p.piece.y - datum + (isTile(p) ? heightSpan(p.def).high : heightSpan(p.def).low);
  const all = [...new Set([...floorLevels(framed.filter(isTile).map(standsAt)), ...levels])].sort(
    (a, b) => a - b
  );
  const levelOf = (p: FramedPiece): number =>
    all.reduce((best, l) => (l <= standsAt(p) + LEVEL_TOLERANCE ? l : best), all[0]!);
  const isRoof = (p: FramedPiece) => rawRoofDef(lib, p.piece.prefab) !== undefined;

  const perLevel = new Map<number, number>();
  const pieces = framed.map((p, k): RawPiece => {
    const elevation = levelOf(p);
    if (!isRoof(p)) perLevel.set(elevation, (perLevel.get(elevation) ?? 0) + 1);
    const piece: RawPiece = {
      id: idOf(k),
      prefab: p.piece.prefab,
      position: {
        x: round6(p.plan.x),
        y: round6(p.piece.y - datum - elevation),
        z: round6(p.plan.z),
      },
      rotation: { yaw: p.yaw, pitch: p.piece.pitch, roll: p.piece.roll },
      elevation,
    };
    // A build reaching hundreds of metres up a cliff from its lowest piece.
    const problem = rawPieceProblem(piece);
    if (problem) throw new Error(`Can't import ${p.piece.prefab}: ${problem}`);
    return piece;
  });
  return { pieces, perLevel };
};
