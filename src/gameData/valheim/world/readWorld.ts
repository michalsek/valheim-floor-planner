/**
 * Reads a world's built pieces: a 1.0 chunked world folder, or a legacy `.db` (v31–39,
 * the same ZDO encoding). Runs in a worker. Only ZDOs whose prefab is in `names` (the
 * Hammer's catalogue) and that a player placed are kept; ruins, which use the same
 * prefabs, have no creator. Objects a player placed that aren't kept are counted
 * (`skipped`), never dropped unseen. For the terrain it also keeps the seed, the zones' terrain
 * edits, legacy terrain-edit pieces and (from `.db2`, async) the location instances.
 * Layouts: research/README.md §7–§8.
 */
import { ByteReader } from '../../bytes/ByteReader';
import { check, GameDataError } from '../../GameDataError';

import { readDb2Locations, type WorldLocations } from './readDb2';
import { readZdo } from './readZdo';
import {
  chunkFileName,
  generationFile,
  isWorldListing,
  newestGeneration,
  readFwl2Header,
  readManifest,
  type WorldSite,
} from './worldFiles';
import { pieceCollector, type WorldPieces } from './worldPieces';
import { terrainCollector, type WorldTerrainEdits } from './worldTerrain';
import { CHUNKED_VERSION, isKnownVersion } from './zpackage';

/** A chunked world folder's files, read synchronously. */
export interface WorldFolderFiles {
  /** Every file name in the folder. */
  names: readonly string[];
  size(name: string): number;
  read(name: string): Uint8Array;
}

/** Bytes read so far, of `total`. */
export type ScanProgress = (done: number, total: number) => void;

export interface ChunkStat {
  file: string;
  zdos: number;
  bytes: number;
}

export interface WorldScan extends WorldTerrainEdits {
  /** The world's name (a legacy `.db`'s file name). */
  name: string;
  version: number;
  /** The save generation read (`_main.N`); null for a legacy `.db`. */
  generation: number | null;
  /** Every object in the save, built or not. */
  zdos: number;
  chunks: ChunkStat[];
  pieces: WorldPieces;
  /**
   * Objects a player placed whose prefab isn't in `names`: ships and carts, or a piece
   * the catalogue doesn't have (a mod's, a newer game's).
   */
  skipped: number;
  /** The seed and generator version; null for a legacy `.db` (it has no `.fwl2`). */
  site: WorldSite | null;
  /** The `.db2` location instances; null for a legacy `.db`, or when unreadable. */
  locations: WorldLocations | null;
}

/** The pieces and the terrain edits, gathered as ZDOs are read. */
const collectors = (names: ReadonlyMap<number, string>) => {
  const pieces = pieceCollector(names);
  const terrain = terrainCollector();
  let skipped = 0;
  return {
    add(zdo: ReturnType<typeof readZdo>): void {
      if (zdo.built) {
        if (names.has(zdo.prefab)) pieces.add(zdo);
        else skipped++;
      }
      terrain.add(zdo);
    },
    pack: () => ({ pieces: pieces.pack(), skipped, ...terrain.pack() }),
  };
};

type Collector = ReturnType<typeof collectors>;

/** Decodes `count` ZDOs into `collect`. */
const readZdos = (
  r: ByteReader,
  version: number,
  count: number,
  collect: Collector,
  onZdo?: () => void
): void => {
  for (let i = 0; i < count; i++) {
    collect.add(readZdo(r, version));
    onZdo?.();
  }
};

/** One `.chunk` file: int16 version, int32 count, the ZDOs, and not a byte more. */
const readChunk = (
  bytes: Uint8Array,
  file: string,
  expected: number,
  collect: Collector
): number => {
  const r = new ByteReader(bytes, true);
  const version = r.i16();
  if (!isKnownVersion(version) || version < CHUNKED_VERSION) {
    throw new GameDataError('unsupported', `${file} has world version ${version}`);
  }
  const count = r.i32();
  check(count === expected, () => `${file} holds ${count} objects, the index says ${expected}`);
  try {
    readZdos(r, version, count, collect);
  } catch (error) {
    // A cut-short chunk: say which file.
    if (error instanceof GameDataError)
      throw new GameDataError(error.code, `${file}: ${error.detail}`);
    throw error;
  }
  check(r.remaining === 0, () => `${file} has ${r.remaining} bytes after its last object`);
  return count;
};

