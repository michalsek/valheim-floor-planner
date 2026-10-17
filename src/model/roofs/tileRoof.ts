/**
 * A roof's game pieces: each cell's piece from its family at its pitch, at the height
 * the roof plane puts it (it passes through the wall tops at the outline), the gable
 * walls, the filler courses raising walls the roof passes above, and what doesn't fit
 * as warnings. Pure.
 */
import type { Library } from '../../catalog/library';
import type { RoofFamily, RoofPitchPieces } from '../../catalog/roofFamilies';
import { formatCompact } from '../../format';
import type { PieceShape } from '../geometry/shapes';
import type { Plan, PlanWarning, Roof } from '../types';

import { fillerCourses } from './fillerCourse';
import { gableFill } from './gableWalls';
import type { RoofCell } from './roofCells';
import type { RoofGrowth } from './roofFrame';
import { roofGeometry } from './roofGeometry';
import { roofWarning, type RoofPiece } from './roofPiece';

export type RoofLib = Pick<Library, 'roofFamilies' | 'gableWallSets' | 'wallFamilies' | 'catalog'>;

export interface RoofTiling {
  pieces: RoofPiece[];
  warnings: PlanWarning[];
}

/** The height of the eave line the run is measured from: below the wall tops by the rest run. */
export const eaveHeight = (roof: Roof, k: number): number =>
  roof.elevation + roof.base - k * roofGeometry(roof).frame.restRun;

const SHAPES: Record<RoofCell['role'], PieceShape> = {
  straight: 'box',
  ridge: 'ridge',
  outer: 'hipCorner',
  inner: 'valleyCorner',
};

/** The prefab a cell takes; null when the family has no such piece (the cell stays open). */
const prefabOf = (cell: RoofCell, pieces: RoofPitchPieces): string | null => {
  switch (cell.role) {
    case 'straight':
      return pieces.straight;
    case 'ridge':
      return pieces.ridge;
    case 'outer':
      return pieces.outer;
    case 'inner':
      return pieces.inner;
  }
};

const cellPieces = (
  roof: Roof,
  family: RoofFamily,
  pieces: RoofPitchPieces,
  eaveY: number
): RoofPiece[] =>
  roofGeometry(roof).cells.flatMap((cell): RoofPiece[] => {
    const { k } = pieces;
    const prefab = prefabOf(cell, pieces);
    if (!prefab) return [];
    const rise = k * cell.rise;
    return [
      {
        key: `${roof.id}:${cell.i}:${cell.j}`,
        prefab,
        material: family.material,
        sourceId: roof.id,
        role: cell.role,
        shape: SHAPES[cell.role],
        center: { x: cell.center.x, y: eaveY + k * cell.low + rise / 2, z: cell.center.z },
        size: { x: 2, y: rise, z: 2 },
        yaw: cell.yaw,
        slope: Math.atan(k),
        cell: { i: cell.i, j: cell.j },
      },
    ];
  });

/** What growing to whole cells means for a roof (a shed's high wall says it itself). */
const growthNote = (roof: Roof, growth: RoofGrowth, k: number): PlanWarning | null => {
  const m = formatCompact(k);
  if (growth.kind === 'edge') {
    const message = `Roof edges off the 2 m piece grid: their eaves overhang 1 m more, and the walls under them are raised by ${m} m (filler course added)`;
    return roofWarning(roof.id, message, 'warning', 'off grid');
  }
  if (growth.along) {
    const message = `Length ${formatCompact(growth.wallSpan)} m: the far gable end overhangs 1 m more`;
    return roofWarning(roof.id, message, 'info');
  }
  if (roof.kind === 'shed') return null;
  const message = `Odd span: far wall raised by ${m} m (filler course added)`;
  return roofWarning(roof.id, message, 'warning', 'odd span');
};

/** Warnings without repeats (a hip roof grown on both axes says so once). */
const unique = (warnings: readonly PlanWarning[]): PlanWarning[] =>
  warnings.filter((w, i) => warnings.findIndex((o) => o.message === w.message) === i);

const count = (cells: readonly RoofCell[], test: (c: RoofCell) => boolean): number =>
  cells.filter(test).length;

/** What a roof's shape and family say about it. */
const roofNotes = (roof: Roof, family: RoofFamily, pieces: RoofPitchPieces): PlanWarning[] => {
  const { frame, cells } = roofGeometry(roof);
  const note = (message: string) => roofWarning(roof.id, message, 'info');
  const warn = (message: string, short: string) => roofWarning(roof.id, message, 'warning', short);
  const notes = frame.growth.flatMap((g) => growthNote(roof, g, pieces.k) ?? []);
  if (frame.notchClosed) notes.push(note('The eave closes a notch narrower than two eaves'));
  const ridges = count(cells, (c) => c.role === 'ridge');
  if (roof.kind === 'gable' && ridges === 0) {
    notes.push(note('Even half-run: the slopes meet at a seam, with no ridge piece'));
  }
  const apexes = count(cells, (c) => c.fit === 'apex');
  if (apexes > 0) {
    notes.push(note(`${apexes} hip apex cells have no matching game piece; ridge used`));
  }
  const odd = count(cells, (c) => c.fit === 'fallback');
  if (odd > 0) {
    notes.push(warn(`${odd} cells match no roof piece; straight pieces used`, 'odd cells'));
  }
  if (ridges > 0 && !pieces.ridge) {
    const message = `${family.label} has no ridge piece: use an overhang that makes the half-run even`;
    notes.push(warn(message, 'no ridge piece'));
  }
  const outer = count(cells, (c) => c.role === 'outer');
  if (outer > 0 && !pieces.outer) {
    const message = `${family.label} has no hip corner piece: ${outer} corners left open`;
    notes.push(warn(message, 'no hip corner'));
  }
  const inner = count(cells, (c) => c.role === 'inner');
  if (inner > 0 && !pieces.inner) {
    const message = `${family.label} has no valley piece: ${inner} inner corners left open`;
    notes.push(warn(message, 'no valley piece'));
  }
  return notes;
};

/**
 * The roof's pieces and warnings. `walls` are its level's: a filler course takes the
 * family of the wall it raises.
 */
export const tileRoof = (roof: Roof, lib: RoofLib, walls: Plan['walls'] = {}): RoofTiling => {
  const family = lib.roofFamilies.get(roof.familyId);
  if (!family) {
    const message = `Unknown roof family ${roof.familyId}`;
    return { pieces: [], warnings: [roofWarning(roof.id, message, 'warning', 'unknown family')] };
  }
  const pieces = family.pitches.get(roof.pitch);
  if (!pieces) {
    const message = `${family.label} has no ${roof.pitch}° pieces in this install`;
    return { pieces: [], warnings: [roofWarning(roof.id, message, 'warning', 'no pieces')] };
  }
  const eaveY = eaveHeight(roof, pieces.k);
  const gable = gableFill(roof, pieces.k, eaveY, lib);
  const filler = fillerCourses(roof, pieces.k, eaveY, lib, walls);
  const highWall =
    roof.kind === 'shed' && filler.raises.length > 0
      ? [
          roofWarning(
            roof.id,
            `High wall raised by ${formatCompact(Math.max(...filler.raises))} m to the roof (filler course added)`,
            'info'
          ),
        ]
      : [];
  return {
    pieces: [...cellPieces(roof, family, pieces, eaveY), ...gable.pieces, ...filler.pieces],
    warnings: unique([...roofNotes(roof, family, pieces), ...gable.warnings, ...highWall]),
  };
};
