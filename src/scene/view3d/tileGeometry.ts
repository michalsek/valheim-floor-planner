/**
 * The 3D terrain surface's mesh for one tile of the patch (`siteTiles.ts`), with a
 * 16-bit index (a tile is at most 129 × 129 vertices).
 *
 * Each world quad is split along its (x + 1, z)–(x, z + 1) diagonal, as the game's
 * collider (and `groundAtWorld`), so pieces meet the drawn ground where support says
 * they do. World z is mirrored into the plan, which flips a triangle's handedness; the
 * vertex order below is the one that faces up in the plan.
 */
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three/webgpu';

import type { TerrainTile } from '../../model/terrain/siteTiles';
import type { SiteGround } from '../../store/siteTerrain';

import { groundColor } from './terrainColors';
import { planAxes, seaHeight } from './terrainGeometry';

const DEG = 180 / Math.PI;

/**
 * A tile's mesh: plan positions, smooth normals (central differences over the whole
 * patch, one-sided at its edges, turned into the plan as the positions are), vertex
 * colours (biome tint, rock on steep slopes, sand under the sea) and two triangles a
 * quad along the collider's diagonal. The arrays are the attributes' own (not copied).
 */
export const tileGeometry = (ground: SiteGround, tile: TerrainTile): BufferGeometry => {
  const { grid, terrain } = ground;
  const { cols, rows, heights } = grid;
  const { origin, col, row } = planAxes(ground);
  const sea = seaHeight(ground);
  const { i0, i1, j0, j1 } = tile;
  const w = i1 - i0 + 1;
  const h = j1 - j0 + 1;
  const positions = new Float32Array(w * h * 3);
  const normals = new Float32Array(w * h * 3);
  const colors = new Float32Array(w * h * 3);
  const at = (i: number, j: number) => heights[j * cols + i]!;
  let [low, high] = [Infinity, -Infinity];
  let k = 0;
  for (let j = j0; j <= j1; j++) {
    const [ja, jb] = [Math.max(j - 1, 0), Math.min(j + 1, rows - 1)];
    for (let i = i0; i <= i1; i++, k += 3) {
      const y = at(i, j);
      positions[k] = origin.x + i * col.x + j * row.x;
      positions[k + 1] = y;
      positions[k + 2] = origin.z + i * col.z + j * row.z;
      low = Math.min(low, y);
      high = Math.max(high, y);
      const [ia, ib] = [Math.max(i - 1, 0), Math.min(i + 1, cols - 1)];
      const hx = (at(ib, j) - at(ia, j)) / (ib - ia);
      const hz = (at(i, jb) - at(i, ja)) / (jb - ja);
      // The world normal (−hx, 1, −hz), its horizontal part turned into the plan.
      const nx = -hx * col.x - hz * row.x;
      const nz = -hx * col.z - hz * row.z;
      const length = Math.sqrt(nx * nx + 1 + nz * nz);
      normals[k] = nx / length;
      normals[k + 1] = 1 / length;
      normals[k + 2] = nz / length;
      const slope = Math.acos(Math.min(1, 1 / length)) * DEG;
      groundColor(colors, k, terrain.biomes, grid.x0 + i, grid.z0 + j, slope, sea - y);
    }
  }
  const index = new Uint16Array((w - 1) * (h - 1) * 6);
  let n = 0;
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const v00 = j * w + i;
      const v10 = v00 + 1;
      const v01 = v00 + w;
      const v11 = v01 + 1;
      index[n++] = v00;
      index[n++] = v10;
      index[n++] = v01;
      index[n++] = v11;
      index[n++] = v01;
      index[n++] = v10;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(index, 1));
  // From the corners and the height range: no pass over the vertices.
  const last = 3 * (w * h - 1);
  const centre = new Vector3(
    (positions[0]! + positions[last]!) / 2,
    (low + high) / 2,
    (positions[2]! + positions[last + 2]!) / 2
  );
  const halfDiagonal = Math.hypot(w - 1, h - 1) / 2;
  geometry.boundingSphere = new Sphere(centre, Math.hypot(halfDiagonal, (high - low) / 2));
  return geometry;
};
