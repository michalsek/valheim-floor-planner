/**
 * Filler courses: where the roof passes above a wall it should rest on (the far wall of
 * an odd span, whose eave grew 1 m; a shed's high wall; an edge off the 2 m grid), the
 * wall is raised to the roof with a course of wall pieces, so the eave row rests on it.
 * Pure.
 */
import { sameLevel } from '../elevation';
import { distanceToSegment } from '../geometry/measure';
import { runSegments } from '../geometry/polyline';
import type { Plan, Roof, Vec2 } from '../types';

import { eaveAxis } from './roofFrame';
import { roofGeometry } from './roofGeometry';
import type { RoofPiece } from './roofPiece';
import type { RoofLib } from './tileRoof';
import { coursePieces, familiesFrom, fillWithFamilies, type WallLine } from './wallCourse';

/** How finely the roof's height is sampled along a wall (metres). */
const STEP = 0.5;
/** Gaps below this are no gap (metres). */
const MIN_GAP = 0.01;
/** A wall's line passes this close to an edge's middle to be under it (metres). */
const ON_EDGE = 0.05;

export interface FillerCourses {
  pieces: RoofPiece[];
  /** How high each raised wall was raised (metres), in outline edge order. */
  raises: number[];
}

/** The family of the panel wall under an edge's middle, or null. */
const familyUnder = (mid: Vec2, top: number, walls: Plan['walls'], lib: RoofLib): string | null => {
  const run = Object.values(walls).find(
    (w) =>
      sameLevel(w.elevation + w.height, top) &&
      runSegments(w).some((s) => distanceToSegment(mid, s.a, s.b) < ON_EDGE)
  );
  const family = run && lib.wallFamilies.get(run.familyId);
  // Block walls sit beside the line, not on it: their pieces wouldn't line up.
  return family?.snapKind === 'centerline' ? family.id : null;
};

/** The outline edges a roof rests on: every edge of a hip roof, the eave walls of the others. */
const restingEdges = (roof: Roof): { line: WallLine; length: number }[] => {
  const axis = roof.kind === 'hip' ? null : eaveAxis(roof);
  return roof.outline.flatMap((a, i) => {
    const b = roof.outline[(i + 1) % roof.outline.length]!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const alongX = a.z === b.z;
    if (axis !== null && alongX !== (axis === 'x')) return [];
    return [
      { line: { start: a, dir: { x: (b.x - a.x) / length, z: (b.z - a.z) / length } }, length },
    ];
  });
};

export const fillerCourses = (
  roof: Roof,
  k: number,
  eaveY: number,
  lib: RoofLib,
  walls: Plan['walls']
): FillerCourses => {
  const { frame } = roofGeometry(roof);
  const top = roof.elevation + roof.base;
  const pieces: RoofPiece[] = [];
  const raises: number[] = [];
  restingEdges(roof).forEach(({ line, length }, edge) => {
    const at = (s: number): Vec2 => ({
      x: line.start.x + line.dir.x * s,
      z: line.start.z + line.dir.z * s,
    });
    const samples = Array.from({ length: Math.round(length / STEP) + 1 }, (_, i) => i * STEP);
    const gaps = samples.map((s) => eaveY + k * frame.run(at(s)) - top);
    const gap = Math.max(...gaps);
    if (gap < MIN_GAP) return;
    // Near a hip corner the roof comes down to the wall: the course stops where it does.
    const full = samples.filter((_, i) => gaps[i]! > gap - MIN_GAP);
    const from = full[0]!;
    const to = full.at(-1)!;
    const families = familiesFrom(lib, familyUnder(at(length / 2), top, walls, lib));
    const { placed } = fillWithFamilies(families, to - from, gap);
    pieces.push(
      ...coursePieces(placed, line, from, top, {
        role: 'filler',
        sourceId: roof.id,
        key: (n) => `${roof.id}:f${edge}:${n}`,
        materialOf: (prefab) => lib.catalog.pieces.get(prefab)?.material ?? 'wood',
      })
    );
    raises.push(gap);
  });
  return { pieces, raises };
};
