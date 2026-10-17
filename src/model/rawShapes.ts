/**
 * What an imported raw piece is drawn as, by prefab: the roof families' pieces and the
 * gable walls take M12's roof shapes, diagonal beams a beam, anything else its
 * collider. Pure.
 */
import type { Library } from '../catalog/library';
import { snapExtent, type PieceDef } from '../catalog/pieceDefs';

import type { PieceShape } from './geometry/shapes';
import type { RoofRole } from './roofs/roofPiece';
import type { Vec3 } from './types';

export type RawShapeLib = Pick<Library, 'catalog' | 'roofFamilies' | 'gableWallSets'>;

export interface RawRoofDef {
  role: RoofRole;
  shape: PieceShape;
  /** The roof's slope (radians); 0 for gable walls. */
  slope: number;
  /** The box the piece covers, in its own frame (as `RoofPiece.size`). */
  size: Vec3;
}

const ROLE_SHAPES = [
  ['straight', 'box'],
  ['ridge', 'ridge'],
  ['outer', 'hipCorner'],
  ['inner', 'valleyCorner'],
] as const;

const snapSize = (def: PieceDef, depth?: number): Vec3 => ({
  x: snapExtent(def, 'x'),
  y: snapExtent(def, 'y'),
  z: depth ?? snapExtent(def, 'z'),
});

const buildIndex = (lib: RawShapeLib): Map<string, RawRoofDef> => {
  const index = new Map<string, RawRoofDef>();
  const add = (prefab: string, def: Omit<RawRoofDef, 'size'>, gable: boolean) => {
    const piece = lib.catalog.pieces.get(prefab);
    if (!piece) return;
    const depth = gable ? (piece.colliderSize?.[2] ?? 0.2) : undefined;
    index.set(prefab, { ...def, size: snapSize(piece, depth) });
  };
  for (const family of lib.roofFamilies.values()) {
    for (const pieces of family.pitches.values()) {
      const slope = Math.atan(pieces.k);
      for (const [role, shape] of ROLE_SHAPES) {
        const prefab = pieces[role];
        if (prefab) add(prefab, { role, shape, slope }, false);
      }
    }
  }
  for (const set of lib.gableWallSets.values()) {
    for (const prefab of set.triangles.values()) {
      add(prefab, { role: 'gableTri', shape: 'triangle', slope: 0 }, true);
    }
    for (const prefab of set.peaks.values()) {
      add(prefab, { role: 'gablePeak', shape: 'gablePeak', slope: 0 }, true);
    }
  }
  return index;
};

const indexCache = new WeakMap<object, Map<string, RawRoofDef>>();

/** The roof shape a prefab takes as a raw piece; undefined when it isn't a roof piece. */
export const rawRoofDef = (lib: RawShapeLib, prefab: string): RawRoofDef | undefined => {
  let index = indexCache.get(lib.roofFamilies);
  if (!index) indexCache.set(lib.roofFamilies, (index = buildIndex(lib)));
  return index.get(prefab);
};

/** A diagonal beam: a box along the line between its two snap points. */
export interface RawBeam {
  /** The middle of that line, in the prefab's frame. */
  mid: Vec3;
  length: number;
  /** Its rise (radians, about local z: + lifts its +x end). */
  angle: number;
  thickness: number;
}

/** Two snap points apart in x and y, level in z (26° and 45° beams); null otherwise. */
export const rawBeam = (def: PieceDef | undefined): RawBeam | null => {
  const [a, b] = def?.snapPoints ?? [];
  if (!def || !a || !b || def.snapPoints.length !== 2) return null;
  const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  if (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01 || Math.abs(dz) > 0.01) return null;
  return {
    mid: { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 },
    length: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    thickness: def.colliderSize?.[2] ?? 0.2,
  };
};
