import { describe, expect, it } from 'vitest';

import { cutRect } from './cutRect';

describe('cutRect', () => {
  it('stands the margin off the bounds, unsnapped', () => {
    const rect = cutRect({ min: { x: 0.5, y: 0, z: -3 }, max: { x: 7, y: 4, z: 2 } });
    expect(rect).toEqual({ min: { x: 0, z: -3.5 }, max: { x: 7.5, z: 2.5 } });
  });

  it('is null without bounds', () => {
    expect(cutRect(null)).toBeNull();
  });
});
