import { describe, expect, it } from 'vitest';

import { normalizeSelection, type SelectionItem } from './selection';
import { emptyPlan, type Plan } from './types';

const plan: Plan = {
  ...emptyPlan(),
  dimensions: { d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 1, z: 0 }, offset: 0, elevation: 0 } },
};
const dim: SelectionItem = { kind: 'dimension', id: 'd' };
const wall: SelectionItem = { kind: 'wall', id: 'gone' };

describe('selection', () => {
  it('normalizeSelection drops missing items and repeats, else returns the same array', () => {
    expect(normalizeSelection(plan, [dim, wall, dim])).toEqual([dim]);
    const valid = [dim];
    expect(normalizeSelection(plan, valid)).toBe(valid);
  });
});
