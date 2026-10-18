import { describe, expect, it } from 'vitest';

import { penetration } from './overlap';

const box = (x: number, z: number, rotationY = 0) => ({
  center: { x, y: 0, z },
  size: { x: 2, y: 2, z: 2 },
  rotationY,
});

describe('penetration', () => {
  it('gives crossing boxes their depth, touching or apart ones 0', () => {
    expect(penetration(box(0, 0), box(1.4, 0))).toBeCloseTo(0.6);
    expect(penetration(box(0, 0), box(2, 0))).toBe(0);
    expect(penetration(box(0, 0), box(3, 1))).toBe(0);
  });

  it('tests turned boxes on their own axes', () => {
    // A box turned 45° reaches √2 from its centre along x.
    expect(penetration(box(0, 0), box(2.2, 0, Math.PI / 4))).toBeCloseTo(Math.SQRT2 - 1.2);
    expect(penetration(box(0, 0), box(2.5, 0, Math.PI / 4))).toBe(0);
  });
});
