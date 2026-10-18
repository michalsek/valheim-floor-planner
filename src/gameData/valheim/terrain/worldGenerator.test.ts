import { describe, expect, it } from 'vitest';

import goldens from '../../../../research/terrainGoldens.json';

import { Biome, isPorted } from './biomes';
import { HEIGHT_SCALE, WorldGenerator } from './worldGenerator';

/** Heights within this many metres of worldGen.py. */
const TOLERANCE = 1e-4;

describe.each(goldens.worlds)('WorldGenerator, synthetic seed $seed', (g) => {
  const gen = new WorldGenerator(g.seed, g.worldGenVersion);

  it('derives the offsets and river and stream seeds', () => {
    expect([gen.off0, gen.off1, gen.off2, gen.off3, gen.off4]).toEqual(g.offsets);
    expect([gen.riverSeed, gen.streamSeed]).toEqual([g.riverSeed, g.streamSeed]);
  });

  it('matches biome, base height and GetHeight (no rivers) at 200 points', () => {
    let maxError = 0;
    for (const [x, z, biome, base, height] of g.points) {
      expect(gen.biome(x!, z!)).toBe(biome);
      maxError = Math.max(maxError, Math.abs(gen.baseHeight(x!, z!) - base!) * HEIGHT_SCALE);
      const h = gen.getHeight(x!, z!);
      if (height === null) expect(h).toBeNaN();
      else maxError = Math.max(maxError, Math.abs(h - height!));
    }
    expect(maxError).toBeLessThanOrEqual(TOLERANCE);
  });

  it('reports Ashlands and Deep North as not ported', () => {
    const unported = g.points.filter(([, , b]) => b === Biome.AshLands || b === Biome.DeepNorth);
    expect(unported.length).toBeGreaterThan(0);
    for (const [x, z, b] of unported) {
      expect(isPorted(b!)).toBe(false);
      if (Math.hypot(x!, z!) <= 10500) expect(gen.getHeight(x!, z!)).toBeNaN();
    }
  });
});
