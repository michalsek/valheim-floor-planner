/**
 * Each world's pregenerated rivers in the Origin Private File System, so only the first
 * terrain of a world pays for them (~1 s): the definitions and render states
 * (`encodePregenerated`, ~70–135 KB), never rendered points, never patches (those live
 * in the plan).
 *
 *     /valheimTerrain/index.json                     which worlds, last used
 *     /valheimTerrain/<riverCacheName(site)>/r<N>.bin  one per `GENERATOR_REVISION`
 *
 * The folder name is a hash, so no file names the seed. The `MAX_KEPT` most recently
 * used worlds are kept; without OPFS (or `createWritable`) nothing is.
 */
import type { WorldSite } from '../gameData/valheim/world/worldFiles';

import { RIVER_CACHE_ROOT, riverCacheName } from './worldCache';

/** Bumped when the port's output changes: older river files and plans are then stale. */
export const GENERATOR_REVISION = 1;
/** Worlds whose rivers are kept. */
const MAX_KEPT = 6;
const INDEX = 'index.json';
const FILE = `r${GENERATOR_REVISION}.bin`;

interface Entry {
  name: string;
  usedAt: number;
}

const rootDir = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const opfs = await navigator.storage.getDirectory();
    return await opfs.getDirectoryHandle(RIVER_CACHE_ROOT, { create: true });
  } catch {
    return null;
  }
};

const readIndex = async (root: FileSystemDirectoryHandle): Promise<Entry[]> => {
  try {
    const file = await (await root.getFileHandle(INDEX)).getFile();
    const list: unknown = JSON.parse(await file.text());
    return Array.isArray(list)
      ? list.filter((e): e is Entry => typeof e?.name === 'string' && typeof e?.usedAt === 'number')
      : [];
  } catch {
    return [];
  }
};

const write = async (dir: FileSystemDirectoryHandle, name: string, data: Blob | ArrayBuffer) => {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
};

/** Marks `name` as just used and drops the worlds beyond `MAX_KEPT`. */
const touch = async (root: FileSystemDirectoryHandle, name: string): Promise<void> => {
  const others = (await readIndex(root)).filter((e) => e.name !== name);
  const list = [{ name, usedAt: Date.now() }, ...others];
  const kept = list.slice(0, MAX_KEPT);
  await write(root, INDEX, new Blob([JSON.stringify(kept)], { type: 'application/json' }));
  for (const { name: stale } of list.slice(MAX_KEPT)) {
    await root.removeEntry(stale, { recursive: true }).catch(() => {});
  }
};

/** The world's kept pregeneration for this revision, or null. */
export const loadRivers = async (site: WorldSite): Promise<ArrayBuffer | null> => {
  const root = await rootDir();
  if (!root) return null;
  const name = await riverCacheName(site);
  try {
    const dir = await root.getDirectoryHandle(name);
    const buffer = await (await (await dir.getFileHandle(FILE)).getFile()).arrayBuffer();
    void touch(root, name).catch(() => {});
    return buffer;
  } catch {
    return null;
  }
};

/** Keeps the world's pregeneration (quietly does nothing where this browser can't). */
export const saveRivers = async (site: WorldSite, buffer: ArrayBuffer): Promise<void> => {
  const root = await rootDir();
  if (!root) return;
  try {
    const name = await riverCacheName(site);
    const dir = await root.getDirectoryHandle(name, { create: true });
    await write(dir, FILE, buffer);
    const older: string[] = [];
    for await (const file of dir.keys()) if (file !== FILE) older.push(file);
    for (const file of older) await dir.removeEntry(file).catch(() => {});
    await touch(root, name);
  } catch {
    // No `createWritable` (Safari) or no space: the rivers are made again next time.
  }
};
