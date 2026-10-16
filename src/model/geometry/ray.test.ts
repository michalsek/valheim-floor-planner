import { describe, expect, it } from 'vitest';

import { normalizeVec3, pickBoxes, rayBox, type Ray3 } from './ray';

const down = (x: number, z: number): Ray3 => ({
  origin: { x, y: 10, z },
  dir: { x: 0, y: -1, z: 0 },
});

const unit = { center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotationY: 0 };

describe('rayBox', () => {
  it('enters through the top face, and misses beside the box', () => {
    expect(rayBox(down(0.2, -0.3), unit)).toBeCloseTo(9);
    expect(rayBox(down(0.6, 0), unit)).toBeNull();
  });

  it('tests a turned prop in its own frame', () => {
    // A 4 × 1 box turned 30° counter-clockwise (seen from above): its length axis runs
    // along (cos 30°, −sin 30°) on the plan.
    const turned = {
      center: { x: 10, y: 1, z: 5 },
      size: { x: 4, y: 2, z: 1 },
      rotationY: Math.PI / 6,
    };
    const along = (t: number) =>
      down(10 + t * Math.cos(Math.PI / 6), 5 - t * Math.sin(Math.PI / 6));
    expect(rayBox(along(1.8), turned)).toBeCloseTo(8);
    // The mirror image (the turn's sign flipped) is off the box.
    expect(
      rayBox(down(10 + 1.8 * Math.cos(Math.PI / 6), 5 + 1.8 * Math.sin(Math.PI / 6)), turned)
    ).toBeNull();
  });

  it('ignores a box the ray starts inside', () => {
    const ray = { origin: { x: 0, y: 0.5, z: 0 }, dir: normalizeVec3({ x: 1, y: 0, z: 1 }) };
    expect(rayBox(ray, unit)).toBeNull();
  });
});

describe('pickBoxes', () => {
  it('takes the nearest box along the ray', () => {
    const ray = { origin: { x: -10, y: 0.5, z: 0 }, dir: { x: 1, y: 0, z: 0 } };
    const far = { ...unit, center: { x: 5, y: 0.5, z: 0 }, id: 'far' };
    const near = { ...unit, center: { x: 2, y: 0.5, z: 0 }, id: 'near' };
    const hit = pickBoxes(ray, [far, near]);
    expect(hit?.box.id).toBe('near');
    expect(hit?.t).toBeCloseTo(11.5);
  });
});
