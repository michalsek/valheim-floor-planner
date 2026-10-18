import { describe, expect, it } from 'vitest';

import goldens from '../../../../research/terrainGoldens.json';

import { buildPatch, ZONE_VERTICES, zoneHeights, zoneOrigin } from './heightmap';
import { patchRiverCells, pregenerate, restoreRivers } from './pregenerate';
import { WorldGenerator } from './worldGenerator';

describe.each(goldens.worlds)('heightmap, synthetic seed $seed', (g) => {
  const gen = new WorldGenerator(g.seed, g.worldGenVersion);
  const pre = pregenerate(gen, { deepNorth: false });

  it.each(g.zones)('builds the $kind zone ($zx, $zz) as worldGen.py', (zone) => {
    const { heights, corners } = zoneHeights(gen, zone.zx, zone.zz);
    expect(corners).toEqual(zone.corners);
    let [min, max, sum] = [Infinity, -Infinity, 0];
    for (const h of heights) [min, max, sum] = [Math.min(min, h), Math.max(max, h), sum + h];
    expect(Math.abs(min - zone.min!)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(max - zone.max!)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(sum - zone.sum)).toBeLessThanOrEqual(1e-3);
    for (const [col, row, h] of zone.vertices) {
      expect(Math.abs(heights[row! * ZONE_VERTICES + col!]! - h!)).toBeLessThanOrEqual(1e-4);
    }
  });

  it('builds a patch across zone edges from the zones that own its vertices', () => {
    const { zx, zz } = g.zones.find((z) => z.kind === 'mixed')!;
    const rect = { x0: zoneOrigin(zx) + 40, z0: zoneOrigin(zz) + 50, cols: 50, rows: 30 };
    const patch = buildPatch(gen, rect);
    expect(patch.biomes).toMatchObject({ zx0: zx, zz0: zz, cols: 3, rows: 3 });
    expect(patch.biomes.codes[0]).toBe(gen.biome(zoneOrigin(zx), zoneOrigin(zz)));
    const zones = new Map<string, Float32Array>();
    for (let row = 0; row < rect.rows; row++) {
      for (let col = 0; col < rect.cols; col++) {
        const [x, z] = [rect.x0 + col, rect.z0 + row];
        const [ox, oz] = [Math.floor((x + 32) / 64), Math.floor((z + 32) / 64)];
        const key = `${ox},${oz}`;
        if (!zones.has(key)) zones.set(key, zoneHeights(gen, ox, oz).heights);
        const local = (z - zoneOrigin(oz)) * ZONE_VERTICES + (x - zoneOrigin(ox));
        expect(patch.heights[row * rect.cols + col]).toBe(zones.get(key)![local]);
      }
    }
  });

  it('gives the same patch from rivers restored for its cells only', () => {
    const { zx, zz } = g.zones.find((z) => z.kind === 'river')!;
    const rect = { x0: zoneOrigin(zx) - 20, z0: zoneOrigin(zz) - 10, cols: 100, rows: 90 };
    const full = buildPatch(gen, rect).heights;
    restoreRivers(gen, pre, patchRiverCells(rect));
    expect(buildPatch(gen, rect).heights).toEqual(full);
  });
});
