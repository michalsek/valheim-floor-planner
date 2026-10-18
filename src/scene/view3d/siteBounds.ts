/** How the 3D view's fitted bounds take in a site's ground. */
import type { Bounds3 } from '../../model/geometry/bounds3';
import { groundRange } from '../../model/terrain/siteTerrain';
import type { SiteGround } from '../../store/siteTerrain';

import { DEFAULT_CAMERA_FLOOR } from './orbitMath';
import { lowestGround, SKIRT } from './terrainGeometry';

/** How far under a site's block (its skirts' bottom) the camera may still go (metres). */
const BELOW_BLOCK = 20;

/**
 * The plan's bounds grown to the ground's height range under their footprint, so the
 * camera fit and the sun's shadow camera hold the terrain there. Unchanged without
 * ground (or off the patch).
 */
export const withGround = (bounds: Bounds3 | null, ground: SiteGround | null): Bounds3 | null => {
  if (!bounds || !ground) return bounds;
  const range = groundRange(ground.grid, ground.frame, bounds);
  if (!range) return bounds;
  return {
    min: { ...bounds.min, y: Math.min(bounds.min.y, range.min) },
    max: { ...bounds.max, y: Math.max(bounds.max.y, range.max) },
  };
};

/** The whole patch's diagonal (metres): how far the depth planes must reach to hold it. */
export const siteReach = (ground: SiteGround | null): number =>
  ground ? Math.hypot(ground.grid.cols, ground.grid.rows) : 0;

/**
 * The lowest the camera may go: well under the site's block (its skirts' bottom), or a
 * fixed depth without terrain. Only a safety limit: views from below are allowed.
 */
export const cameraFloor = (ground: SiteGround | null): number =>
  ground ? lowestGround(ground) - SKIRT - BELOW_BLOCK : DEFAULT_CAMERA_FLOOR;
