import { describe, expect, it } from 'vitest';

import { library } from '../catalog';

import { derivePlan } from './derivePlan';
import { emptyPlan, type Plan, type WallRun } from './types';

const wall = (familyId: string): WallRun => ({
  id: familyId,
  familyId,
  points: [
    { x: 0, z: 0 },
    { x: 8, z: 0 },
    { x: 8, z: 8 },
    { x: 0, z: 8 },
  ],
  closed: true,
  side: 'right',
  height: 2,
});

const derive = (...walls: WallRun[]) => {
  const plan: Plan = { ...emptyPlan(), walls: Object.fromEntries(walls.map((w) => [w.id, w])) };
  return derivePlan(plan, library);
};

describe('derivePlan', () => {
  it('costs an 8 × 8 stone loop (strip inside) at 80 stone', () => {
    expect(derive(wall('stone')).bom.resources).toEqual([{ item: 'Stone', amount: 80 }]);
  });

  it('warns about an unknown family', () => {
    expect(derive(wall('marble')).warnings).toEqual([
      expect.objectContaining({ source: { kind: 'wall', id: 'marble' }, segment: null }),
    ]);
  });
});
