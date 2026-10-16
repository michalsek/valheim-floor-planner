import { describe, expect, it } from 'vitest';

import { nextSnapStep, snapToGrid } from './snap';

describe('snapToGrid', () => {
  it('rounds to the nearest multiple of the step', () => {
    expect(snapToGrid({ x: 1.26, z: -0.74 }, 0.5)).toEqual({ x: 1.5, z: -0.5 });
    expect(snapToGrid({ x: 2.9, z: 3.1 }, 2)).toEqual({ x: 2, z: 4 });
  });

  it('normalises -0 to 0', () => {
    const p = snapToGrid({ x: -0.2, z: -0.1 }, 1);
    expect(Object.is(p.x, 0)).toBe(true);
    expect(Object.is(p.z, 0)).toBe(true);
  });

  it('cycles the snap step, wrapping around', () => {
    expect(nextSnapStep(2)).toBe(0.5);
  });
});
