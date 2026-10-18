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

/** The autosave's IndexedDB side as start-up uses it (`planDb.ts`; tests give a fake). */
export interface PlanRecords {
  /** The stored record, null when none; rejects when the read fails. */
  read(): Promise<unknown>;
  write(plan: Plan): Promise<void>;
  keepCorrupt(record: unknown): Promise<void>;
}

/** The autosave database's records, or null where IndexedDB won't open. */
export const indexedDbRecords = async (): Promise<PlanRecords | null> => {
  const db = await openPlanDb();
  return (
    db && {
      read: () => readPlanRecord(db),
      write: (plan) => writePlanRecord(db, plan),
      keepCorrupt: (record) => keepCorruptRecord(db, record),
    }
  );
};

/** Where start-up looks for the plan. */
export interface PlanSources {
  openRecords(): Promise<PlanRecords | null>;
  local: LocalStore | null;
  /** How long IndexedDB may take to open and read before localStorage is used (ms). */
  timeoutMs: number;
}

/** IndexedDB may take this long at start-up before the localStorage fallback (ms). */
export const DB_TIMEOUT = 3000;

const browserSources = (): PlanSources => ({
  openRecords: indexedDbRecords,
  local: getLocalStorage(),
  timeoutMs: DB_TIMEOUT,
});

/**
 * The plan at start-up and where to keep saving it. Without a saver, autosave is off:
 * `unavailable` when the browser blocks both stores, `unread` when IndexedDB holds a
 * plan it couldn't read (so nothing may overwrite it this session).
 */
export type OpenedStorage =
  { plan: Plan; saver: PlanSaver } | { plan: Plan; saver: null; off: 'unavailable' | 'unread' };

/**
 * Moves the old localStorage autosave into IndexedDB: the key is removed only once the
 * plan is stored there, so a failed move leaves it to try again on the next start.
 */
const migrate = async (records: PlanRecords, local: LocalStore | null): Promise<Plan | null> => {
  const plan = local && (await readLocal(local));
  if (!plan) return null;
  try {
    await records.write(plan);
    local.removeItem(PLAN_STORAGE_KEY);
  } catch (error) {
    console.warn('Could not move the saved plan to IndexedDB; it stays in localStorage.', error);
  }
  return plan;
};

/**
 * The plan IndexedDB holds. A read that fails is not "nothing stored": autosave is off
 * for the session, so the stored plan stays as it was. A record that doesn't parse is
 * kept aside, and the app starts empty.
 */
const fromRecords = async (
  records: PlanRecords,
  local: LocalStore | null
): Promise<OpenedStorage> => {
  const saver: PlanSaver = { save: (plan) => records.write(plan) };
  let record: unknown;
  try {
    record = await records.read();
  } catch (error) {
    console.warn('Could not read the saved plan; autosave is off so it stays as it was.', error);
    return { plan: emptyPlan(), saver: null, off: 'unread' };
  }
  if (record === null) return { plan: (await migrate(records, local)) ?? emptyPlan(), saver };
  try {
    return { plan: parsePlan(record), saver };
  } catch (error) {
    console.warn('Saved plan is unreadable; starting with an empty plan.', error);
    await records.keepCorrupt(record);
    return { plan: emptyPlan(), saver };
  }
};

const fromLocal = async (local: LocalStore | null): Promise<OpenedStorage> =>
  local
    ? { plan: (await readLocal(local)) ?? emptyPlan(), saver: localSaver(local) }
    : { plan: emptyPlan(), saver: null, off: 'unavailable' };

/**
 * The saved plan (or an empty one) and where to keep saving it: IndexedDB, or
 * localStorage where IndexedDB won't open or doesn't answer within `timeoutMs` (a page
 * never stays blank waiting for it).
 */
export const openPlanStorage = async (
  sources: PlanSources = browserSources()
): Promise<OpenedStorage> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), sources.timeoutMs);
  });
  const fromDb = sources
    .openRecords()
    .then((records) => (records ? fromRecords(records, sources.local) : null))
    .catch(() => null);
  const first = await Promise.race([fromDb, timeout]);
  clearTimeout(timer);
  if (first === 'timeout') {
    console.warn('IndexedDB did not answer; the plan is kept in localStorage this session.');
  } else if (first) {
    return first;
  }
  return fromLocal(sources.local);
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
