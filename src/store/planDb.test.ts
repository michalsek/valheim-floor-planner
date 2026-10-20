import { describe, expect, it } from 'vitest';

import { encodeHeights } from '../model/terrain/siteTerrain';
import { emptyPlan, type Plan } from '../model/types';

import { keepLegacyRecord, readPlanRecord, writePlanRecord } from './planDb';
import { fakeDb } from './testIdb';

const withTerrain = (): Plan => ({
  ...emptyPlan(),
  importFrame: {
    worldName: 'W',
    origin: { x: 0, y: 30, z: 0 },
    yaw: 0,
    terrain: {
      x0: 0,
      z0: 0,
      cols: 2,
      rows: 2,
      heights: encodeHeights([0, 1, 2, 3]).heights,
      biomes: { zx0: 0, zz0: 0, cols: 2, rows: 2, codes: [1, 1, 1, 1] },
      worldGenVersion: 2,
      revision: 1,
      notices: { locations: [], legacyEdits: 0, unreadEdits: 0, check: { n: 0, maxError: 0 } },
    },
  },
});

describe('the plan database', () => {
  it('stores the heights once, and not again after loading them', async () => {
    const fake = fakeDb();
    const plan = withTerrain();
    await writePlanRecord(fake.db, plan);
    await writePlanRecord(fake.db, { ...plan, name: 'Renamed' });
    expect(fake.puts.filter((k) => k === 'heights')).toHaveLength(1);

    // A new session: the loaded array is the stored one, so its first save skips it.
    const loaded = (await readPlanRecord(fake.db)) as Plan;
    expect(loaded.importFrame?.terrain?.heights).toEqual(plan.importFrame?.terrain?.heights);
    fake.puts.length = 0;
    await writePlanRecord(fake.db, { ...loaded, name: 'Again' });
    expect(fake.puts).toEqual(['plan']);
  });

  it('rejects a read that fails (not the same as nothing stored)', async () => {
    const fake = fakeDb();
    expect(await readPlanRecord(fake.db)).toBeNull();
    fake.failing = true;
    await expect(readPlanRecord(fake.db)).rejects.toThrow();
  });

  it('keeps a legacy record once: never replaced, true only for the same record', async () => {
    const fake = fakeDb();
    const first = { ...withTerrain(), walls: { w: { id: 'w' } } };
    expect(await keepLegacyRecord(fake.db, first)).toBe(true);
    expect(await keepLegacyRecord(fake.db, structuredClone(first))).toBe(true);
    expect(await keepLegacyRecord(fake.db, { ...first, name: 'Other' })).toBe(false);
    expect(fake.data.get('legacy')).toEqual(first);
    fake.failing = true;
    expect(await keepLegacyRecord(fake.db, first)).toBe(false);
  });
});
