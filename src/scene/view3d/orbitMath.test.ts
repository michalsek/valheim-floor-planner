import { describe, expect, it } from 'vitest';

import { boundsRadius, DEFAULT_DIR, frameBounds } from './orbitMath';

const bounds = { min: { x: 0, y: -1, z: 0 }, max: { x: 20, y: 3, z: 10 } };

const distance = (a: { x: number; y: number; z: number }, b: typeof a) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('frameBounds', () => {
  it('looks at the centre from the given direction', () => {
    const { position, target } = frameBounds(bounds, 45, 1.5, DEFAULT_DIR);
    expect(target).toEqual({ x: 10, y: 1, z: 5 });
    const d = distance(position, target);
    expect((position.x - target.x) / d).toBeCloseTo(DEFAULT_DIR.x);
    expect((position.y - target.y) / d).toBeCloseTo(DEFAULT_DIR.y);
    expect(position.y).toBeGreaterThan(0);
  });

  it('keeps the bounding sphere inside the narrower field of view', () => {
    const radius = boundsRadius(bounds);
    const wide = frameBounds(bounds, 45, 2, DEFAULT_DIR);
    const tall = frameBounds(bounds, 45, 0.5, DEFAULT_DIR);
    const halfY = (45 * Math.PI) / 360;
    expect(distance(wide.position, wide.target) * Math.sin(halfY)).toBeGreaterThan(radius);
    // A portrait canvas is limited by its horizontal field, so the camera backs off.
    expect(distance(tall.position, tall.target)).toBeGreaterThan(
      distance(wide.position, wide.target)
    );
  });
});
