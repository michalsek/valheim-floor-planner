/**
 * How opaque the site's terrain is drawn (the slider beside the Terrain toggle), in both
 * views, remembered per browser. Below 1 the build's underside and foundations show
 * through the ground in 3D, and an underlay through the relief in 2D.
 */
import { persistedAtom } from './browserStorage';

/** Solid: the terrain as M16 draws it. */
export const DEFAULT_TERRAIN_OPACITY = 1;

/** The terrain's opacity, 0 to 1 (a stored value out of range is clamped). */
export const terrainOpacityAtom = persistedAtom<number>(
  'valheimFloorPlanner.terrainOpacity.v1',
  DEFAULT_TERRAIN_OPACITY,
  (stored) => {
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : null;
  },
  String
);