/**
 * The locations, or null when `.db2` doesn't parse: they only feed the terrain's
 * self-check, so a surprise there mustn't stop an import of the pieces.
 */
const readLocations = async (bytes: Uint8Array): Promise<WorldLocations | null> => {
  try {
    return await readDb2Locations(bytes);
  } catch (error) {
    if (error instanceof GameDataError) return null;
    throw error;
  }
};

export const readChunkedWorld = async (
  files: WorldFolderFiles,
  names: ReadonlyMap<number, string>,
  onProgress: ScanProgress = () => {}
): Promise<WorldScan> => {
  const generation = newestGeneration(files.names);
  if (generation === null) {
    // Some of a save's files but no complete one: a copy taken mid-save, or partial.
    if (isWorldListing(files.names)) {
      throw new GameDataError(
        'incomplete',
        'No save has all of _main.N.fwl2, .db2, .chunks and .ok (missing files).'
      );
    }
    throw new GameDataError('notWorld', 'No save (_main.N.fwl2, .db2, .chunks, .ok).');
  }
  const header = readFwl2Header(files.read(generationFile(generation, 'fwl2')));
  const manifest = readManifest(files.read(generationFile(generation, 'chunks')));
  const listed = manifest.entries.map((entry) => ({ entry, file: chunkFileName(entry) }));
  const present = new Set(files.names);
  const missing = listed.filter(({ file }) => !present.has(file));
  if (missing.length > 0) {
    throw new GameDataError('incomplete', `Missing ${missing.map((m) => m.file).join(', ')}`);
  }
  const total = listed.reduce((n, { file }) => n + files.size(file), 0);
  const collect = collectors(names);
  const chunks: ChunkStat[] = [];
  let done = 0;
  onProgress(0, total);
  for (const { entry, file } of listed) {
    const bytes = files.read(file);
    chunks.push({
      file,
      zdos: readChunk(bytes, file, entry.zdos, collect),
      bytes: bytes.length,
    });
    done += bytes.length;
    onProgress(done, total);
  }
  const { seed, worldGenVersion } = header;
  return {
    name: header.name,
    version: header.version,
    generation,
    zdos: manifest.totalZdos,
    chunks,
    ...collect.pack(),
    site: { seed, worldGenVersion },
    locations: await readLocations(files.read(generationFile(generation, 'db2'))),
  };
};

/** How often (in ZDOs) a legacy read reports progress. */
const PROGRESS_EVERY = 8192;

/**
 * A legacy `.db` (before 1.0): int32 version, double net time, int64 own id, uint32
 * next uid, int32 count, then the ZDOs back to back (zones and events follow, unread).
 */
export const readLegacyDb = (
  bytes: Uint8Array,
  fileName: string,
  names: ReadonlyMap<number, string>,
  onProgress: ScanProgress = () => {}
): WorldScan => {
  const r = new ByteReader(bytes, true);
  const version = r.i32();
  if (!isKnownVersion(version) || version >= CHUNKED_VERSION) {
    throw new GameDataError('unsupported', `${fileName} has world version ${version}`);
  }
  r.bytesView(8 + 8 + 4); // net time, own id, next uid
  const count = r.count(10);
  const collect = collectors(names);
  let seen = 0;
  readZdos(r, version, count, collect, () => {
    if (++seen % PROGRESS_EVERY === 0) onProgress(r.pos, bytes.length);
  });
  onProgress(bytes.length, bytes.length);
  return {
    name: fileName.replace(/\.db$/i, ''),
    version,
    generation: null,
    zdos: count,
    chunks: [],
    ...collect.pack(),
    site: null,
    locations: null,
  };
};
