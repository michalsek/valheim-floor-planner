/**
 * The 2D relief of a site's ground: per vertex, a shade byte (Lambert light on the
 * ground's normal, vertical exaggeration `EXAGGERATION`) and a water byte (ground below
 * sea level), interleaved for a two-channel texture. The light comes from the plan's
 * upper left as it is drawn (screen north-west), so relief reads the usual way round
 * whatever the import's turn; the world's mirrored z is handled here, once.
 */
import { planToWorld, type SiteFrame, type TerrainGrid } from './siteTerrain';

/** The sea's world height (metres): the generator's 0.15 × 200. */
export const SEA_LEVEL = 30;
/** Slopes are steepened this much for the shade, so gentle ground still reads. */
export const EXAGGERATION = 2;
/** The light's height above the horizon (degrees). */
export const LIGHT_ALTITUDE = 45;

/** The light's direction from the ground towards it, in world axes (unit length). */
const lightDirection = (frame: SiteFrame) => {
  // Screen up-left on the plan: −x, −z (screen down is +z).
  const towards = planToWorld({ ...frame, origin: { x: 0, y: 0, z: 0 } }, { x: -1, z: -1 });
  const flat = Math.hypot(towards.x, towards.z);
  const altitude = (LIGHT_ALTITUDE * Math.PI) / 180;
  return {
    x: (towards.x / flat) * Math.cos(altitude),
    y: Math.sin(altitude),
    z: (towards.z / flat) * Math.cos(altitude),
  };
};

/**
 * `[shade, water]` per vertex, row-major like the grid: shade 0 (facing away) to 255
 * (facing the light), water 255 below sea level, else 0.
 */
export const hillshade = (grid: TerrainGrid, frame: SiteFrame): Uint8Array => {
  const { cols, rows, heights } = grid;
  const light = lightDirection(frame);
  const sea = SEA_LEVEL - frame.origin.y;
  const at = (i: number, j: number) =>
    heights[Math.min(rows - 1, Math.max(0, j)) * cols + Math.min(cols - 1, Math.max(0, i))]!;
  const out = new Uint8Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // Central differences (one-sided at the edges), in metres per metre.
      const dx = (at(i + 1, j) - at(i - 1, j)) / (Math.min(i + 1, cols - 1) - Math.max(i - 1, 0));
      const dz = (at(i, j + 1) - at(i, j - 1)) / (Math.min(j + 1, rows - 1) - Math.max(j - 1, 0));
      const nx = -EXAGGERATION * dx;
      const nz = -EXAGGERATION * dz;
      const lambert = (nx * light.x + light.y + nz * light.z) / Math.hypot(nx, 1, nz);
      const k = 2 * (j * cols + i);
      out[k] = Math.round(255 * Math.max(0, lambert));
      out[k + 1] = heights[j * cols + i]! < sea ? 255 : 0;
    }
  }
  return out;
};
