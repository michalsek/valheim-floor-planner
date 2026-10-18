/**
 * A site's patch in tiles: world-aligned squares of `TILE` metres (two zones, on the
 * zones' own borders), shared by the 3D surface's meshes and the 2D contours. A tile's
 * `key` hashes everything drawn from it (its heights and the ring around them, which
 * the 3D normals read, its biome corners and the plan frame), so a tile an extension or
 * an undo leaves alone keeps what was made from it, and only the tiles that changed are
 * made again. 128 m rather than one zone: a 1536 m site is 144 tiles, not 576 (each tile
 * is a few draws a frame). Pure.
 */
import type { SiteTerrain } from '../types';

import { worldToPlan, type SiteFrame } from './siteTerrain';

/** A tile's side (metres): two zones, so at most 129 × 129 vertices (16-bit indices). */
export const TILE = 128;
/** Tiles start on a zone border: the zones' corners are at `64k − 32`. */
const TILE_OFFSET = -32;

/** One tile of the patch: its vertices `i0..i1` × `j0..j1` of the grid (inclusive). */
export interface TerrainTile {
  /** The tile's place in the world (stable as the patch grows). */
  id: string;
  /** Its contents: equal keys make equal meshes and contours. */
  key: string;
  i0: number;
  i1: number;
  j0: number;
  j1: number;
  /** Its middle in the plan. */
  centre: { x: number; z: number };
}

const tileOf = (world: number) => Math.floor((world - TILE_OFFSET) / TILE);

/** Two 32-bit hashes (FNV-1a and a multiplicative one) over integers. */
class Hash {
  private a = 0x811c9dc5;
  private b = 0x9e3779b9;
  add(n: number): void {
    this.a = Math.imul(this.a ^ (n & 0xffff), 0x01000193);
    this.a = Math.imul(this.a ^ (n >>> 16), 0x01000193);
    this.b = Math.imul(this.b ^ n, 0x5bd1e995) ^ (this.b >>> 13);
  }
  addFloat(x: number): void {
    const f = new Float64Array([x]);
    new Int32Array(f.buffer).forEach((n) => this.add(n));
  }
  get value(): string {
    return `${(this.a >>> 0).toString(36)}.${(this.b >>> 0).toString(36)}`;
  }
}

/** The patch's tiles, each with its key. */
export const siteTiles = (terrain: SiteTerrain, frame: SiteFrame): TerrainTile[] => {
  const { x0, z0, cols, rows, heights, biomes } = terrain;
  const tiles: TerrainTile[] = [];
  for (let tz = tileOf(z0); tz <= tileOf(z0 + rows - 2); tz++) {
    for (let tx = tileOf(x0); tx <= tileOf(x0 + cols - 2); tx++) {
      // The tile's vertices: its square, clipped to the patch (borders shared).
      const i0 = Math.max(0, tx * TILE + TILE_OFFSET - x0);
      const i1 = Math.min(cols - 1, (tx + 1) * TILE + TILE_OFFSET - x0);
      const j0 = Math.max(0, tz * TILE + TILE_OFFSET - z0);
      const j1 = Math.min(rows - 1, (tz + 1) * TILE + TILE_OFFSET - z0);
      const hash = new Hash();
      for (const v of [frame.origin.x, frame.origin.y, frame.origin.z, frame.yaw]) {
        hash.addFloat(v);
      }
      // The ring the normals read, clipped to the patch: where it is clipped matters too.
      const [ri0, ri1] = [Math.max(0, i0 - 1), Math.min(cols - 1, i1 + 1)];
      const [rj0, rj1] = [Math.max(0, j0 - 1), Math.min(rows - 1, j1 + 1)];
      for (const v of [
        x0 + i0,
        x0 + i1,
        z0 + j0,
        z0 + j1,
        x0 + ri0,
        x0 + ri1,
        z0 + rj0,
        z0 + rj1,
      ]) {
        hash.add(v);
      }
      for (let j = rj0; j <= rj1; j++) {
        for (let i = ri0; i <= ri1; i++) hash.add(heights[j * cols + i]!);
      }
      // The zone corners the colours blend (`groundColor`).
      const corner = (w: number) => Math.floor((w + 32) / 64);
      for (let k = corner(z0 + j0); k <= corner(z0 + j1) + 1; k++) {
        for (let m = corner(x0 + i0); m <= corner(x0 + i1) + 1; m++) {
          const [bi, bj] = [m - biomes.zx0, k - biomes.zz0];
          const inside = bi >= 0 && bj >= 0 && bi < biomes.cols && bj < biomes.rows;
          hash.add(inside ? biomes.codes[bj * biomes.cols + bi]! : -1);
        }
      }
      const centre = worldToPlan(frame, { x: x0 + (i0 + i1) / 2, z: z0 + (j0 + j1) / 2 });
      tiles.push({ id: `${tx},${tz}`, key: hash.value, i0, i1, j0, j1, centre });
    }
  }
  return tiles;
};
