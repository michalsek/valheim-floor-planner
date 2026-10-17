/**
 * Read worlds kept in the Origin Private File System, so reopening one is instant: only
 * the piece index (prefab, pivot, rotation per built piece), never player data.
 *
 *     /valheimWorlds/index.json       what is kept (name, generation, counts)
 *     /valheimWorlds/<key>.bin        one world's pieces
 *
 * The key hashes the folder's name, its save generation and its size, so a newer save
 * of the same world is read again. Entries are kept by key (servers often all call
 * their world "Dedicated"), the most recently used `MAX_KEPT` of them. Without OPFS
 * (or `createWritable`) nothing is kept.
 */
import type { WorldPieces } from '../gameData/valheim/world/worldPieces';

import { shortHash } from './shortHash';

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
}

/** What the planner keeps of a read world. */
export interface StoredWorld {
  name: string;
  version: number;
  generation: number | null;
  zdos: number;
  pieces: WorldPieces;
}

export const worldKey = (signature: string): Promise<string> => shortHash(signature);

const rootDir = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle(ROOT, {
      create: true,
    });
  } catch {
    return null;
  }
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
  'usedAt' in value;

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

/** A header (JSON, padded to 4 bytes), then the positions, rotations and prefab indices. */
const encode = (world: StoredWorld): Blob => {
  const { pieces, ...meta } = world;
  const json = new TextEncoder().encode(JSON.stringify({ ...meta, prefabs: pieces.prefabs }));
  const padded = Math.ceil(json.length / 4) * 4;
  const head = new Uint8Array(4 + padded).fill(0x20);
  new DataView(head.buffer).setUint32(0, padded, true);
  head.set(json, 4);
  return new Blob([head, pieces.position, pieces.rotation, pieces.prefabIndex]);
};

const decode = (buffer: ArrayBuffer): StoredWorld => {
  const length = new DataView(buffer).getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length))) as Omit<
    StoredWorld,
    'pieces'
  > & { prefabs: string[] };
  const start = 4 + length;
  const count = (buffer.byteLength - start) / 26; // 12 + 12 + 2 bytes a piece
  const { prefabs, ...rest } = meta;
  return {
    ...rest,
    pieces: {
      prefabs,
      position: new Float32Array(buffer.slice(start, start + count * 12)),
      rotation: new Float32Array(buffer.slice(start + count * 12, start + count * 24)),
      prefabIndex: new Uint16Array(buffer.slice(start + count * 24)),
    },
  };
};

export const loadCachedWorld = async (key: string): Promise<StoredWorld | null> => {
  const dir = await rootDir();
  const file = dir && (await readFile(dir, fileName(key)));
  if (!file) return null;
  try {
    return decode(await file.arrayBuffer());
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
    await writeFile(dir, fileName(key), encode(world));
    const entry: CachedWorld = {
      key,
      name: world.name,
      folder,
      generation: world.generation,
      zdos: world.zdos,
      pieces: world.pieces.prefabIndex.length,
      usedAt: Date.now(),
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

export const forgetCachedWorld = async (key: string): Promise<void> => {
  const dir = await rootDir();
  if (!dir) return;
  await dir.removeEntry(fileName(key)).catch(() => {});
  await writeIndex(
    dir,
    (await listCachedWorlds()).filter((w) => w.key !== key)
  ).catch(() => {});
};
