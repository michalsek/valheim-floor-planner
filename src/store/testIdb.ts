/**
 * Node-only: a minimal in-memory stand-in for one IndexedDB object store, enough for
 * `planDb.ts` in tests (get, put, delete; requests answer asynchronously, the
 * transaction completes after them; values are structured clones, as in a browser).
 * `failing` makes every transaction fail.
 */
export interface FakeDb {
  db: IDBDatabase;
  data: Map<IDBValidKey, unknown>;
  /** Keys put, in order. */
  puts: IDBValidKey[];
  failing: boolean;
}

const later = (run: () => void) => setTimeout(run, 0);

export const fakeDb = (): FakeDb => {
  const fake: FakeDb = {
    db: null as unknown as IDBDatabase,
    data: new Map(),
    puts: [],
    failing: false,
  };
  const transaction = () => {
    let open = 0;
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null as Error | null,
      objectStore: () => store,
    };
    const finish = () =>
      later(() => {
        if (open > 0) return;
        if (fake.failing) {
          tx.error = new Error('fake transaction failed');
          tx.onerror?.();
        } else tx.oncomplete?.();
      });
    const ask = <T>(run: () => T) => {
      open++;
      const req = { result: undefined as T | undefined, onsuccess: null as (() => void) | null };
      later(() => {
        req.result = run();
        req.onsuccess?.();
        open--;
        finish();
      });
      return req;
    };
    const store = {
      get: (key: IDBValidKey) => ask(() => structuredClone(fake.data.get(key))),
      put: (value: unknown, key: IDBValidKey) =>
        ask(() => {
          fake.puts.push(key);
          fake.data.set(key, structuredClone(value));
          return key;
        }),
      delete: (key: IDBValidKey) => ask(() => void fake.data.delete(key)),
    };
    finish();
    return tx;
  };
  fake.db = { transaction } as unknown as IDBDatabase;
  return fake;
};
