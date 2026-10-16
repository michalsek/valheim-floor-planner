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

const DB_NAME = 'valheimInstall';
const STORE = 'install';
const HANDLE = 'handle';
const CACHE = 'catalogue';

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

/** Runs one request in a transaction; resolves with its result once committed. */
const run = async (
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest
): Promise<unknown> => {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = makeRequest(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error('Install store transaction aborted'));
  });
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
