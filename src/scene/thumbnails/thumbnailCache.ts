/**
 * Palette thumbnails kept per browser in IndexedDB: a WebP blob per key (prefab, game
 * build, asset and thumbnail versions), or `NO_MODEL` for prefabs that draw nothing.
 * Every access is guarded: without IndexedDB (blocked site data, private modes) reads
 * miss and writes are dropped, so thumbnails are only rendered again.
 */
const DB_NAME = 'valheimFloorPlanner.thumbnails';
const STORE = 'thumbnails';

/** Stored for a prefab whose model draws nothing. */
export const NO_MODEL = 'none';

export type CachedThumbnail = Blob | typeof NO_MODEL;

let db: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  db ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return db;
};

const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
  fallback: T
): Promise<T> => {
  const opened = await openDb();
  if (!opened) return fallback;
  return new Promise((resolve) => {
    try {
      const request = action(opened.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? fallback);
      request.onerror = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
};

/** The stored thumbnail, or undefined. */
export const readThumbnail = async (key: string): Promise<CachedThumbnail | undefined> => {
  const value = await run<unknown>('readonly', (store) => store.get(key), undefined);
  return value instanceof Blob || value === NO_MODEL ? value : undefined;
};

export const writeThumbnail = (key: string, value: CachedThumbnail): Promise<void> =>
  run('readwrite', (store) => store.put(value, key), undefined);

/** Deletes thumbnails whose keys don't start with `prefix` (other builds or versions). */
export const pruneThumbnails = async (prefix: string): Promise<void> => {
  const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys(), []);
  const stale = keys.filter((key) => typeof key !== 'string' || !key.startsWith(prefix));
  await Promise.all(stale.map((key) => run('readwrite', (store) => store.delete(key), undefined)));
};
