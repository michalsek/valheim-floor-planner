/**
 * A world build as a new plan of raw pieces. The build is turned by its grid direction
 * so its walls run along the plan's axes, its corner goes to the origin (on the 0.5 m
 * grid its pieces sit on) and its lowest piece's bottom to height 0. Each piece goes on
 * the level of the floor it stands on; roof pieces and gable walls on a roof level of
 * their own.
 *
 * Planner space is the game's mirrored in z (see `catalog/pieceDefs.ts`): a world point
 * (x, z) is plan point (x, −z), so north (+z) is up on screen. A game yaw turns
 * clockwise seen from above with north up, which is the plan's clockwise yaw: a piece's
 * plan yaw is its game yaw less the build's. Pure.
 */
import type { Library } from '../../catalog/library';
import type { PieceDef } from '../../catalog/pieceDefs';
import { MAX_ELEVATION, roundElevation } from '../elevation';
import { normalizeDeg, propCorners, rotate } from '../geometry/propGeometry';
import { rawPieceProblem, rawRect } from '../rawPieces';
import { rawRoofDef } from '../rawShapes';
import { emptyPlan, type ImportFrame, type Plan, type RawPiece, type Vec2 } from '../types';

import { cloudPiece, type CloudPiece, type PieceCloud } from './pieceCloud';
import type { WorldCluster } from './clusters';

type ImportLib = Pick<Library, 'catalog' | 'floorFamilies' | 'roofFamilies' | 'gableWallSets'>;
/** The grid imported builds are put on (metres). */
const GRID = 0.5;
/** A floor level needs this many tiles at its height. */
const MIN_LEVEL_TILES = 2;
/** Floor tops this close are one level (metres). */
const LEVEL_ROUNDING = 0.05;
/** Colliders may poke this far past the origin's grid line (they overhang their snaps). */
const OVERHANG = 0.05;
/** A piece within this of a level's height (above or below) stands on it. */
const LEVEL_TOLERANCE = 0.1;
/**
 * The import starts on the lowest level holding at least this share of the build's
 * pieces that aren't roofs: its main floor, not a few stray poles at the bottom.
 */
const LANDING_SHARE = 0.1;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

/** A world point on the plan (z mirrored). */
const onPlan = (x: number, z: number): Vec2 => ({ x, z: -z + 0 });

const snapHeights = (def: PieceDef | undefined): number[] => def?.snapPoints.map((p) => p[1]) ?? [];

/** How far a prefab reaches below and above its pivot (snap points, else collider). */
const heightSpan = (def: PieceDef | undefined): { low: number; high: number } => {
  const snaps = snapHeights(def);
  if (snaps.length > 0) return { low: Math.min(...snaps), high: Math.max(...snaps) };
  const bounds = def?.colliderBounds;
  return bounds ? { low: bounds[0][1], high: bounds[1][1] } : { low: 0, high: 0 };
};

/** `v` modulo `GRID`, in [−GRID/2, GRID/2) around `centre`. */
const gridResidual = (v: number, centre: number): number =>
  ((((v - centre) % GRID) + 1.5 * GRID) % GRID) - GRID / 2;

/**
 * Where the grid lines of `values` fall modulo `GRID`: the most common centimetre, then
 * the mean of the values near it, as the game drifts a centimetre or two.
 */
const gridOffset = (values: readonly number[]): number => {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round((((v % GRID) + GRID) % GRID) * 100) % (GRID * 100);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let mode = 0;
  let bestCount = 0;
  for (const [key, count] of counts) if (count > bestCount) [mode, bestCount] = [key / 100, count];
  const near = values.map((v) => gridResidual(v, mode)).filter((r) => Math.abs(r) < 0.05);
  const mean = near.reduce((sum, r) => sum + r, 0) / Math.max(near.length, 1);
  return (((mode + mean) % GRID) + GRID) % GRID;
};

/** The highest grid line (shifted by `offset`) at or below `v`. */
const gridFloor = (v: number, offset: number): number =>
  offset + Math.floor((v - offset) / GRID + 1e-6) * GRID;

interface Placed {
  piece: CloudPiece;
  def: PieceDef | undefined;
  local: Vec2;
  /** Clockwise on screen, in the build's frame. */
  yaw: number;
}

