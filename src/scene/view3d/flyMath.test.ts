import { describe, expect, it } from 'vitest';

import {
  approachVelocity,
  baseFlySpeed,
  flyDirection,
  MAX_FLY_SPEED,
  MIN_FLY_SPEED,
  wheelSpeedScale,
  type FlyKey,
} from './flyMath';

// Looking down 30° towards −z; the camera's right is +x.
const forward = { x: 0, y: -0.5, z: -Math.sqrt(3) / 2 };
const right = { x: 1, y: 0, z: 0 };
const dir = (...keys: FlyKey[]) => {
  const { x, y, z } = flyDirection(new Set(keys), forward, right);
  // Drops negative zeros.
  return { x: x + 0, y: y + 0, z: z + 0 };
};

describe('flyDirection', () => {
  it('moves along the view direction, climbing or sinking with it', () => {
    expect(dir('forward')).toEqual(forward);
    expect(dir('back').y).toBeCloseTo(0.5);
  });

  it('strafes level and rises straight up; diagonals stay unit length', () => {
    expect(dir('left')).toEqual({ x: -1, y: 0, z: 0 });
    expect(dir('up')).toEqual({ x: 0, y: 1, z: 0 });
    const d = dir('forward', 'right');
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });

  it('is zero when opposite keys cancel', () => {
    expect(dir('forward', 'back', 'left', 'right')).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('speed', () => {
  it('scales with the orbit distance within limits', () => {
    expect(baseFlySpeed(1)).toBe(MIN_FLY_SPEED);
    expect(baseFlySpeed(30)).toBe(15);
    expect(baseFlySpeed(5000)).toBe(MAX_FLY_SPEED);
  });

  it('wheel up speeds up, down slows down, within the scale limits', () => {
    expect(wheelSpeedScale(1, { deltaY: -100, deltaMode: 0 })).toBeCloseTo(1.25);
    expect(wheelSpeedScale(1, { deltaY: 3, deltaMode: 1 })).toBeCloseTo(0.8);
    expect(wheelSpeedScale(8, { deltaY: -100, deltaMode: 0 })).toBe(8);
  });
});

describe('approachVelocity', () => {
  it('follows the same curve at any frame rate', () => {
    const target = { x: 10, y: 0, z: 0 };
    const once = approachVelocity({ x: 0, y: 0, z: 0 }, target, 0.1);
    let stepped = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 10; i++) stepped = approachVelocity(stepped, target, 0.01);
    expect(stepped.x).toBeCloseTo(once.x, 6);
    expect(once.x).toBeGreaterThan(5);
  });

  it('comes to rest when the keys are released', () => {
    let v = { x: 10, y: 0, z: 0 };
    for (let i = 0; i < 120; i++) v = approachVelocity(v, { x: 0, y: 0, z: 0 }, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0, z: 0 });
  });
});
