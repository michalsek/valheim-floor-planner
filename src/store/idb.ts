/**
 * Opening an IndexedDB database with one object store, shared by the browser stores
 * (autosave, underlay images, the install). Resolves to null where IndexedDB is missing,
 * refuses to open, or another tab blocks the upgrade. The connection closes itself when
 * another tab asks for a newer version, so it never blocks that upgrade; later requests
 * on it then fail (`onClose` hears it), and each store treats a failed request as "not
 * kept".
 */
export const openDatabase = (
  name: string,
  store: string,
  onClose: () => void = () => {}
): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    try {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          onClose();
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

/**
 * One shared connection, opened on first use and opened again after it closed (another
 * tab's upgrade).
 */
export const databaseGetter = (
  name: string,
  store: string
): (() => Promise<IDBDatabase | null>) => {
  let db: Promise<IDBDatabase | null> | null = null;
  return () => (db ??= openDatabase(name, store, () => (db = null)));
};

/**
 * Runs `use` on the store in one transaction; resolves once it has committed, rejects
 * when it fails or aborts (or when the connection is closed).
 */
export const transact = (
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, mode);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`${store} transaction failed`));
    tx.onabort = () => reject(tx.error ?? new Error(`${store} transaction aborted`));
    use(tx.objectStore(store));
  });

/** One request in a transaction: its result once the transaction has committed. */
export const request = async <T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  make: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  let req: IDBRequest<T> | null = null;
  await transact(db, store, mode, (s) => (req = make(s)));
  return (req as IDBRequest<T> | null)!.result;
};
