/**
 * Contour lines of a site's ground: marching triangles over the terrain collider's own
 * triangles (each 1 m quad split along its (x + 1, z)–(x, z + 1) diagonal, as
 * `groundAtWorld`), so the lines are exact for the drawn ground and need no saddle
 * rules. Heights are plan heights, so the 0 line is datum 0 and every line is a level
 * one could build at.
 */
import type { TerrainGrid } from './siteTerrain';

/** Whether `level` is a multiple of `step` (within float noise). */
const multipleOf = (level: number, step: number): boolean =>
  Math.abs(level / step - Math.round(level / step)) < 1e-6;

type Corner = { x: number; z: number; h: number };

/** The point where edge a–b crosses `level` (a and b on opposite sides). */
const cross = (a: Corner, b: Corner, level: number, out: number[]): void => {
  const t = (level - a.h) / (b.h - a.h);
  out.push(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
};

/** One triangle's segment at `level` (vertices at or above it count as above). */
const triangleSegment = (tri: readonly Corner[], level: number, out: number[]): void => {
  const above = tri.map((c) => c.h >= level);
  const ups = above.filter(Boolean).length;
  if (ups === 0 || ups === 3) return;
  // The lone vertex on its side: both crossing edges meet there.
  const lone = above.findIndex((a) => (ups === 1 ? a : !a));
  const a = tri[lone]!;
  const b = tri[(lone + 1) % 3]!;
  const c = tri[(lone + 2) % 3]!;
  const at = out.length;
  cross(a, b, level, out);
  cross(a, c, level, out);
  // A level through a vertex makes a point, not a line.
  if (Math.hypot(out[at]! - out[at + 2]!, out[at + 1]! - out[at + 3]!) < 1e-9) out.length = at;
};

/**
 * Line segments (x1, z1, x2, z2 in world coordinates, game axes) at every multiple of
 * `step`, leaving out the multiples of `except` (drawn by a coarser set).
 */
export const contourSegments = (
  grid: TerrainGrid,
  step: number,
  except: number | null = null
): Float32Array => {
  const out: number[] = [];
  const { x0, z0, cols, rows, heights } = grid;
  const corner = (i: number, j: number): Corner => ({
    x: x0 + i,
    z: z0 + j,
    h: heights[j * cols + i]!,
  });
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const h00 = corner(i, j);
      const h10 = corner(i + 1, j);
      const h01 = corner(i, j + 1);
      const h11 = corner(i + 1, j + 1);
      for (const tri of [
        [h00, h10, h01],
        [h11, h01, h10],
      ]) {
        const low = Math.min(tri[0]!.h, tri[1]!.h, tri[2]!.h);
        const high = Math.max(tri[0]!.h, tri[1]!.h, tri[2]!.h);
        for (let k = Math.ceil(low / step); k * step <= high; k++) {
          const level = k * step;
          if (except === null || !multipleOf(level, except)) triangleSegment(tri, level, out);
        }
      }
    }
  }
  return Float32Array.from(out);
};
