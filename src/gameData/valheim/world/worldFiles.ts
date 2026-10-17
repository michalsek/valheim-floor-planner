/**
 * The small files of a chunked (1.0) world folder: which save generation to read, its
 * `.fwl2` header and its `.chunks` manifest. Layouts: research/README.md §7.
 */
import { ByteReader } from '../../bytes/ByteReader';
import { check, GameDataError } from '../../GameDataError';

import { isKnownVersion, readString } from './zpackage';

const GENERATION_FILE = /^_main\.(\d+)\.(fwl2|db2|chunks|ok)$/;
const GENERATION_PARTS = ['fwl2', 'db2', 'chunks', 'ok'];

/** Whether a folder listing looks like a chunked world (any `_main.N.*` file). */
export const isWorldListing = (names: readonly string[]): boolean =>
  names.some((name) => GENERATION_FILE.test(name));

/**
 * The newest save generation `N` with all four `_main.N.{fwl2,db2,chunks,ok}` files (a
 * save is committed by its `.ok`); null when there is none.
 */
export const newestGeneration = (names: readonly string[]): number | null => {
  const parts = new Map<number, Set<string>>();
  for (const name of names) {
    const match = GENERATION_FILE.exec(name);
    if (!match) continue;
    const n = Number(match[1]);
    if (!parts.has(n)) parts.set(n, new Set());
    parts.get(n)!.add(match[2]!);
  }
  const complete = [...parts].filter(([, have]) => GENERATION_PARTS.every((p) => have.has(p)));
  return complete.length === 0 ? null : Math.max(...complete.map(([n]) => n));
};

export const generationFile = (n: number, part: 'fwl2' | 'chunks'): string => `_main.${n}.${part}`;

const checkVersion = (version: number, what: string): void => {
  if (!isKnownVersion(version)) {
    throw new GameDataError('unsupported', `${what} has world version ${version}`);
  }
};

export interface WorldHeader {
  version: number;
  name: string;
}

/**
 * The `.fwl2` header: an int32 length, then a package starting with the version and
 * the world name. Reading stops there: the seed, keys and the player history (platform
 * IDs and names) that follow are never parsed.
 */
export const readFwl2Header = (bytes: Uint8Array): WorldHeader => {
  const r = new ByteReader(bytes, true);
  const length = r.i32();
  check(length > 0 && length <= r.remaining, () => `bad .fwl2 length ${length}`);
  const version = r.i32();
  checkVersion(version, 'The world file');
  return { version, name: readString(r) };
};

export interface ChunkEntry {
  /** `cx | cy << 8`, in 512 m base chunks. */
  chunk: number;
  /** 0–3: 1, 2, 4 or 8 base chunks a side. */
  size: number;
  /** Bumped whenever this chunk is rewritten (unrelated to the world version). */
  chunkVersion: number;
  zdos: number;
}

export interface ChunkManifest {
  version: number;
  totalZdos: number;
  entries: ChunkEntry[];
}

/** `_main.N.chunks`: the index of the chunk files (the only one; files aren't tied to N). */
export const readManifest = (bytes: Uint8Array): ChunkManifest => {
  const r = new ByteReader(bytes, true);
  const version = r.u16();
  checkVersion(version, 'The chunk index');
  const totalZdos = r.i32();
  const entries = Array.from({ length: r.count(11) }, () => ({
    chunk: r.u16(),
    size: r.u8(),
    chunkVersion: r.u32(),
    zdos: r.i32(),
  }));
  check(r.remaining === 0, 'trailing bytes in the chunk index');
  const sum = entries.reduce((n, e) => n + e.zdos, 0);
  check(sum === totalZdos, () => `the chunk index lists ${sum} of ${totalZdos} objects`);
  return { version, totalZdos, entries };
};

const hex = (byte: number): string => byte.toString(16).padStart(2, '0');

/** `%02x_%02x__%d_%d.chunk`: the high byte (z) first, lower-case hex. */
export const chunkFileName = (e: Pick<ChunkEntry, 'chunk' | 'size' | 'chunkVersion'>): string =>
  `${hex(e.chunk >> 8)}_${hex(e.chunk & 0xff)}__${e.size}_${e.chunkVersion}.chunk`;
