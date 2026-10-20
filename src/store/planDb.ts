/**
 * The autosaved plan in IndexedDB, as structured clones: the site's heights go in as
 * the `Int16Array` they are (no text encoding), under a key of their own, so an edit
 * that leaves the terrain alone doesn't write them again. Every write is one
 * transaction, so the plan and its heights always match, whichever tab wrote last.
 */
import { newId } from '../model/newId';
import type { Plan } from '../model/types';

import { openDatabase, transact as transactStore } from './idb';

const DB_NAME = 'valheimFloorPlanner.autosave';
const STORE = 'plan';
const PLAN = 'plan';
const HEIGHTS = 'heights';
/** Which heights `HEIGHTS` holds (an id per array, below). */
const HEIGHTS_ID = 'heightsId';
const CORRUPT = 'corrupt';
/** A record that held drawn items when it was loaded (M18), as it was. */
const LEGACY = 'legacy';

/** The database, or null where IndexedDB is missing or refuses to open. */
export const openPlanDb = (): Promise<IDBDatabase | null> => openDatabase(DB_NAME, STORE);

/** The id of each heights array stored or loaded this session. */
const ids = new WeakMap<Int16Array, string>();

const transact = (
  db: IDBDatabase,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => void
): Promise<void> => transactStore(db, STORE, mode, use);

/**
 * The stored plan with its heights put back, unchecked (`parsePlan` checks it); null
 * when none. Rejects when the read itself fails (not the same as nothing stored).
 */
export const readPlanRecord = async (db: IDBDatabase): Promise<unknown> => {
  let plan: unknown = null;
  let heights: unknown = null;
  let heightsId: unknown = null;
  await transact(db, 'readonly', (store) => {
    const p = store.get(PLAN);
    const h = store.get(HEIGHTS);
    const i = store.get(HEIGHTS_ID);
    p.onsuccess = () => (plan = p.result ?? null);
    h.onsuccess = () => (heights = h.result ?? null);
    i.onsuccess = () => (heightsId = i.result ?? null);
  });
  // The loaded array is the stored one: the first save of a session needn't write it.
  if (heights instanceof Int16Array && typeof heightsId === 'string') ids.set(heights, heightsId);
  const terrain = (plan as Partial<Plan> | null)?.importFrame?.terrain;
  return terrain ? withHeights(plan as Plan, heights) : plan;
};

const withHeights = (plan: Plan, heights: unknown): unknown => ({
  ...plan,
  importFrame: { ...plan.importFrame, terrain: { ...plan.importFrame!.terrain, heights } },
});

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

/**
 * Keeps a record with drawn items aside before the autosave overwrites it without them.
 * A copy kept earlier stays: true when the kept copy is this record (just written, or
 * the same one kept before), false when it is another's or the write failed.
 */
export const keepLegacyRecord = async (db: IDBDatabase, record: unknown): Promise<boolean> => {
  let kept = false;
  try {
    await transact(db, 'readwrite', (store) => {
      const existing = store.get(LEGACY);
      existing.onsuccess = () => {
        if (existing.result === undefined) {
          store.put(record, LEGACY);
          kept = true;
        } else kept = sameRecord(existing.result, record);
      };
    });
    return kept;
  } catch {
    return false;
  }
};

/** Whether two stored records hold the same data (heights arrays included). */
const sameRecord = (a: unknown, b: unknown): boolean => {
  const text = (value: unknown) =>
    JSON.stringify(value, (_key, v: unknown) =>
      ArrayBuffer.isView(v) ? Array.from(v as Int16Array) : v
    );
  return text(a) === text(b);
};
