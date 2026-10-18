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
  const a0 = tri[0]!.h >= level;
  const a1 = tri[1]!.h >= level;
  const a2 = tri[2]!.h >= level;
  const ups = Number(a0) + Number(a1) + Number(a2);
  if (ups === 0 || ups === 3) return;
  // The lone vertex on its side: both crossing edges meet there.
  const lone = ups === 1 ? (a0 ? 0 : a1 ? 1 : 2) : !a0 ? 0 : !a1 ? 1 : 2;
  const a = tri[lone]!;
  const b = tri[(lone + 1) % 3]!;
  const c = tri[(lone + 2) % 3]!;
  const at = out.length;
  cross(a, b, level, out);
  cross(a, c, level, out);
  // A level through a vertex makes a point, not a line.
  if (Math.hypot(out[at]! - out[at + 2]!, out[at + 1]! - out[at + 3]!) < 1e-9) out.length = at;
};

/** Grid vertices `i0..i1` × `j0..j1` (inclusive): the quads between them. */
export interface GridRange {
  i0: number;
  i1: number;
  j0: number;
  j1: number;
}

/**
 * Line segments (x1, z1, x2, z2 in world coordinates, game axes) at every multiple of
 * `step`, leaving out the multiples of `except` (drawn by a coarser set), over the
 * quads of `range` (the whole patch by default).
 */
export const contourSegments = (
  grid: TerrainGrid,
  step: number,
  except: number | null = null,
  range: GridRange = { i0: 0, i1: grid.cols - 1, j0: 0, j1: grid.rows - 1 }
): Float32Array => {
  const out: number[] = [];
  const { x0, z0, cols, heights } = grid;
  const corner = (i: number, j: number): Corner => ({
    x: x0 + i,
    z: z0 + j,
    h: heights[j * cols + i]!,
  });
  /** The levels between `low` and `high`, onto `tri`'s segments; most triangles have none. */
  const levels = (low: number, high: number, tri: () => readonly Corner[]) => {
    let k = Math.ceil(low / step);
    if (k * step > high) return;
    const corners = tri();
    for (; k * step <= high; k++) {
      const level = k * step;
      if (except === null || !multipleOf(level, except)) triangleSegment(corners, level, out);
    }
  };
  for (let j = range.j0; j < range.j1; j++) {
    for (let i = range.i0; i < range.i1; i++) {
      const at = j * cols + i;
      const h00 = heights[at]!;
      const h10 = heights[at + 1]!;
      const h01 = heights[at + cols]!;
      const h11 = heights[at + cols + 1]!;
      levels(Math.min(h00, h10, h01), Math.max(h00, h10, h01), () => [
        corner(i, j),
        corner(i + 1, j),
        corner(i, j + 1),
      ]);
      levels(Math.min(h11, h01, h10), Math.max(h11, h01, h10), () => [
        corner(i + 1, j + 1),
        corner(i, j + 1),
        corner(i + 1, j),
      ]);
    }
  }
  return Float32Array.from(out);
};
