/**
 * The 3D terrain's geometry, in plan space: the surface over a site's 1 m vertex grid,
 * the skirts down its edges and the sea's surface over it.
 *
 * Each world quad is split along its (x + 1, z)–(x, z + 1) diagonal, as the game's
 * collider (and `groundAtWorld`), so pieces meet the drawn ground where support says
 * they do. World z is mirrored into the plan, which flips a triangle's handedness; the
 * vertex order below is the one that faces up in the plan.
 */
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three/webgpu';

import { SEA_LEVEL } from '../../model/terrain/hillshade';
import { worldToPlan } from '../../model/terrain/siteTerrain';
import type { SiteGround } from '../../store/siteTerrain';

import { EARTH, groundColor, linear } from './terrainColors';

/** The skirts reach this far below the patch's lowest point (metres). */
export const SKIRT = 4;

const DEG = 180 / Math.PI;

/**
 * World → plan is affine: the plan point of vertex (0, 0), and the plan steps of one
 * column (world +x) and one row (world +z).
 */
const planAxes = ({ grid, frame }: SiteGround) => {
  const origin = worldToPlan(frame, { x: grid.x0, z: grid.z0 });
  const col = worldToPlan(frame, { x: grid.x0 + 1, z: grid.z0 });
  const row = worldToPlan(frame, { x: grid.x0, z: grid.z0 + 1 });
  return {
    origin,
    col: { x: col.x - origin.x, z: col.z - origin.z },
    row: { x: row.x - origin.x, z: row.z - origin.z },
  };
};

/** The plan positions (x, y, z) of every vertex of the patch, row-major like the grid. */
const planPositions = (ground: SiteGround): Float32Array => {
  const { cols, rows, heights } = ground.grid;
  const { origin, col, row } = planAxes(ground);
  const out = new Float32Array(cols * rows * 3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      out[3 * k] = origin.x + i * col.x + j * row.x;
      out[3 * k + 1] = heights[k]!;
      out[3 * k + 2] = origin.z + i * col.z + j * row.z;
    }
  }
  return out;
};

/**
 * Smooth normals in the plan, from the ground's slope along each world axis (central
 * differences, one-sided at the edges), turned into the plan as the positions are.
 */
const planNormals = (ground: SiteGround): Float32Array => {
  const { cols, rows, heights } = ground.grid;
  const { col, row } = planAxes(ground);
  const at = (i: number, j: number) => heights[j * cols + i]!;
  const out = new Float32Array(cols * rows * 3);
  for (let j = 0; j < rows; j++) {
    const [j0, j1] = [Math.max(j - 1, 0), Math.min(j + 1, rows - 1)];
    for (let i = 0; i < cols; i++) {
      const [i0, i1] = [Math.max(i - 1, 0), Math.min(i + 1, cols - 1)];
      const hx = (at(i1, j) - at(i0, j)) / (i1 - i0);
      const hz = (at(i, j1) - at(i, j0)) / (j1 - j0);
      // The world normal (−hx, 1, −hz), its horizontal part turned into the plan.
      const nx = -hx * col.x - hz * row.x;
      const nz = -hx * col.z - hz * row.z;
      const length = Math.hypot(nx, 1, nz);
      const k = 3 * (j * cols + i);
      out[k] = nx / length;
      out[k + 1] = 1 / length;
      out[k + 2] = nz / length;
    }
  }
  return out;
};

/** Two triangles per quad, split along the collider's diagonal, facing up in the plan. */
const surfaceIndex = (cols: number, rows: number): Uint32Array => {
  const out = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let n = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const v00 = j * cols + i;
      const v10 = v00 + 1;
      const v01 = v00 + cols;
      const v11 = v01 + 1;
      out[n++] = v00;
      out[n++] = v10;
      out[n++] = v01;
      out[n++] = v11;
      out[n++] = v01;
      out[n++] = v10;
    }
  }
  return out;
};

/** The lowest ground on the patch (plan metres). */
export const lowestGround = ({ grid }: SiteGround): number =>
  grid.heights.reduce((low, h) => Math.min(low, h), Infinity);

/** The sea's plan height for this site. */
export const seaHeight = ({ frame }: SiteGround): number => SEA_LEVEL - frame.origin.y;

interface SurfaceData {
  positions: Float32Array;
  index: Uint32Array;
  normals: Float32Array;
  colors: Float32Array;
}

/** The surface's arrays, made once per site (re-entering 3D only uploads them). */
const surfaces = new WeakMap<SiteGround, SurfaceData>();

const surfaceData = (ground: SiteGround): SurfaceData => {
  const cached = surfaces.get(ground);
  if (cached) return cached;
  const { grid, terrain } = ground;
  const positions = planPositions(ground);
  const index = surfaceIndex(grid.cols, grid.rows);
  const normals = planNormals(ground);
  const sea = seaHeight(ground);
  const colors = new Float32Array(grid.cols * grid.rows * 3);
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const k = j * grid.cols + i;
      const slope = Math.acos(Math.min(1, normals[3 * k + 1]!)) * DEG;
      const below = sea - grid.heights[k]!;
      groundColor(colors, 3 * k, terrain.biomes, grid.x0 + i, grid.z0 + j, slope, below);
    }
  }
  const data = { positions, index, normals, colors };
  surfaces.set(ground, data);
  return data;
};

/**
 * The ground's surface: plan positions, smooth normals, and vertex colours (biome
 * tint, rock on steep slopes, sand under the sea).
 */
export const surfaceGeometry = (ground: SiteGround): BufferGeometry => {
  const { positions, index, normals, colors } = surfaceData(ground);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new Uint32BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
};

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
  const { cols, rows } = ground.grid;
  const top = surfaceData(ground).positions;
  const bottom = lowestGround(ground) - SKIRT;
  // The middle of the patch: halfway between its first and last vertices.
  const last = 3 * (cols * rows - 1);
  const centre = { x: (top[0]! + top[last]!) / 2, z: (top[2]! + top[last + 2]!) / 2 };
  const ring = borderRing(cols, rows);
  const positions: number[] = [];
  for (let s = 0; s < ring.length - 1; s++) {
    const a = 3 * ring[s]!;
    const b = 3 * ring[s + 1]!;
    const [ax, ay, az] = [top[a]!, top[a + 1]!, top[a + 2]!];
    const [bx, by, bz] = [top[b]!, top[b + 1]!, top[b + 2]!];
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
