/**
 * Keeps the plan in the browser: loaded at start-up, saved shortly after each edit.
 * IndexedDB holds it (`planDb.ts`); a plan from the old localStorage autosave moves
 * there once. Where IndexedDB won't open, localStorage holds it as file JSON (packed
 * heights, so a large site still fits); where neither works, autosave is off. A stored
 * plan with drawn items (from before M18) loads without them, and the record as it was
 * is kept aside once, so the next save can't destroy the only copy.
 */
import { planFileText, readPlanJson } from '../model/planFile';
import { legacyItems, parsePlan, type LegacyItems } from '../model/serialize';
import { emptyPlan, type Plan } from '../model/types';

import { getLocalStorage } from './browserStorage';
import {
  keepCorruptRecord,
  keepLegacyRecord,
  openPlanDb,
  readPlanRecord,
  writePlanRecord,
} from './planDb';
import type { PlanStore } from './planStore';

/** The localStorage key: the autosave before IndexedDB, and the fallback since. */
export const PLAN_STORAGE_KEY = 'valheimFloorPlanner.plan.v1';
/** Where localStorage keeps a plan with drawn items aside, as it was. */
const LEGACY_KEY = `${PLAN_STORAGE_KEY}.legacy`;

/** Where the autosave goes. */
export interface PlanSaver {
  save(plan: Plan): Promise<void>;
}

type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * A stored plan as loaded: the drawn items it held (left out; null when none), and
 * whether the record as it was is kept aside, so it outlives the next save.
 */
interface Loaded {
  plan: Plan;
  legacy: LegacyItems | null;
  keptAside: boolean;
}

/**
 * Keeps `raw` under `LEGACY_KEY` unless a copy is there already; true when a copy of
 * this record is there afterwards (an earlier copy of another record stays as it is).
 */
const keepLocalLegacy = (storage: LocalStore, raw: string): boolean => {
  try {
    const kept = storage.getItem(LEGACY_KEY);
    if (kept !== null) return kept === raw;
    storage.setItem(LEGACY_KEY, raw);
    return true;
  } catch {
    return false;
  }
};

/** A localStorage plan as read: the loaded plan, and the record as it was. */
interface LocalPlan {
  plan: Plan;
  legacy: LegacyItems | null;
  raw: string;
  json: unknown;
}

/** The plan in localStorage (as JSON), or null when there is none or it is unreadable. */
const readLocal = async (storage: LocalStore): Promise<LocalPlan | null> => {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PLAN_STORAGE_KEY);
    if (raw === null) return null;
    const json: unknown = JSON.parse(raw);
    return { plan: await readPlanJson(json), legacy: legacyItems(json), raw, json };
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
  /**
   * Keeps a record with drawn items aside, unless one is kept already; true when a copy
   * of this record is kept afterwards.
   */
  keepLegacy(record: unknown): Promise<boolean>;
}

/** The autosave database's records, or null where IndexedDB won't open. */
export const indexedDbRecords = async (): Promise<PlanRecords | null> => {
  const db = await openPlanDb();
  return (
    db && {
      read: () => readPlanRecord(db),
      write: (plan) => writePlanRecord(db, plan),
      keepCorrupt: (record) => keepCorruptRecord(db, record),
      keepLegacy: (record) => keepLegacyRecord(db, record),
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
 * The plan at start-up, the drawn items it was stored with (left out; null when none)
 * and whether the record was kept aside, and where to keep saving it. Without a saver,
 * autosave is off:
 * `unavailable` when the browser blocks both stores, `unread` when IndexedDB holds a
 * plan it couldn't read (so nothing may overwrite it this session).
 */
export type OpenedStorage = Loaded &
  ({ saver: PlanSaver } | { saver: null; off: 'unavailable' | 'unread' });

const empty = (): Loaded => ({ plan: emptyPlan(), legacy: null, keptAside: false });

/** Saves `plan` (without its drawn items) once their record is kept aside; a failure only warns. */
const writeBack = async (save: () => Promise<void>): Promise<void> => {
  try {
    await save();
  } catch (error) {
    console.warn('Could not save the plan without its drawn items.', error);
  }
};

/**
 * Moves the old localStorage autosave into IndexedDB: the key is removed only once the
 * plan is stored there, so a failed move leaves it to try again on the next start. A
 * plan with drawn items moves only once its record is kept aside in IndexedDB.
 */
const migrate = async (records: PlanRecords, local: LocalStore | null): Promise<Loaded | null> => {
  const found = local && (await readLocal(local));
  if (!found) return null;
  const { plan, legacy, json } = found;
  const keptAside = legacy !== null && (await records.keepLegacy(json));
  if (legacy && !keptAside) return { plan, legacy, keptAside };
  try {
    await records.write(plan);
    local.removeItem(PLAN_STORAGE_KEY);
  } catch (error) {
    console.warn('Could not move the saved plan to IndexedDB; it stays in localStorage.', error);
  }
  return { plan, legacy, keptAside };
};

/**
 * The plan IndexedDB holds. A read that fails is not "nothing stored": autosave is off
 * for the session, so the stored plan stays as it was. A record that doesn't parse is
 * kept aside, and the app starts empty. A record with drawn items is kept aside, then
 * saved without them (so the next start says nothing); while it can't be kept, it stays
 * stored as it is until the first edit.
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
    return { ...empty(), saver: null, off: 'unread' };
  }
  if (record === null) return { ...((await migrate(records, local)) ?? empty()), saver };
  let plan: Plan;
  try {
    plan = parsePlan(record);
  } catch (error) {
    console.warn('Saved plan is unreadable; starting with an empty plan.', error);
    await records.keepCorrupt(record);
    return { ...empty(), saver };
  }
  const legacy = legacyItems(record);
  const keptAside = legacy !== null && (await records.keepLegacy(record));
  if (keptAside) await writeBack(() => saver.save(plan));
  return { plan, legacy, keptAside, saver };
};

/** The plan in localStorage, a record with drawn items kept aside as `fromRecords` does. */
const fromLocal = async (local: LocalStore | null): Promise<OpenedStorage> => {
  if (!local) return { ...empty(), saver: null, off: 'unavailable' };
  const saver = localSaver(local);
  const found = await readLocal(local);
  if (!found) return { ...empty(), saver };
  const { plan, legacy, raw } = found;
  const keptAside = legacy !== null && keepLocalLegacy(local, raw);
  if (keptAside) await writeBack(() => saver.save(plan));
  return { plan, legacy, keptAside, saver };
};

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
