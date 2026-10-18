/**
 * A world build as a new plan of raw pieces. By default the plan's axes are the world's
 * and its origin is on the world's lattice, so the plan grid is the game's terrain grid
 * and the build shows at its true angle; with the `'build'` grid it is turned by its
 * grid direction so its walls run along the plan's axes, on the 0.5 m grid its pieces
 * sit on (`frameGrid.ts`). Its corner goes to the origin and its structure's lowest
 * bottom to height 0 (`structuralDatum`). Each piece goes on the level of the floor it
 * stands on (`framePieces.ts`). The frame lists the world pieces it holds
 * (`worldPieces`), so sites revealed later never bring them in twice.
 *
 * Planner space is the game's mirrored in z (see `catalog/pieceDefs.ts`): a world point
 * (x, z) is plan point (x, −z), so north (+z) is up on screen. A game yaw turns
 * clockwise seen from above with north up, which is the plan's clockwise yaw: a piece's
 * plan yaw is its game yaw less the frame's. Pure.
 */
import { rotate } from '../geometry/propGeometry';
import { emptyPlan, type ImportFrame, type Plan } from '../types';

import type { WorldCluster } from './clusters';
import {
  framePieces,
  heightSpan,
  LEVEL_ROUNDING,
  rawPiecesInFrame,
  snapHeights,
  type FramedPiece,
  type ImportLib,
} from './framePieces';
import { frameCorner, frameYaw, gridFloor, gridOffset, type FrameGrid } from './frameGrid';
import type { PieceCloud } from './pieceCloud';
import { sortedKeys, worldPieceKey } from './worldKeys';

/**
 * The import starts on the lowest level holding at least this share of the build's
 * pieces that aren't roofs: its main floor, not a few stray poles at the bottom.
 */
const LANDING_SHARE = 0.1;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

/**
 * Height 0 of an import: the lowest bottom of its structure (the pieces with snap points:
 * floors, walls, beams, poles, roofs), on the half-metre grid their bottoms share.
 * Stations, chests and props don't count, so a workbench on lower ground beside the
 * build sits a little below 0 instead of shifting every level off the grid; a stray
 * structural piece on its own grid moves 0 by less than one step. Without structure,
 * the lowest bottom of all.
 */
const structuralDatum = (placed: readonly FramedPiece[]): number => {
  const structure = placed.filter((p) => snapHeights(p.def).length > 0);
  const bottoms = (structure.length > 0 ? structure : placed).map(
    (p) => p.piece.y + heightSpan(p.def).low
  );
  const lowest = Math.min(...bottoms);
  return structure.length > 0 ? gridFloor(lowest + LEVEL_ROUNDING, gridOffset(bottoms)) : lowest;
};

export interface ImportedBuild {
  plan: Plan;
  /** Where to start: the lowest level with `LANDING_SHARE` of the pieces besides roofs. */
  level: number;
}

/** The lowest level with a fair share of `counts` (pieces per level); else the fullest. */
const landingLevel = (counts: ReadonlyMap<number, number>): number => {
  const entries = [...counts].sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const landing = entries.find(([, n]) => n >= total * LANDING_SHARE);
  return landing?.[0] ?? entries.reduce((best, e) => (e[1] > best[1] ? e : best), [0, 0])[0];
};

/**
 * Throws when a piece can't be stored (a build far taller than any level reaches).
 * `grid` picks the frame: world axes (the default) or the build's own grid.
 */
export const importCluster = (
  cloud: PieceCloud,
  cluster: Pick<WorldCluster, 'indices' | 'yaw'>,
  lib: ImportLib,
  worldName: string,
  grid: FrameGrid = 'world'
): ImportedBuild => {
  const yaw = frameYaw(grid, cluster.yaw);
  // First in a frame at the world's origin, turned by the frame's yaw.
  const turned = framePieces(cloud, cluster.indices, { origin: { x: 0, y: 0, z: 0 }, yaw }, lib);
  const origin = frameCorner(turned, grid);
  // Heights: floors by their tops, from the structure's datum.
  const datum = structuralDatum(turned);
  const framed = turned.map((p) => ({
    ...p,
    plan: { x: p.plan.x - origin.x, z: p.plan.z - origin.z },
  }));
  const { pieces, perLevel } = rawPiecesInFrame(framed, datum, lib, (k) => `raw${k}`);

  const planOrigin = rotate(origin, yaw);
  const importFrame: ImportFrame = {
    worldName,
    origin: { x: round6(planOrigin.x), y: round6(datum), z: round6(-planOrigin.z) },
    yaw,
    terrain: null,
    worldPieces: sortedKeys(cluster.indices.map((i) => worldPieceKey(cloud, i))),
  };
  return {
    plan: {
      ...emptyPlan(),
      name: `${worldName} build`,
      rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
      importFrame,
    },
    level: landingLevel(perLevel),
  };
};
