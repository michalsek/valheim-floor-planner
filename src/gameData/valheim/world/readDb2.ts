/**
 * The location instances in a world's `.db2` (research/README.md §7): where the world
 * generator put every ruin, dolmen and dungeon, with the generator's own height at its
 * centre. The terrain self-check compares those heights with ours. Reading stops after
 * the locations; the events that follow are never parsed.
 */
import { ByteReader } from '../../bytes/ByteReader';
import { gunzip } from '../../bytes/gunzip';
import { check, GameDataError } from '../../GameDataError';

import { isKnownVersion, skipString } from './zpackage';

export interface WorldLocations {
  /** x, y, z per location (world metres, game axes); y is the generator's height there. */
  position: Float32Array<ArrayBuffer>;
  /** Each location prefab's stable hash. */
  hash: Int32Array<ArrayBuffer>;
}

/** Bytes per location: int32 hash, float x, y, z, bool placed. */
const LOCATION_BYTES = 17;

/**
 * int32 version, double net time, then the ZoneSystem block (int32 length + gzip): the
 * generated zones (Vector2s), the location version, global keys, a "generated" flag
 * and the locations.
 */
export const readDb2Locations = async (bytes: Uint8Array): Promise<WorldLocations> => {
  const r = new ByteReader(bytes, true);
  const version = r.i32();
  if (!isKnownVersion(version)) {
    throw new GameDataError('unsupported', `The zone file has world version ${version}`);
  }
  r.f64(); // net time
  const length = r.i32();
  const zones = new ByteReader(await gunzip(r.bytesView(length)), true);
  zones.bytesView(4 * zones.count(4)); // generated zones: int16 x, z each
  zones.i32(); // location version
  const keys = zones.count(1);
  for (let i = 0; i < keys; i++) skipString(zones);
  zones.bool(); // locations generated
  const n = zones.count(LOCATION_BYTES);
  const position = new Float32Array(3 * n);
  const hash = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    hash[i] = zones.i32();
    position[3 * i] = zones.f32();
    position[3 * i + 1] = zones.f32();
    position[3 * i + 2] = zones.f32();
    zones.bool(); // placed
  }
  check(zones.remaining === 0, 'trailing bytes after the locations');
  return { position, hash };
};
