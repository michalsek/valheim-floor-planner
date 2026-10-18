/**
 * What survives a reload, in IndexedDB (its own database, so `imageStore`'s schema is
 * untouched): the picked folder's handle, and the last parsed catalogue (~260 KB)
 * keyed by the install's fingerprint. Without IndexedDB both are simply absent.
 */
export interface InstallInfo {
  folderName: string;
  unityVersion: string;
  buildGuid: string;
  pieceCount: number;
  /** When it was parsed (ms since the epoch). */
  scannedAt: number;
}

export interface CachedCatalogue {
  key: string;
  /** Raw data in the shape of `research/valheim-pieces.json` / `valheim-items.json`. */
  pieces: unknown;
  items: unknown;
  info: InstallInfo;
}

import { databaseGetter, request } from '../store/idb';

const DB_NAME = 'valheimInstall';
const STORE = 'install';
const HANDLE = 'handle';
const CACHE = 'catalogue';

const openDb = databaseGetter(DB_NAME, STORE);

/** Runs one request in a transaction; resolves with its result once committed. */
const run = async (
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest
): Promise<unknown> => {
  const db = await openDb();
  return db ? request(db, STORE, mode, makeRequest) : null;
};

const get = async (key: string): Promise<unknown> => {
  try {
    return await run('readonly', (store) => store.get(key));
  } catch {
    return null;
  }
};

const put = async (key: string, value: unknown): Promise<void> => {
  try {
    await run('readwrite', (store) => (value === null ? store.delete(key) : store.put(value, key)));
  } catch (error) {
    console.warn(`Could not store the ${key}; it will be asked for again next visit.`, error);
  }
};

export const getHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const value = await get(HANDLE);
  return typeof FileSystemDirectoryHandle !== 'undefined' &&
    value instanceof FileSystemDirectoryHandle
    ? value
    : null;
};

/** Stores the picked folder; null forgets it (the install was picked another way). */
export const putHandle = (handle: FileSystemDirectoryHandle | null): Promise<void> =>
  put(HANDLE, handle);

export const getCache = async (): Promise<CachedCatalogue | null> => {
  const value = await get(CACHE);
  return typeof value === 'object' && value !== null && 'key' in value
    ? (value as CachedCatalogue)
    : null;
};

export const putCache = (cache: CachedCatalogue): Promise<void> => put(CACHE, cache);
