import { describe, expect, it } from 'vitest';

import { normalizeRun } from './polyline';

const p = (x: number, z: number) => ({ x, z });

describe('normalizeRun', () => {
  it('drops repeated points and merges straight-through vertices', () => {
    expect(normalizeRun([p(0, 0), p(0, 0), p(3, 0), p(6, 0), p(6, 4)], false)).toEqual([
      p(0, 0),
      p(6, 0),
      p(6, 4),
    ]);
  });

  it('merges across the start of a closed loop', () => {
    const loop = [p(4, 0), p(8, 0), p(8, 8), p(0, 8), p(0, 0), p(4, 0)];
    expect(normalizeRun(loop, true)).toEqual([p(8, 0), p(8, 8), p(0, 8), p(0, 0)]);
  });
});
