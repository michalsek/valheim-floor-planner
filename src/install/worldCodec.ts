/**
 * A read world as one binary file for the OPFS cache (`worldCache.ts`): a JSON header
 * (padded to 4 bytes) with the scalars and section sizes, then the typed arrays back to
 * back. Every section is copied out with `slice`, so none needs aligning.
 *
 *     header | positions | rotations | prefab indices | legacy edits
 *            | location positions | location hashes | terrain comps (concatenated)
 */
import type { WorldScan } from '../gameData/valheim/world/readWorld';
import type { WorldSite } from '../gameData/valheim/world/worldFiles';

/** What the planner keeps of a read world: the scan without its per-chunk stats. */
export type StoredWorld = Omit<WorldScan, 'chunks'>;

/** Bumped when the layout changes; files of another format are read again. */
export const WORLD_FORMAT = 2;

interface Header {
  format: number;
  name: string;
  version: number;
  generation: number | null;
  zdos: number;
  prefabs: string[];
  site: WorldSite | null;
  pieces: number;
  legacyEdits: number;
  /** Null: the scan has no locations. */
  locations: number | null;
  comps: { zx: number; zz: number; bytes: number }[];
}

export const encodeWorld = (world: StoredWorld): Blob => {
  const { pieces, legacyEdits, locations, terrainComps } = world;
  const header: Header = {
    format: WORLD_FORMAT,
    name: world.name,
    version: world.version,
    generation: world.generation,
    zdos: world.zdos,
    prefabs: pieces.prefabs,
    site: world.site,
    pieces: pieces.prefabIndex.length,
    legacyEdits: legacyEdits.length / 2,
    locations: locations ? locations.hash.length : null,
    comps: terrainComps.map(({ zx, zz, data }) => ({ zx, zz, bytes: data.length })),
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const padded = Math.ceil(json.length / 4) * 4;
  const head = new Uint8Array(4 + padded).fill(0x20);
  new DataView(head.buffer).setUint32(0, padded, true);
  head.set(json, 4);
  return new Blob([
    head,
    pieces.position,
    pieces.rotation,
    pieces.prefabIndex,
    legacyEdits,
    ...(locations ? [locations.position, locations.hash] : []),
    ...terrainComps.map((comp) => comp.data),
  ]);
};

/** The world in `buffer`; null for a file of another format. Throws on a damaged one. */
export const decodeWorld = (buffer: ArrayBuffer): StoredWorld | null => {
  const length = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, length))
  ) as Partial<Header>;
  if (header.format !== WORLD_FORMAT) return null;
  const h = header as Header;
  let at = 4 + length;
  const take = (bytes: number): ArrayBuffer => {
    if (at + bytes > buffer.byteLength) throw new RangeError('The kept world is cut short.');
    const part = buffer.slice(at, at + bytes);
    at += bytes;
    return part;
  };
  const n = h.pieces;
  const pieces = {
    prefabs: h.prefabs,
    position: new Float32Array(take(12 * n)),
    rotation: new Float32Array(take(12 * n)),
    prefabIndex: new Uint16Array(take(2 * n)),
  };
  const legacyEdits = new Float32Array(take(8 * h.legacyEdits));
  const k = h.locations;
  const locations =
    k === null
      ? null
      : { position: new Float32Array(take(12 * k)), hash: new Int32Array(take(4 * k)) };
  const terrainComps = h.comps.map(({ zx, zz, bytes }) => ({
    zx,
    zz,
    data: new Uint8Array(take(bytes)),
  }));
  return {
    name: h.name,
    version: h.version,
    generation: h.generation,
    zdos: h.zdos,
    pieces,
    site: h.site,
    terrainComps,
    legacyEdits,
    locations,
  };
};
