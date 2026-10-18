import { describe, expect, it } from 'vitest';

import goldens from '../../../../research/terrainGoldens.json';

import { perlin, UnityRandom } from './unityNatives';

describe('unity natives (goldens from worldGen.py)', () => {
  it('Mathf.PerlinNoise matches bit for bit', () => {
    for (const [x, y, v] of goldens.perlin) expect(perlin(x!, y!)).toBe(Math.fround(v!));
  });

  it.each(goldens.random)('UnityEngine.Random matches for seed $seed', (g) => {
    const r = new UnityRandom(g.seed);
    expect(Array.from({ length: g.uints.length }, () => r.nextUint())).toEqual(g.uints);
    for (const [lo, hi, v] of g.rangeInt) expect(r.rangeInt(lo!, hi!)).toBe(v);
    for (const [lo, hi, v] of g.rangeFloat) expect(r.rangeFloat(lo!, hi!)).toBe(Math.fround(v!));
  });

  it('saves and restores its state', () => {
    const r = new UnityRandom(-7);
    const saved = r.state;
    const first = [r.nextUint(), r.nextUint()];
    r.state = saved;
    expect([r.nextUint(), r.nextUint()]).toEqual(first);
  });
});
