/**
 * Underlay images by id, in IndexedDB (they are too big for localStorage). An image
 * IndexedDB can't take (it is unavailable, or the write fails) is kept in memory for
 * this session only.
 */
const DB_NAME = 'valheimFloorPlanner';
const STORE = 'images';

const memory = new Map<string, Blob>();
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
const run = <T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = makeRequest(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error('Image store transaction aborted'));
  });

export const putImage = async (id: string, blob: Blob): Promise<void> => {
  const db = await openDb();
  try {
    if (!db) throw new Error('IndexedDB is unavailable');
    await run(db, 'readwrite', (store) => store.put(blob, id));
  } catch (error) {
    console.warn('Could not store the underlay image; it is kept for this session.', error);
    memory.set(id, blob);
  }
};

export const getImage = async (id: string): Promise<Blob | null> => {
  const cached = memory.get(id);
  if (cached) return cached;
  const db = await openDb();
  if (!db) return null;
  try {
    const value = await run<unknown>(db, 'readonly', (store) => store.get(id));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
};

/**
 * Deletes every stored image not in `keep`. Only safe at start-up, while history is
 * empty: an undo or redo may bring back an underlay whose image was replaced.
 */
export const pruneImages = async (keep: ReadonlySet<string>): Promise<void> => {
  for (const id of memory.keys()) if (!keep.has(id)) memory.delete(id);
  const db = await openDb();
  if (!db) return;
  try {
    const keys = await run(db, 'readonly', (store) => store.getAllKeys());
    const stale = keys.filter((key) => typeof key === 'string' && !keep.has(key));
    for (const key of stale) await run(db, 'readwrite', (store) => store.delete(key));
  } catch (error) {
    console.warn('Could not prune stored underlay images.', error);
  }
};
