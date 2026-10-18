/**
 * The autosaved plan in IndexedDB, as structured clones: the site's heights go in as
 * the `Int16Array` they are (no text encoding), under a key of their own, so an edit
 * that leaves the terrain alone doesn't write them again. Every write is one
 * transaction, so the plan and its heights always match, whichever tab wrote last.
 */
import { newId } from '../model/newId';
import type { Plan } from '../model/types';

const DB_NAME = 'valheimFloorPlanner.autosave';
const STORE = 'plan';
const PLAN = 'plan';
const HEIGHTS = 'heights';
/** Which heights `HEIGHTS` holds (an id per array, below). */
const HEIGHTS_ID = 'heightsId';
const CORRUPT = 'corrupt';

/** The database, or null where IndexedDB is missing or refuses to open. */
export const openPlanDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
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

/** Runs `use` in one transaction; resolves once it has committed. */
const transact = (
  db: IDBDatabase,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Autosave transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Autosave transaction aborted'));
    use(tx.objectStore(STORE));
  });

/** The stored plan with its heights put back, unchecked (`parsePlan` checks it); null when none. */
export const readPlanRecord = async (db: IDBDatabase): Promise<unknown> => {
  let plan: unknown = null;
  let heights: unknown = null;
  await transact(db, 'readonly', (store) => {
    const p = store.get(PLAN);
    const h = store.get(HEIGHTS);
    p.onsuccess = () => (plan = p.result ?? null);
    h.onsuccess = () => (heights = h.result ?? null);
  });
  const terrain = (plan as Partial<Plan> | null)?.importFrame?.terrain;
  return terrain ? withHeights(plan as Plan, heights) : plan;
};

const withHeights = (plan: Plan, heights: unknown): unknown => ({
  ...plan,
  importFrame: { ...plan.importFrame, terrain: { ...plan.importFrame!.terrain, heights } },
});

const ids = new WeakMap<Int16Array, string>();
const idOf = (heights: Int16Array): string => {
  let id = ids.get(heights);
  if (!id) ids.set(heights, (id = newId()));
  return id;
};

/** Saves `plan`, writing its heights only when the stored ones are others. */
export const writePlanRecord = (db: IDBDatabase, plan: Plan): Promise<void> => {
  const heights = plan.importFrame?.terrain?.heights ?? null;
  const id = heights ? idOf(heights) : null;
  return transact(db, 'readwrite', (store) => {
    store.put(heights ? withHeights(plan, null) : plan, PLAN);
    const stored = store.get(HEIGHTS_ID);
    stored.onsuccess = () => {
      if (stored.result === id) return;
      store.put(heights, HEIGHTS);
      store.put(id, HEIGHTS_ID);
    };
  });
};

/** Keeps an unreadable record aside (as `KEY.corrupt` did in localStorage). */
export const keepCorruptRecord = async (db: IDBDatabase, record: unknown): Promise<void> => {
  try {
    await transact(db, 'readwrite', (store) => store.put(record, CORRUPT));
  } catch {
    // Nowhere left to keep it.
  }
};
