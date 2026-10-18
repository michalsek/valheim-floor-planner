/**
 * The 3D terrain's geometry in plan space, but for the surface (`tileGeometry.ts`):
 * the skirts down the site's edges and the sea's surface over it.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';

import { SEA_LEVEL } from '../../model/terrain/hillshade';
import { heightRange, worldToPlan } from '../../model/terrain/siteTerrain';
import type { SiteGround } from '../../store/siteTerrain';

import { EARTH, linear } from './terrainColors';

/** The skirts reach this far below the patch's lowest point (metres). */
export const SKIRT = 4;

/**
 * World → plan is affine: the plan point of vertex (0, 0), and the plan steps of one
 * column (world +x) and one row (world +z).
 */
export const planAxes = ({ grid, frame }: SiteGround) => {
  const origin = worldToPlan(frame, { x: grid.x0, z: grid.z0 });
  const col = worldToPlan(frame, { x: grid.x0 + 1, z: grid.z0 });
  const row = worldToPlan(frame, { x: grid.x0, z: grid.z0 + 1 });
  return {
    origin,
    col: { x: col.x - origin.x, z: col.z - origin.z },
    row: { x: row.x - origin.x, z: row.z - origin.z },
  };
};

/** The lowest ground on the patch (plan metres). */
export const lowestGround = ({ grid }: SiteGround): number => heightRange(grid).min;

/** The sea's plan height for this site. */
export const seaHeight = ({ frame }: SiteGround): number => SEA_LEVEL - frame.origin.y;

/** The patch's border vertices in order around it (grid indices), closed. */
const borderRing = (cols: number, rows: number): number[] => {
  const ring: number[] = [];
  for (let i = 0; i < cols - 1; i++) ring.push(i);
  for (let j = 0; j < rows - 1; j++) ring.push(j * cols + cols - 1);
  for (let i = cols - 1; i > 0; i--) ring.push((rows - 1) * cols + i);
  for (let j = rows - 1; j > 0; j--) ring.push(j * cols);
  ring.push(0);
  return ring;
};

/**
 * Walls from the patch's border down to `SKIRT` below its lowest point, in the earth
 * colour, facing out: the site reads as a cut block rather than a floating sheet.
 */
export const skirtGeometry = (ground: SiteGround): BufferGeometry => {
  const { cols, rows, heights } = ground.grid;
  const { origin, col, row } = planAxes(ground);
  /** The plan position of grid vertex `k`. */
  const top = (k: number): [number, number, number] => {
    const [i, j] = [k % cols, Math.floor(k / cols)];
    return [origin.x + i * col.x + j * row.x, heights[k]!, origin.z + i * col.z + j * row.z];
  };
  const bottom = lowestGround(ground) - SKIRT;
  // The middle of the patch: halfway between its first and last vertices.
  const [first, last] = [top(0), top(cols * rows - 1)];
  const centre = { x: (first[0] + last[0]) / 2, z: (first[2] + last[2]) / 2 };
  const ring = borderRing(cols, rows);
  const positions: number[] = [];
  for (let s = 0; s < ring.length - 1; s++) {
    const [ax, ay, az] = top(ring[s]!);
    const [bx, by, bz] = top(ring[s + 1]!);
    const quad = [
      [ax, ay, az],
      [bx, by, bz],
      [bx, bottom, bz],
      [ax, bottom, az],
    ];
    // Facing out: the triangle's normal (b − a) × (down) must point away from the centre.
    const nx = -(bz - az);
    const nz = bx - ax;
    const out = nx * ((ax + bx) / 2 - centre.x) + nz * ((az + bz) / 2 - centre.z) > 0;
    const order = out ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
    for (const v of order) positions.push(...quad[v]!);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const earth = linear(EARTH);
  const colors = new Float32Array(positions.length);
  for (let k = 0; k < colors.length; k += 3) colors.set(earth, k);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
};

/** The sea's surface over the patch; null when no ground on it is under the sea. */
export const waterGeometry = (ground: SiteGround): BufferGeometry | null => {
  const sea = seaHeight(ground);
  if (lowestGround(ground) >= sea) return null;
  const { x0, z0, cols, rows } = ground.grid;
  const corners = [
    { x: x0, z: z0 },
    { x: x0 + cols - 1, z: z0 },
    { x: x0 + cols - 1, z: z0 + rows - 1 },
    { x: x0, z: z0 + rows - 1 },
  ].map((w) => worldToPlan(ground.frame, w));
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      corners.flatMap((p) => [p.x, sea, p.z]),
      3
    )
  );
  // Facing up in the plan (see the surface's triangles).
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
};
