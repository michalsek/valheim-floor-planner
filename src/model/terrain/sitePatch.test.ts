import { describe, expect, it } from 'vitest';

import { MAX_SIDE, MIN_SIDE, patchRect, SITE_MARGIN } from './sitePatch';

const frame = { origin: { x: 1000.3, y: 30, z: -500.6 }, yaw: 0 };

describe('the site patch', () => {
  it('adds the margin on whole metres', () => {
    // Plan x 0..150, z 0..40 is world x 1000.3..1150.3, z −540.6..−500.6.
    const rect = patchRect({ min: { x: 0, z: 0 }, max: { x: 150, z: 40 } }, frame);
    expect(rect.x0).toBe(Math.floor(1000.3 - SITE_MARGIN));
    expect(rect.cols - 1).toBe(Math.ceil(1150.3 + SITE_MARGIN) - rect.x0);
    expect(Object.values(rect).every(Number.isInteger)).toBe(true);
  });

  it('keeps at least the minimum side, and caps a big build about its centre', () => {
    // A lone piece: the margin alone makes the minimum (and a metre for rounding).
    const small = patchRect({ min: { x: 0, z: 0 }, max: { x: 0, z: 0 } }, frame);
    expect(small.rows - 1).toBeGreaterThanOrEqual(MIN_SIDE);
    expect(small.rows - 1).toBeLessThanOrEqual(MIN_SIDE + 1);
    const big = patchRect({ min: { x: -300, z: 0 }, max: { x: 300, z: 10 } }, frame);
    expect(big.cols - 1).toBe(MAX_SIDE);
    expect(big.x0).toBe(Math.round(1000.3 - MAX_SIDE / 2));
  });
});
