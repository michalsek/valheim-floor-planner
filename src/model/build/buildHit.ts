/**
 * What the Build tool's ray lands on (M17 §3.1): the nearest of the drawn pieces, the
 * shown ground and the work plane (the level plate). Pieces give their face's or
 * triangle's normal; the ground and the plate give straight up, as the game does for
 * the ground. Pure.
 */
import { snapValue } from '../geometry/snap';
import { pointOnRay, rayPieceHit, type Ray3 } from '../geometry/ray';
import type { PieceBox } from '../pieceBoxes';
import { groundAt, type SiteFrame, type TerrainGrid } from '../terrain/siteTerrain';
import { rayTerrain } from '../terrain/terrainRay';
import type { Vec3 } from '../types';

export type BuildSurface = 'piece' | 'terrain' | 'plate';

export interface BuildHit {
  point: Vec3;
  /** Unit normal of the surface hit, facing the ray (straight up on the ground and plate). */
  normal: Vec3;
  /** Distance along the ray. */
  t: number;
  surface: BuildSurface;
  /** The piece hit; null on the ground or the plate. */
  box: PieceBox | null;
}

export interface BuildScene {
  /** The drawn pieces the ray may land on (the carried ones left out). */
  boxes: readonly PieceBox[];
  /** The shown ground; null without one (or hidden). */
  terrain: { grid: TerrainGrid; frame: SiteFrame } | null;
  /** The work plane's height (the current level's datum). */
  datum: number;
  /** How far along the ray anything counts (metres); unlimited by default. */
  maxT?: number;
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** Where the ray meets the plane y = `datum` (from either side); null when it doesn't. */
const plateT = (r: Ray3, datum: number): number | null => {
  if (Math.abs(r.dir.y) < 1e-12) return null;
  const t = (datum - r.origin.y) / r.dir.y;
  return t >= 0 ? t : null;
};

/** The nearest surface along the ray; null when it meets none within reach. */
export const buildHit = (r: Ray3, scene: BuildScene): BuildHit | null => {
  let reach = scene.maxT ?? Infinity;
  let best: BuildHit | null = null;
  const plate = plateT(r, scene.datum);
  if (plate !== null && plate <= reach) {
    best = { t: plate, point: pointOnRay(r, plate), normal: UP, surface: 'plate', box: null };
    reach = plate;
  }
  for (const box of scene.boxes) {
    const hit = rayPieceHit(r, box);
    if (hit && hit.t < reach) {
      best = { ...hit, point: pointOnRay(r, hit.t), surface: 'piece', box };
      reach = hit.t;
    }
  }
  if (scene.terrain) {
    const hit = rayTerrain(r, scene.terrain.grid, scene.terrain.frame, reach);
    if (hit) best = { ...hit, normal: UP, surface: 'terrain', box: null };
  }
  return best;
};

/**
 * The hit moved onto the grid (x and z to `step`) when it is on the ground or the plate,
 * its height taken again there (M17 §2.8, a planner addition); a hit on a piece is kept.
 */
export const hitOnGrid = (hit: BuildHit, step: number, scene: BuildScene): BuildHit => {
  if (hit.surface === 'piece') return hit;
  const x = snapValue(hit.point.x, step);
  const z = snapValue(hit.point.z, step);
  const ground =
    hit.surface === 'terrain' && scene.terrain
      ? groundAt(scene.terrain.grid, scene.terrain.frame, { x, z })
      : null;
  const y = hit.surface === 'plate' ? scene.datum : (ground ?? hit.point.y);
  return { ...hit, point: { x, y, z } };
};
