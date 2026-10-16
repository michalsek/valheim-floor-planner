import { describe, expect, it } from 'vitest';

import type { Vec2 } from '../types';

import { labelSpot } from './labelSpot';
import { regionFromRings } from './region';
import { pointInRing } from './rings';

const pts = (...xz: [number, number][]): Vec2[] => xz.map(([x, z]) => ({ x, z }));

describe('labelSpot', () => {
  it('puts an L-shape label inside the L, in its wide arm', () => {
    const l = pts([0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]);
    const spot = labelSpot(regionFromRings([l]))!;
    expect(pointInRing(spot.center, l)).toBe(true);
    expect([spot.w, spot.d]).toEqual([8, 4]);
  });
});
