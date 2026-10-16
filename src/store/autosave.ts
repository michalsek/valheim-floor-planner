/** Keeps the plan in localStorage: loaded at start-up, saved shortly after each edit. */
import { parsePlan, serializePlan } from '../model/serialize';
import { emptyPlan, type Plan } from '../model/types';

import type { PlanStore } from './planStore';

export const PLAN_STORAGE_KEY = 'valheimFloorPlanner.plan.v1';

type PlanStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The saved plan, or an empty one. Corrupt data is kept aside under `KEY.corrupt`. */
export const loadSavedPlan = (storage: PlanStorage): Plan => {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PLAN_STORAGE_KEY);
    return raw === null ? emptyPlan() : parsePlan(JSON.parse(raw));
  } catch (error) {
    console.warn('Saved plan is unreadable; starting with an empty plan.', error);
    if (raw !== null) {
      try {
        storage.setItem(`${PLAN_STORAGE_KEY}.corrupt`, raw);
      } catch {
        // Nowhere left to keep it.
      }
    }
    return emptyPlan();
  }
};

/**
 * Saves after edits stop for `delayMs`, and at once when the page is hidden or
 * closed. `onResult` hears whether each save worked. Returns a function that stops
 * autosaving (flushing a pending save).
 */
export const startAutosave = (
  store: PlanStore,
  storage: PlanStorage,
  { delayMs = 400, onResult }: { delayMs?: number; onResult?: (saved: boolean) => void } = {}
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    try {
      storage.setItem(PLAN_STORAGE_KEY, serializePlan(store.getPlan()));
      onResult?.(true);
    } catch (error) {
      // Most likely the storage quota; the plan is still in memory.
      console.warn('Could not save the plan.', error);
      onResult?.(false);
    }
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
