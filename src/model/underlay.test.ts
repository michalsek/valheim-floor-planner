import { describe, expect, it } from 'vitest';

import type { Underlay } from './types';
import { calibrate } from './underlay';

const underlay: Underlay = {
  imageId: 'img',
  name: 'plan.png',
  pixelSize: { w: 100, h: 50 },
  origin: { x: 0, z: 0 },
  metresPerPixel: 0.1,
  opacity: 0.5,
  locked: false,
};

describe('calibrate', () => {
  it('scales the image about A so A–B measures the given distance', () => {
    // A 2 m stretch on the image as it lies is really 4 m.
    expect(calibrate(underlay, { x: 2, z: 1 }, { x: 4, z: 1 }, 4)).toEqual({
      origin: { x: -2, z: -1 },
      metresPerPixel: 0.2,
    });
  });

  it.each([
    [{ x: 1, z: 1 }, 2],
    [{ x: 3, z: 1 }, 0],
    [{ x: 3, z: 1 }, -2],
    [{ x: 3, z: 1 }, Number.NaN],
    [{ x: 3, z: 1 }, 1e6],
  ])('refuses B %j at %d m', (b, metres) => {
    expect(calibrate(underlay, { x: 1, z: 1 }, b, metres)).toBeNull();
  });
});
