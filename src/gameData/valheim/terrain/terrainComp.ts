/**
 * `TerrainComp`: the player's terrain edits (hoe, pickaxe) per zone, from a
 * `_TerrainCompiler` ZDO's `TCData` byte array (a gzip ZPackage; the caller gunzips).
 * Layout: research/README.md §8.
 */
import { ByteReader } from '../../bytes/ByteReader';
import { GameDataError } from '../../GameDataError';

import { type PatchRect, ZONE_VERTICES, zoneOf, zoneOrigin } from './heightmap';

/** The only `TerrainComp` data version 1.0 writes. */
export const TERRAIN_COMP_VERSION = 1;
/** The game clamps a vertex to its generated height ± this. */
export const MAX_TERRAIN_DELTA = 8;

const VERTICES = ZONE_VERTICES * ZONE_VERTICES;

export interface TerrainComp {
  version: number;
  /** How many edits the player made in the zone. */
  ops: number;
  /** levelDelta + smoothDelta per vertex, index `row × 65 + col` (row = z). */
  delta: Float32Array;
  /** 1 where the height was edited. */
  edited: Uint8Array;
}

/** A decoded comp and the zone it belongs to. */
export interface ZoneTerrainComp {
  zx: number;
  zz: number;
  comp: TerrainComp;
}

/** Decodes an already gunzipped `TCData` payload; it must parse to the last byte. */
export const decodeTerrainComp = (bytes: Uint8Array): TerrainComp => {
  const r = new ByteReader(bytes, true);
  const version = r.i32();
  if (version !== TERRAIN_COMP_VERSION) {
    throw new GameDataError('unsupported', `terrain edit data version ${version}`);
  }
  const ops = r.i32();
  r.bytesView(16); // last edit's point and radius
  const n = r.i32();
  if (n !== VERTICES) throw new GameDataError('corrupt', `terrain edits for ${n} vertices`);
  const delta = new Float32Array(VERTICES);
  const edited = new Uint8Array(VERTICES);
  for (let i = 0; i < n; i++) {
    if (!r.bool()) continue;
    edited[i] = 1;
    delta[i] = r.f32() + r.f32();
  }
  const paint = r.i32();
  if (paint < 0) throw new GameDataError('corrupt', `terrain paint count ${paint}`);
  for (let i = 0; i < paint; i++) if (r.bool()) r.bytesView(16); // RGBA
  if (r.remaining !== 0)
    throw new GameDataError('corrupt', `${r.remaining} bytes after terrain edits`);
  return { version, ops, delta, edited };
};

/**
 * Applies zone comps to patch heights in place: `h + clamp(delta, ±8 m)`. Each vertex takes
 * the comp of the zone that owns it (`zoneOf`), so an edit on a zone edge, which the game
 * stores in both zones' comps, is applied once. Returns how many vertices changed.
 */
export const applyTerrainComps = (
  heights: Float32Array,
  rect: PatchRect,
  comps: readonly ZoneTerrainComp[]
): number => {
  let applied = 0;
  for (const { zx, zz, comp } of comps) {
    const x0 = zoneOrigin(zx);
    const z0 = zoneOrigin(zz);
    for (let row = 0; row < ZONE_VERTICES; row++) {
      const z = z0 + row;
      const pr = z - rect.z0;
      if (pr < 0 || pr >= rect.rows || zoneOf(z) !== zz) continue;
      for (let col = 0; col < ZONE_VERTICES; col++) {
        const x = x0 + col;
        const pc = x - rect.x0;
        const i = row * ZONE_VERTICES + col;
        if (pc < 0 || pc >= rect.cols || zoneOf(x) !== zx || !comp.edited[i]) continue;
        const d = Math.max(-MAX_TERRAIN_DELTA, Math.min(MAX_TERRAIN_DELTA, comp.delta[i]!));
        const at = pr * rect.cols + pc;
        heights[at] = heights[at]! + d;
        applied++;
      }
    }
  }
  return applied;
};
