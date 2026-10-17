/**
 * The walls filling a gable roof's two ends (and a shed's two sides), between the wall
 * tops and the roof. Along each end wall, from its low corners up to the ridge, each
 * 2 m column takes a triangle under the roof and wall pieces below it (falling back to
 * log beams for a 0.5 m strip). A column left across the ridge (an odd half-span) takes
 * the "Roof Cross" piece. Pure.
 */
import { EPS } from '../geometry/polyline';
import { ringBox } from '../geometry/rings';
import type { PlanWarning, Roof } from '../types';

import { yawFor } from './roofCells';
import { eaveAxis } from './roofFrame';
import { roofGeometry } from './roofGeometry';
import { roofWarning, type RoofPiece } from './roofPiece';
import type { RoofLib } from './tileRoof';
import {
  coursePieces,
  familiesFrom,
  fillWithFamilies,
  pointAlongLine,
  type WallLine,
} from './wallCourse';

const COLUMN = 2;
/** A gable wall's thickness when its piece has no collider (metres). */
const DEFAULT_THICKNESS = 0.2;

interface EndWall extends WallLine {
  length: number;
}

/** The two end walls: across the eaves, at the outline's ends. */
const endWalls = (roof: Roof): EndWall[] => {
  const { min, max, w, d } = ringBox(roof.outline);
  return eaveAxis(roof) === 'x'
    ? [min.x, max.x].map((x) => ({ start: { x, z: min.z }, dir: { x: 0, z: 1 }, length: d }))
    : [min.z, max.z].map((z) => ({ start: { x: min.x, z }, dir: { x: 1, z: 0 }, length: w }));
};

const along = pointAlongLine;

interface Column {
  /** Its low end and its high end along the wall (metres from the start). */
  from: number;
  to: number;
}

/** Columns from both corners up to the ridge, and what is left across it. */
const columnsOf = (length: number, ridge: number): { columns: Column[]; gap: Column | null } => {
  const columns: Column[] = [];
  let left = 0;
  while (left + COLUMN <= ridge + EPS) {
    columns.push({ from: left, to: left + COLUMN });
    left += COLUMN;
  }
  let right = length;
  while (right - COLUMN >= ridge - EPS && right - COLUMN >= left - EPS) {
    columns.push({ from: right, to: right - COLUMN });
    right -= COLUMN;
  }
  return { columns, gap: right - left > EPS ? { from: left, to: right } : null };
};

/** Where along an end wall the roof is highest: a gable's ridge, a shed's high end. */
const highAt = (roof: Roof, wall: EndWall): number => {
  const ring = ringBox(roofGeometry(roof).frame.ring);
  if (roof.kind === 'shed') return roof.lowSide.startsWith('-') ? wall.length : 0;
  return eaveAxis(roof) === 'x'
    ? (ring.min.z + ring.max.z) / 2 - wall.start.z
    : (ring.min.x + ring.max.x) / 2 - wall.start.x;
};

export const gableFill = (
  roof: Roof,
  k: number,
  eaveY: number,
  lib: RoofLib
): { pieces: RoofPiece[]; warnings: PlanWarning[] } => {
  const none = { pieces: [], warnings: [] };
  if (roof.kind === 'hip' || roof.gableWalls === 'none') return none;
  const set = lib.gableWallSets.get(roof.gableWalls);
  const triangle = set?.triangles.get(roof.pitch);
  if (!set || !triangle || !lib.wallFamilies.has(set.wallFamilyId)) {
    const message = `No ${roof.gableWalls} ${roof.pitch}° gable walls in this install`;
    return { pieces: [], warnings: [roofWarning(roof.id, message, 'warning', 'no gable walls')] };
  }
  const families = familiesFrom(lib, set.wallFamilyId);
  const { frame } = roofGeometry(roof);
  const top = roof.elevation + roof.base;
  const def = (prefab: string) => lib.catalog.pieces.get(prefab);
  const thicknessOf = (prefab: string) => def(prefab)?.colliderSize?.[2] ?? DEFAULT_THICKNESS;
  const materialOf = (prefab: string) => def(prefab)?.material ?? 'wood';
  const peak = set.peaks.get(roof.pitch);

  const pieces: RoofPiece[] = [];
  const problems = new Set<string>();
  endWalls(roof).forEach((wall, end) => {
    const roofAt = (s: number) => eaveY + k * frame.run(along(wall, s));
    const { columns, gap } = columnsOf(wall.length, highAt(roof, wall));
    let n = 0;
    const key = () => `${roof.id}:g${end}:${n++}`;
    const add = (piece: Omit<RoofPiece, 'key' | 'sourceId' | 'material' | 'slope' | 'cell'>) =>
      pieces.push({
        ...piece,
        key: key(),
        sourceId: roof.id,
        material: materialOf(piece.prefab),
        slope: 0,
        cell: null,
      });
    /** Wall pieces from the wall top up to `upTo` over [a, b] along the wall. */
    const rectangles = (a: number, b: number, upTo: number) => {
      if (upTo - top < EPS) return;
      const { placed } = fillWithFamilies(families, COLUMN, upTo - top);
      pieces.push(
        ...coursePieces(placed, wall, Math.min(a, b), top, {
          role: 'gableRect',
          sourceId: roof.id,
          key,
          materialOf,
        })
      );
    };
    for (const { from, to } of columns) {
      const low = roofAt(from);
      const up = { x: wall.dir.x * Math.sign(to - from), z: wall.dir.z * Math.sign(to - from) };
      const mid = along(wall, (from + to) / 2);
      add({
        prefab: triangle,
        role: 'gableTri',
        shape: 'triangle',
        center: { x: mid.x, y: low + k, z: mid.z },
        size: { x: COLUMN, y: 2 * k, z: thicknessOf(triangle) },
        yaw: yawFor({ x: 1, z: 0 }, up),
      });
      rectangles(from, to, low);
    }
    if (!gap) return;
    if (Math.abs(gap.to - gap.from - COLUMN) > EPS) {
      problems.add('The gable walls leave a gap under the ridge');
      return;
    }
    const low = roofAt(gap.from);
    rectangles(gap.from, gap.to, low);
    if (!peak) {
      problems.add(
        `${set.label} has no piece for the gable peak: a 2 m column under the ridge is open`
      );
      return;
    }
    const mid = along(wall, (gap.from + gap.to) / 2);
    add({
      prefab: peak,
      role: 'gablePeak',
      shape: 'gablePeak',
      center: { x: mid.x, y: low + k, z: mid.z },
      size: { x: COLUMN, y: 2 * k, z: thicknessOf(peak) },
      yaw: yawFor({ x: 1, z: 0 }, wall.dir),
    });
  });
  const warnings = [...problems].map((m) => roofWarning(roof.id, m, 'warning', 'gable gap'));
  if (pieces.some((p) => p.role === 'gablePeak')) {
    const message = 'The gable peak uses the Roof Cross piece (unverified in game)';
    warnings.push(roofWarning(roof.id, message, 'info'));
  }
  return { pieces, warnings };
};
