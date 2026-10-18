import { describe, expect, it } from 'vitest';

import { wheelSteps } from './buildWheel';

const run = (events: { deltaMode: number; deltaY: number }[]) =>
  events.reduce(
    (acc, e) => {
      const { steps, rest } = wheelSteps(acc.rest, e);
      return { steps: acc.steps + steps, rest };
    },
    { steps: 0, rest: 0 }
  );

describe('wheelSteps', () => {
  it('turns one step per mouse notch, wheel up clockwise', () => {
    expect(run([{ deltaMode: 0, deltaY: -100 }]).steps).toBe(1);
    expect(run(Array(4).fill({ deltaMode: 0, deltaY: 100 })).steps).toBe(-4);
  });

  it('carries small trackpad deltas to a whole step', () => {
    expect(run(Array(9).fill({ deltaMode: 0, deltaY: -10 })).steps).toBe(0);
    expect(run(Array(10).fill({ deltaMode: 0, deltaY: -10 })).steps).toBe(1);
  });

  it('counts a line or page event as one notch', () => {
    expect(run([{ deltaMode: 1, deltaY: 3 }]).steps).toBe(-1);
    expect(run([{ deltaMode: 2, deltaY: -1 }]).steps).toBe(1);
  });
});
