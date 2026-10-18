/**
 * Keeps the plan in the browser: loaded at start-up, saved shortly after each edit.
 * IndexedDB holds it (`planDb.ts`); a plan from the old localStorage autosave moves
 * there once. Where IndexedDB won't open, localStorage holds it as file JSON (packed
 * heights, so a large site still fits); where neither works, autosave is off.
 */
import { planFileText, readPlanJson } from '../model/planFile';
import { parsePlan } from '../model/serialize';
import { emptyPlan, type Plan } from '../model/types';

import { getLocalStorage } from './browserStorage';
import { keepCorruptRecord, openPlanDb, readPlanRecord, writePlanRecord } from './planDb';
import type { PlanStore } from './planStore';

/** The localStorage key: the autosave before IndexedDB, and the fallback since. */
export const PLAN_STORAGE_KEY = 'valheimFloorPlanner.plan.v1';

/** Where the autosave goes. */
export interface PlanSaver {
  save(plan: Plan): Promise<void>;
}

type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The plan in localStorage (as JSON), or null when there is none or it is unreadable. */
const readLocal = async (storage: LocalStore): Promise<Plan | null> => {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PLAN_STORAGE_KEY);
    return raw === null ? null : await readPlanJson(JSON.parse(raw));
  } catch (error) {
    console.warn('Saved plan is unreadable; starting with an empty plan.', error);
    if (raw !== null) {
      try {
        storage.setItem(`${PLAN_STORAGE_KEY}.corrupt`, raw);
      } catch {
        // Nowhere left to keep it.
      }
    }
    return null;
  }
};

const localSaver = (storage: LocalStore): PlanSaver => ({
  save: async (plan) => storage.setItem(PLAN_STORAGE_KEY, await planFileText(plan)),
});

/** The plan IndexedDB holds, or null when there is none or it is unreadable. */
const readDb = async (db: IDBDatabase): Promise<Plan | null> => {
  let record: unknown = null;
  try {
    record = await readPlanRecord(db);
    return record === null ? null : parsePlan(record);
  } catch (error) {
    console.warn('Saved plan is unreadable; starting with an empty plan.', error);
    if (record !== null) await keepCorruptRecord(db, record);
    return null;
  }
};

/**
 * Moves the old localStorage autosave into IndexedDB: the key is removed only once the
 * plan is stored there, so a failed move leaves it to try again on the next start.
 */
const migrate = async (db: IDBDatabase, local: LocalStore | null): Promise<Plan | null> => {
  const plan = local && (await readLocal(local));
  if (!plan) return null;
  try {
    await writePlanRecord(db, plan);
    local.removeItem(PLAN_STORAGE_KEY);
  } catch (error) {
    console.warn('Could not move the saved plan to IndexedDB; it stays in localStorage.', error);
  }
  return plan;
};

/**
 * The saved plan (or an empty one) and where to keep saving it; `saver` is null when
 * the browser blocks both IndexedDB and localStorage.
 */
export const openPlanStorage = async (): Promise<{ plan: Plan; saver: PlanSaver | null }> => {
  const local = getLocalStorage();
  const db = await openPlanDb();
  if (db) {
    const plan = (await readDb(db)) ?? (await migrate(db, local)) ?? emptyPlan();
    return { plan, saver: { save: (p) => writePlanRecord(db, p) } };
  }
  if (local) return { plan: (await readLocal(local)) ?? emptyPlan(), saver: localSaver(local) };
  return { plan: emptyPlan(), saver: null };
};

/**
 * Saves after edits stop for `delayMs`, and at once when the page is hidden or
 * closed; saves run one after another. `onResult` hears whether each save worked.
 * Returns a function that stops autosaving (flushing a pending save).
 */
export const startAutosave = (
  store: PlanStore,
  saver: PlanSaver,
  { delayMs = 400, onResult }: { delayMs?: number; onResult?: (saved: boolean) => void } = {}
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue = Promise.resolve();

  const save = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    queue = queue.then(async () => {
      try {
        await saver.save(store.getPlan());
        onResult?.(true);
      } catch (error) {
        // Most likely the storage quota; the plan is still in memory.
        console.warn('Could not save the plan.', error);
        onResult?.(false);
      }
    });
  };

  const flush = () => {
    if (timer !== null) save();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  const unsubscribe = store.subscribe(() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(save, delayMs);
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
