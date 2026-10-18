/** Every roof's pieces and warnings, cached per roof while its level's walls stay. Pure. */
import type { Library } from '../../catalog/library';
import { sameLevel } from '../elevation';
import { distanceToSegment } from '../geometry/measure';
import { runSegments } from '../geometry/polyline';
import { levelPlan } from '../levels';
import type { Plan, PlanWarning, Roof } from '../types';

import { onFootprint, rawWallTops } from './rawWallTops';
import { roofWarning, type RoofPiece } from './roofPiece';
import { tileRoof, type RoofTiling } from './tileRoof';

export interface RoofsResult {
  pieces: RoofPiece[];
  warnings: PlanWarning[];
}

/** How close to an outline edge's middle a wall's line must pass to hold it (metres). */
const ON_WALL = 0.05;

/**
 * An info note for outline edges with no wall under them at the roof's wall top: a drawn
 * wall's line, or a raw piece standing there (an exploded wall).
 */
const restingNote = (
  roof: Roof,
  walls: Plan['walls'],
  rawPieces: Plan['rawPieces'],
  lib: Library
): PlanWarning[] => {
  const top = roof.elevation + roof.base;
  const segments = Object.values(walls)
    .filter((w) => sameLevel(w.elevation + w.height, top))
    .flatMap((w) => runSegments(w));
  const raw = rawWallTops(rawPieces, top, lib);
  const { outline } = roof;
  const loose = outline.filter((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    return (
      !segments.some((s) => distanceToSegment(mid, s.a, s.b) < ON_WALL) &&
      !raw.some((box) => onFootprint(box, mid, ON_WALL))
    );
  }).length;
  if (loose === 0) return [];
  const what = loose === 1 ? 'A roof edge is' : `${loose} roof edges are`;
  return [roofWarning(roof.id, `${what} not resting on a wall`, 'info')];
};

interface Entry {
  walls: Plan['walls'];
  lib: Library;
  tiling: RoofTiling;
  /** The resting note follows the level's raw pieces too; the tiling doesn't. */
  rawPieces: Plan['rawPieces'];
  result: RoofTiling;
}

const cache = new WeakMap<Roof, Entry>();

const deriveRoof = (plan: Plan, roof: Roof, lib: Library): RoofTiling => {
  const { walls, rawPieces } = levelPlan(plan, roof.elevation, lib);
  const cached = cache.get(roof);
  const same = cached?.walls === walls && cached.lib === lib;
  if (same && cached.rawPieces === rawPieces) return cached.result;
  const tiling = same ? cached.tiling : tileRoof(roof, lib, walls);
  const note = restingNote(roof, walls, rawPieces, lib);
  const result = { ...tiling, warnings: [...tiling.warnings, ...note] };
  cache.set(roof, { walls, lib, tiling, rawPieces, result });
  return result;
};

export const deriveRoofs = (plan: Plan, lib: Library): RoofsResult => {
  const results = Object.values(plan.roofs).map((roof) => deriveRoof(plan, roof, lib));
  return {
    pieces: results.flatMap((r) => r.pieces),
    warnings: results.flatMap((r) => r.warnings),
  };
};
