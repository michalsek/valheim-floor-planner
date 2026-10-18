import { describe, expect, it } from 'vitest';

import { createPlanStore } from '../../store/planStore';
import { emptyPlan, type SiteTerrain } from '../types';

import { siteTerrainProblem } from './siteCheck';
import { growRect, growSiteTerrain, roomToGrow, SITE_SIDES, type SiteGrowth } from './siteExtend';
import { MAX_SITE_SIDE } from './sitePatch';
import { encodeHeights } from './siteTerrain';

/** A 65 × 65 vertex patch (one zone's span) whose heights spell their index. */
const terrain: SiteTerrain = {
  x0: 32,
  z0: -32,
  cols: 65,
  rows: 65,
  heights: encodeHeights(Array.from({ length: 65 * 65 }, (_, i) => i / 100)).heights,
  biomes: { zx0: 1, zz0: 0, cols: 2, rows: 2, codes: [1, 1, 8, 8] },
  worldGenVersion: 2,
  revision: 1,
  notices: { locations: [], legacyEdits: 0, unreadEdits: 0, check: { n: 0, maxError: 0 } },
};

/** A strip of ground at −1 m with biomes over it, as the worker's result gives it. */
const stripFor = (growth: SiteGrowth) => {
  const { x0, z0, cols, rows } = growth.strip;
  const zone = (v: number) => Math.floor((v + 32) / 64);
  const zx0 = zone(x0);
  const zz0 = zone(z0);
  const bc = zone(x0 + cols - 1) - zx0 + 2;
  const br = zone(z0 + rows - 1) - zz0 + 2;
  return {
    heights: new Int16Array(cols * rows).fill(-100),
    biomes: { zx0, zz0, cols: bc, rows: br, codes: new Array<number>(bc * br).fill(16) },
  };
};

describe('growing a site', () => {
  it('keeps the patch’s heights value for value on every side and fills the strip', () => {
    for (const side of SITE_SIDES) {
      const growth = growRect(terrain, side, 64)!;
      const grown = growSiteTerrain(terrain, growth, stripFor(growth), terrain.notices);
      expect(siteTerrainProblem(grown)).toBeNull();
      const { x0, z0, cols } = grown;
      for (let row = 0; row < grown.rows; row++) {
        for (let col = 0; col < cols; col++) {
          const u = x0 + col - terrain.x0;
          const w = z0 + row - terrain.z0;
          const inOld = u >= 0 && w >= 0 && u < terrain.cols && w < terrain.rows;
          expect(grown.heights[row * cols + col]).toBe(inOld ? w * terrain.cols + u : -100);
        }
      }
    }
  });

  it('grows up to the cap, then not at all', () => {
    const wide = { ...terrain, cols: MAX_SITE_SIDE - 9 };
    expect(roomToGrow(wide, 'east')).toBe(10);
    expect(growRect(wide, 'west', 64)?.rect).toMatchObject({ x0: 22, cols: MAX_SITE_SIDE + 1 });
    expect(growRect({ ...wide, cols: MAX_SITE_SIDE + 1 }, 'east', 64)).toBeNull();
    // The other axis still has room.
    expect(growRect({ ...wide, cols: MAX_SITE_SIDE + 1 }, 'north', 64)?.rect.rows).toBe(129);
  });

  it('is one undoable step of the plan', () => {
    const store = createPlanStore({
      ...emptyPlan(),
      importFrame: { worldName: 'W', origin: { x: 0, y: 30, z: 0 }, yaw: 0, terrain },
    });
    const growth = growRect(terrain, 'north', 64)!;
    const grown = growSiteTerrain(terrain, growth, stripFor(growth), terrain.notices);
    expect(store.dispatch({ type: 'site.setTerrain', terrain: grown }).ok).toBe(true);
    expect(store.getPlan().importFrame?.terrain?.rows).toBe(129);
    store.undo();
    expect(store.getPlan().importFrame?.terrain).toEqual(terrain);
    // Redo brings back the same heights array (caches are keyed on it).
    store.redo();
    expect(store.getPlan().importFrame?.terrain?.heights).toBe(grown.heights);
  });
});
