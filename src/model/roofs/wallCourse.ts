/**
 * Wall pieces a roof adds on a wall line: the rectangles under its gable triangles, and
 * the filler course that raises a wall to the roof (the far wall of an odd span, a
 * shed's high wall). A course is filled from a list of wall families, each filling what
 * the ones before it leave, so a 0.5 m strip falls to log beams. Pure.
 */
import type { Library } from '../../catalog/library';
import type { WallFamily } from '../../catalog/wallFamilies';
import { fillFace, type FilledPiece, type UnfilledRect } from '../fillFace';
import type { Vec2 } from '../types';

import { yawFor } from './roofCells';
import type { RoofPiece, RoofRole } from './roofPiece';

/** The families a course falls back to: wood walls, then log beams (0.5 m courses). */
export const FALLBACK_FAMILIES = ['wood', 'log'] as const;

/** `length × height` filled from `families` in order; what none of them fills is left. */
export const fillWithFamilies = (
  families: readonly WallFamily[],
  length: number,
  height: number
): { placed: FilledPiece[]; unfilled: UnfilledRect[] } => {
  let open: UnfilledRect[] = [{ offset: 0, base: 0, length, height }];
  const placed: FilledPiece[] = [];
  for (const family of families) {
    const next: UnfilledRect[] = [];
    for (const rect of open) {
      const fill = fillFace(family.pieces, rect.length, rect.height);
      for (const p of fill.placed) {
        placed.push({ ...p, offset: p.offset + rect.offset, base: p.base + rect.base });
      }
      for (const u of fill.unfilled) {
        next.push({ ...u, offset: u.offset + rect.offset, base: u.base + rect.base });
      }
    }
    open = next;
  }
  return { placed, unfilled: open };
};

/** `first` (when known) and the fallback families, without repeats. */
export const familiesFrom = (
  lib: Pick<Library, 'wallFamilies'>,
  first: string | null
): WallFamily[] =>
  [...new Set([...(first ? [first] : []), ...FALLBACK_FAMILIES])].flatMap((id) => {
    const family = lib.wallFamilies.get(id);
    return family ? [family] : [];
  });

/** A wall line: its first point and its direction (unit). */
export interface WallLine {
  start: Vec2;
  dir: Vec2;
}

export const pointAlongLine = (line: WallLine, s: number): Vec2 => ({
  x: line.start.x + line.dir.x * s,
  z: line.start.z + line.dir.z * s,
});

/**
 * Roof pieces for wall pieces filled from `from` metres along `line`, standing on
 * `bottom` (absolute height). `key(n)` names the n-th.
 */
export const coursePieces = (
  placed: readonly FilledPiece[],
  line: WallLine,
  from: number,
  bottom: number,
  piece: {
    role: RoofRole;
    sourceId: string;
    key(n: number): string;
    materialOf(prefab: string): string;
  }
): RoofPiece[] =>
  placed.map(({ piece: def, offset, base }, n) => {
    const mid = pointAlongLine(line, from + offset + def.length / 2);
    return {
      key: piece.key(n),
      prefab: def.prefab,
      material: piece.materialOf(def.prefab),
      sourceId: piece.sourceId,
      role: piece.role,
      shape: 'box',
      center: { x: mid.x, y: bottom + base + def.height / 2, z: mid.z },
      size: { x: def.length, y: def.height, z: def.thickness },
      yaw: yawFor({ x: 1, z: 0 }, line.dir),
      slope: 0,
      cell: null,
    };
  });
