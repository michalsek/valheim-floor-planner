import { describe, expect, it, vi } from 'vitest';

import { planFileText } from '../model/planFile';
import { emptyPlan, type Plan } from '../model/types';

import { openPlanStorage, PLAN_STORAGE_KEY, type PlanRecords } from './autosave';

/** localStorage as a map. */
const localStore = (entries: Record<string, string> = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

/** The IndexedDB side holding `record` (null: nothing); `read` may be replaced. */
const records = (record: unknown, read?: () => Promise<unknown>) => {
  const state: { stored: unknown } = { stored: record };
  return Object.assign(state, {
    read: read ?? (async () => state.stored),
    write: vi.fn(async (plan: Plan) => void (state.stored = plan)),
    keepCorrupt: vi.fn(async (_record: unknown) => {}),
  }) satisfies PlanRecords;
};

const named = (name: string): Plan => ({ ...emptyPlan(), name });

describe('opening the autosave', () => {
  it('moves the old localStorage plan into IndexedDB, then removes the key', async () => {
    const local = localStore({ [PLAN_STORAGE_KEY]: await planFileText(named('Old')) });
    const db = records(null);
    const opened = await openPlanStorage({ openRecords: async () => db, local, timeoutMs: 1000 });
    expect(opened.plan.name).toBe('Old');
    expect((db.stored as Plan).name).toBe('Old');
    expect(local.map.has(PLAN_STORAGE_KEY)).toBe(false);
    await opened.saver!.save(named('New'));
    expect((db.stored as Plan).name).toBe('New');
  });

  it('never overwrites a plan it failed to read', async () => {
    const db = records(named('Kept'), () => Promise.reject(new Error('read failed')));
    const opened = await openPlanStorage({
      openRecords: async () => db,
      local: localStore(),
      timeoutMs: 1000,
    });
    expect(opened).toMatchObject({ saver: null, off: 'unread' });
    expect(db.write).not.toHaveBeenCalled();
    expect((db.stored as Plan).name).toBe('Kept');
  });

  it('keeps an unreadable record aside and starts empty', async () => {
    const db = records({ version: 999 });
    const opened = await openPlanStorage({
      openRecords: async () => db,
      local: null,
      timeoutMs: 1000,
    });
    expect(db.keepCorrupt).toHaveBeenCalledWith({ version: 999 });
    expect(opened.plan).toEqual(emptyPlan());
    expect(opened.saver).not.toBeNull();
  });

  it('falls back to localStorage when IndexedDB doesn’t answer in time', async () => {
    const local = localStore({ [PLAN_STORAGE_KEY]: await planFileText(named('Local')) });
    const opened = await openPlanStorage({
      openRecords: () => new Promise(() => {}),
      local,
      timeoutMs: 10,
    });
    expect(opened.plan.name).toBe('Local');
    await opened.saver!.save(named('Saved'));
    expect(local.map.get(PLAN_STORAGE_KEY)).toContain('Saved');
  });

  it('turns autosave off when neither store works', async () => {
    const opened = await openPlanStorage({
      openRecords: async () => null,
      local: null,
      timeoutMs: 10,
    });
    expect(opened).toMatchObject({ saver: null, off: 'unavailable' });
  });
});
