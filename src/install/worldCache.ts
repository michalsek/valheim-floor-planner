/**
 * Read worlds kept in the Origin Private File System, so reopening one is instant: the
 * piece index (prefab, pivot, rotation per built piece) and what the terrain needs (the
 * seed, the zones' terrain edits, legacy edit positions, location instances), never
 * player data.
 *
 *     /valheimWorlds/index.json       what is kept (name, generation, counts)
 *     /valheimWorlds/<key>.bin        one world (`worldCodec.ts`)
 *     /valheimTerrain/<site>/…        a world's pregenerated rivers (`riverCacheName`)
 *
 * The key hashes the folder's name, its save generation and its size, so a newer save
 * of the same world is read again. Entries are kept by key (servers often all call
 * their world "Dedicated"), the most recently used `MAX_KEPT` of them. Without OPFS
 * (or `createWritable`) nothing is kept.
 */
import type { WorldSite } from '../gameData/valheim/world/worldFiles';

import { shortHash } from './shortHash';
import { decodeWorld, encodeWorld, WORLD_FORMAT, type StoredWorld } from './worldCodec';

export type { StoredWorld } from './worldCodec';

const ROOT = 'valheimWorlds';
const INDEX = 'index.json';
/** Worlds kept at most; the least recently used goes first. */
export const MAX_KEPT = 6;

/** What a kept world shows in the list. */
export interface CachedWorld {
  key: string;
  /** The world's name (from its save) and the folder it was read from. */
  name: string;
  folder: string;
  generation: number | null;
  zdos: number;
  pieces: number;
  /** When it was read or last opened (ms since the epoch). */
  usedAt: number;
  /** `WORLD_FORMAT` of its file; entries of another are dropped from the list. */
  format: number;
}

export const worldKey = (signature: string): Promise<string> => shortHash(signature);

const opfsDir = async (name: string): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle(name, {
      create: true,
    });
  } catch {
    return null;
  }
};

const rootDir = () => opfsDir(ROOT);

/** Where every world's pregenerated rivers are kept (`terrainCache.ts`). */
export const RIVER_CACHE_ROOT = 'valheimTerrain';

/**
 * The folder under `RIVER_CACHE_ROOT` for one world's pregenerated rivers (a file per
 * generator revision inside). A hash, so the seed never names a file.
 */
export const riverCacheName = (site: WorldSite): Promise<string> =>
  shortHash(`rivers|${site.seed}|${site.worldGenVersion}`);

const forgetRivers = async (site: WorldSite): Promise<void> => {
  const dir = await opfsDir(RIVER_CACHE_ROOT);
  if (dir) await dir.removeEntry(await riverCacheName(site), { recursive: true }).catch(() => {});
};

const readFile = async (dir: FileSystemDirectoryHandle, name: string): Promise<File | null> => {
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
};

const writeFile = async (dir: FileSystemDirectoryHandle, name: string, data: Blob) => {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
};

const isCachedWorld = (value: unknown): value is CachedWorld =>
  typeof value === 'object' &&
  value !== null &&
  'key' in value &&
  'name' in value &&
  'folder' in value &&
  'usedAt' in value &&
  'format' in value &&
  value.format === WORLD_FORMAT;

export const listCachedWorlds = async (): Promise<CachedWorld[]> => {
  const dir = await rootDir();
  const file = dir && (await readFile(dir, INDEX));
  if (!file) return [];
  try {
    const list: unknown = JSON.parse(await file.text());
    return Array.isArray(list) ? list.filter(isCachedWorld) : [];
  } catch {
    return [];
  }
};

const writeIndex = async (dir: FileSystemDirectoryHandle, list: readonly CachedWorld[]) =>
  writeFile(dir, INDEX, new Blob([JSON.stringify(list)], { type: 'application/json' }));

const fileName = (key: string) => `${key}.bin`;

export const loadCachedWorld = async (key: string): Promise<StoredWorld | null> => {
  const dir = await rootDir();
  const file = dir && (await readFile(dir, fileName(key)));
  if (!file) return null;
  try {
    return decodeWorld(await file.arrayBuffer());
  } catch {
    return null;
  }
};

/** Keeps `world` (read from `folder`) under `key`; false when this browser can't. */
export const saveCachedWorld = async (
  key: string,
  folder: string,
  world: StoredWorld
): Promise<boolean> => {
  const dir = await rootDir();
  if (!dir) return false;
  try {
    await writeFile(dir, fileName(key), encodeWorld(world));
    const entry: CachedWorld = {
      key,
      name: world.name,
      folder,
      generation: world.generation,
      zdos: world.zdos,
      pieces: world.pieces.prefabIndex.length,
      usedAt: Date.now(),
      format: WORLD_FORMAT,
    };
    const others = (await listCachedWorlds()).filter((w) => w.key !== key);
    const kept = [entry, ...others].sort((a, b) => b.usedAt - a.usedAt);
    await writeIndex(dir, kept.slice(0, MAX_KEPT));
    // Files no entry points at any more: the least recently used, an older index's.
    const live = new Set(kept.slice(0, MAX_KEPT).map((w) => fileName(w.key)));
    const stale: string[] = [];
    for await (const name of dir.keys()) {
      if (name !== INDEX && !live.has(name)) stale.push(name);
    }
    for (const name of stale) await dir.removeEntry(name).catch(() => {});
    return true;
  } catch {
    return false;
  }
};

/** Marks a kept world as just used (it moves to the front of the list). */
export const touchCachedWorld = async (key: string): Promise<void> => {
  const dir = await rootDir();
  if (!dir) return;
  const list = await listCachedWorlds();
  const now = Date.now();
  const touched = list.map((w) => (w.key === key ? { ...w, usedAt: now } : w));
  await writeIndex(
    dir,
    touched.sort((a, b) => b.usedAt - a.usedAt)
  ).catch(() => {});
};

/** Deletes a kept world and its world's pregenerated rivers (they are made again when needed). */
export const forgetCachedWorld = async (key: string): Promise<void> => {
  const dir = await rootDir();
  if (!dir) return;
  const site = (await loadCachedWorld(key))?.site;
  if (site) await forgetRivers(site);
  await dir.removeEntry(fileName(key)).catch(() => {});
  await writeIndex(
    dir,
    (await listCachedWorlds()).filter((w) => w.key !== key)
  ).catch(() => {});
};
