import { describe, expect, it } from 'vitest';

import { plateRect } from './plateRect';

describe('plateRect', () => {
  it('adds the margin and snaps out to the 2 m grid', () => {
    const rect = plateRect({ min: { x: 0.5, y: 0, z: -3 }, max: { x: 7, y: 4, z: 2 } });
    expect(rect).toEqual({ min: { x: -4, z: -8 }, max: { x: 12, z: 6 } });
  });

  it('is a 24 m square on the origin without bounds', () => {
    expect(plateRect(null)).toEqual({ min: { x: -12, z: -12 }, max: { x: 12, z: 12 } });
  });
});
