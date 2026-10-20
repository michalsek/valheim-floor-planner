import { describe, expect, it, vi } from 'vitest';

import { planFileText } from '../model/planFile';
import { emptyPlan, type Plan } from '../model/types';

import { openPlanStorage, PLAN_STORAGE_KEY, type PlanRecords } from './autosave';
import { legacyNotice } from './fileActions';

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

/**
 * The IndexedDB side holding `record` (null: nothing) and a kept legacy record (as
 * `keepLegacyRecord`: kept once, never replaced); `read` may be replaced.
 */
const records = (record: unknown, read?: () => Promise<unknown>, legacy?: unknown) => {
  const state: { stored: unknown; legacy: unknown } = { stored: record, legacy };
  return Object.assign(state, {
    read: read ?? (async () => state.stored),
    write: vi.fn(async (plan: Plan) => void (state.stored = plan)),
    keepCorrupt: vi.fn(async (_record: unknown) => {}),
    keepLegacy: vi.fn(async (kept: unknown) => {
      if (state.legacy === undefined) state.legacy = structuredClone(kept);
      return JSON.stringify(state.legacy) === JSON.stringify(kept);
    }),
  }) satisfies PlanRecords;
};

const named = (name: string): Plan => ({ ...emptyPlan(), name });

/** A stored plan with one drawn wall (from before M18). */
const withWall = (name: string) => ({
  ...named(name),
  walls: { w: { id: 'w', familyId: 'wood', points: [], closed: false, height: 2 } },
});

const open = (db: PlanRecords | null, local: ReturnType<typeof localStore> | null = null) =>
  openPlanStorage({ openRecords: async () => db, local, timeoutMs: 1000 });

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

  it('opens a record with a wall without it, keeps it aside and saves the plan without it', async () => {
    const record = withWall('Hall');
    const db = records(record);
    const opened = await open(db);
    expect(opened).toMatchObject({ plan: named('Hall'), legacy: { walls: 1 }, keptAside: true });
    expect(db.keepLegacy).toHaveBeenCalledWith(record);
    expect(db.stored).toEqual(named('Hall'));
    // The next start says nothing.
    const reopened = await open(db);
    expect(reopened).toMatchObject({ legacy: null, keptAside: false });
    expect(db.keepLegacy).toHaveBeenCalledOnce();
  });

  it('leaves a second record with drawn items as it is when another is kept aside', async () => {
    const first = withWall('First');
    const second = withWall('Second');
    const db = records(second, undefined, first);
    const opened = await open(db);
    expect(opened).toMatchObject({ plan: named('Second'), keptAside: false });
    expect(db.legacy).toEqual(first);
    expect(db.write).not.toHaveBeenCalled();
    expect(db.stored).toEqual(second);
    expect(legacyNotice(opened.legacy!, opened.keptAside).message).toMatch(
      /couldn't be kept aside in this browser: open it in an earlier version before editing\.$/
    );
  });

  it('keeps a localStorage plan with drawn items aside under its own key, once', async () => {
    const raw = JSON.stringify(withWall('Local'));
    const local = localStore({ [PLAN_STORAGE_KEY]: raw });
    const opened = await open(null, local);
    expect(opened).toMatchObject({ plan: named('Local'), keptAside: true });
    expect(local.map.get(`${PLAN_STORAGE_KEY}.legacy`)).toBe(raw);
    expect(local.map.get(PLAN_STORAGE_KEY)).not.toContain('walls');
    expect((await open(null, local)).legacy).toBeNull();

    local.map.set(PLAN_STORAGE_KEY, JSON.stringify(withWall('Another')));
    expect(await open(null, local)).toMatchObject({ keptAside: false });
    expect(local.map.get(`${PLAN_STORAGE_KEY}.legacy`)).toBe(raw);
    expect(local.map.get(PLAN_STORAGE_KEY)).toContain('walls');
  });

  it('moves an old localStorage plan with drawn items into IndexedDB, keeping it aside there', async () => {
    const raw = withWall('Old');
    const local = localStore({ [PLAN_STORAGE_KEY]: JSON.stringify(raw) });
    const db = records(null);
    const opened = await open(db, local);
    expect(opened).toMatchObject({ plan: named('Old'), keptAside: true });
    expect(db.legacy).toEqual(raw);
    expect(db.stored).toEqual(named('Old'));
    expect([...local.map.keys()]).toEqual([]);
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
