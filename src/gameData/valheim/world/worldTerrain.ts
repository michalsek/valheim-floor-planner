/**
 * What a world scan keeps for the terrain beside the pieces: each edited zone's
 * `TerrainComp` payload (still gzip; decoded when a patch is made) and where the pre-1.0
 * terrain-edit pieces stand. Layouts: research/README.md §8.
 */
import type { Zdo } from './readZdo';
import { LEGACY_TERRAIN_EDITS } from './worldPrefabs';

/** One zone's terrain edits: the `TCData` bytes of its `_TerrainCompiler`, as saved. */
export interface TerrainCompBlob {
  /** The zone (64 m): `floor((world + 32) / 64)` on x and z. */
  zx: number;
  zz: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface WorldTerrainEdits {
  terrainComps: TerrainCompBlob[];
  /** x, z per pre-1.0 terrain-edit piece (world metres, game axes). */
  legacyEdits: Float32Array<ArrayBuffer>;
}

export const ZONE_SIZE = 64;

/** The zone a world coordinate lies in. */
export const zoneOf = (v: number): number => Math.floor((v + ZONE_SIZE / 2) / ZONE_SIZE);

/** Collects terrain edits one ZDO at a time, then packs them. */
export const terrainCollector = () => {
  const terrainComps: TerrainCompBlob[] = [];
  const legacy: number[] = [];
  return {
    add(zdo: Zdo): void {
      if (zdo.terrainData) {
        terrainComps.push({
          zx: zoneOf(zdo.x),
          zz: zoneOf(zdo.z),
          data: zdo.terrainData,
        });
      }
      if (LEGACY_TERRAIN_EDITS.has(zdo.prefab)) legacy.push(zdo.x, zdo.z);
    },
    pack: (): WorldTerrainEdits => ({ terrainComps, legacyEdits: Float32Array.from(legacy) }),
  };
};
