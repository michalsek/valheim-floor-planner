import { describe, expect, it } from 'vitest';

import { classifyWheel, isPinch, normalizeWheelDelta, zoomFactor, type WheelLike } from './wheel';

const wheel = (overrides: Partial<WheelLike>): WheelLike => ({
  ctrlKey: false,
  metaKey: false,
  deltaMode: 0,
  deltaX: 0,
  deltaY: 0,
  ...overrides,
});

describe('classifyWheel', () => {
  it.each([
    ['pinch (ctrl)', wheel({ ctrlKey: true, deltaY: 3.5 }), 'zoom'],
    ['cmd + wheel', wheel({ metaKey: true, deltaY: 100 }), 'zoom'],
    ['line/page-mode wheel', wheel({ deltaMode: 1, deltaY: 3 }), 'zoom'],
    ['large pixel step', wheel({ deltaY: 100 }), 'zoom'],
    ['small or fractional trackpad scroll', wheel({ deltaY: -2.75 }), 'pan'],
    ['trackpad horizontal scroll', wheel({ deltaX: 8, deltaY: 120 }), 'pan'],
  ] as const)('%s → %s', (_name, event, expected) => {
    expect(classifyWheel(event)).toBe(expected);
  });

  it('tells a pinch from ctrl + mouse wheel', () => {
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 3.5 }))).toBe(true);
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 100 }))).toBe(false);
  });
});

describe('normalizeWheelDelta', () => {
  it('converts lines and pages to pixels', () => {
    expect(normalizeWheelDelta(wheel({ deltaY: 7 }), 600)).toBe(7);
    expect(normalizeWheelDelta(wheel({ deltaMode: 1, deltaY: 3 }), 600)).toBe(48);
    expect(normalizeWheelDelta(wheel({ deltaMode: 2, deltaY: 1 }), 600)).toBe(600);
  });
});

describe('zoomFactor', () => {
  it('zooms in on negative deltas, and opposite deltas cancel', () => {
    expect(zoomFactor(-100, false)).toBeGreaterThan(1);
    for (const d of [1, 30, 100, 250]) {
      expect(zoomFactor(d, false) * zoomFactor(-d, false)).toBeCloseTo(1);
      expect(zoomFactor(d, true) * zoomFactor(-d, true)).toBeCloseTo(1);
    }
  });
});