/** The build's levels: 0 and every floor top with enough tiles, lowest first. */
const floorLevels = (tops: readonly number[]): number[] => {
  const counts = new Map<number, number>();
  for (const top of tops) {
    const key = roundElevation(Math.round(top / LEVEL_ROUNDING) * LEVEL_ROUNDING);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const levels = [...counts]
    .filter(([top, n]) => n >= MIN_LEVEL_TILES && top <= MAX_ELEVATION)
    .map(([top]) => top);
  return [...new Set([0, ...levels])].sort((a, b) => a - b);
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

/** Throws when a piece can't be stored (a build far taller than any level reaches). */
export const importCluster = (
  cloud: PieceCloud,
  cluster: Pick<WorldCluster, 'indices' | 'yaw'>,
  lib: ImportLib,
  worldName: string
): ImportedBuild => {
  const frameYaw = cluster.yaw;
  const placed: Placed[] = cluster.indices.map((i) => {
    const piece = cloudPiece(cloud, i);
    return {
      piece,
      def: lib.catalog.pieces.get(piece.prefab),
      local: rotate(onPlan(piece.x, piece.z), -frameYaw),
      yaw: normalizeDeg(piece.yaw - frameYaw),
    };
  });

  // The corner: below and left of every footprint, on the grid the pieces sit on.
  const square = placed.filter((p) => p.yaw % 90 === 0);
  const corners = placed.flatMap((p) => propCorners(p.local, p.yaw, rawRect(p.def)));
  const corner = (axis: 'x' | 'z'): number =>
    gridFloor(
      corners.reduce((m, c) => Math.min(m, c[axis]), Infinity) + OVERHANG,
      gridOffset(square.map((p) => p.local[axis]))
    );
  const origin = { x: corner('x'), z: corner('z') };

  // Heights: from the lowest bottom; floors by their tops.
  const datum = placed.reduce((m, p) => Math.min(m, p.piece.y + heightSpan(p.def).low), Infinity);
  const tiles = new Set(
    [...lib.floorFamilies.values()].flatMap((f) => f.tiles.map((t) => t.prefab))
  );
  const isTile = (p: Placed) => tiles.has(p.piece.prefab);
  const standsAt = (p: Placed) =>
    p.piece.y - datum + (isTile(p) ? heightSpan(p.def).high : heightSpan(p.def).low);
  const levels = floorLevels(placed.filter(isTile).map(standsAt));
  const isRoof = (p: Placed) => rawRoofDef(lib, p.piece.prefab) !== undefined;
  const roofBottoms = placed.filter(isRoof).map(standsAt);
  const roofLevel = Math.min(
    MAX_ELEVATION,
    Math.round(roofBottoms.reduce((m, b) => Math.min(m, b), Infinity) / GRID) * GRID
  );
  const levelOf = (p: Placed): number =>
    isRoof(p)
      ? roofLevel
      : levels.reduce((best, l) => (l <= standsAt(p) + LEVEL_TOLERANCE ? l : best), 0);

  const rawPieces: Record<string, RawPiece> = {};
  // Pieces per level, roofs left out.
  const perLevel = new Map<number, number>();
  placed.forEach((p, k) => {
    const elevation = levelOf(p);
    if (!isRoof(p)) perLevel.set(elevation, (perLevel.get(elevation) ?? 0) + 1);
    const id = `raw${k}`;
    const piece: RawPiece = {
      id,
      prefab: p.piece.prefab,
      position: {
        x: round6(p.local.x - origin.x),
        y: round6(p.piece.y - datum - elevation),
        z: round6(p.local.z - origin.z),
      },
      rotation: { yaw: p.yaw, pitch: p.piece.pitch, roll: p.piece.roll },
      elevation,
    };
    // A build reaching hundreds of metres up a cliff from its lowest piece.
    const problem = rawPieceProblem(piece);
    if (problem) throw new Error(`Can't import ${p.piece.prefab}: ${problem}`);
    rawPieces[id] = piece;
  });

  const planOrigin = rotate(origin, frameYaw);
  const importFrame: ImportFrame = {
    worldName,
    origin: { x: round6(planOrigin.x), y: round6(datum), z: round6(-planOrigin.z) },
    yaw: frameYaw,
    terrain: null,
  };
  return {
    plan: { ...emptyPlan(), name: `${worldName} build`, rawPieces, importFrame },
    level: landingLevel(perLevel),
  };
};
