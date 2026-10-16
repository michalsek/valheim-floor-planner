import { describe, expect, it } from 'vitest';

import { wallFamilyById } from '../catalog';
import { emptyPlan, type Plan, type WallRun } from './types';

import { boxFromCorners } from './geometry/box';
import { hitTest, itemsInBox } from './hitTest';

const wood = wallFamilyById.get('wood')!;
const stone = wallFamilyById.get('stone')!;

const run = (id: string, familyId: string, points: [number, number][]): WallRun => ({
  id,
  familyId,
  points: points.map(([x, z]) => ({ x, z })),
  closed: false,
  side: 'right',
  height: 2,
});

const planOf = (walls: WallRun[], dims: Plan['dimensions'] = {}): Plan => ({
  ...emptyPlan(),
  walls: Object.fromEntries(walls.map((w) => [w.id, w])),
  dimensions: dims,
});

const TOL = 0.1;
const opts = { families: wallFamilyById, handlesFor: null, handleTol: 0.2 };
const at = (plan: Plan, x: number, z: number, handlesFor: string | null = null) =>
  hitTest(plan, { x, z }, TOL, { ...opts, handlesFor });

describe('hitTest', () => {
  // Drawn left to right along z = 0, so 'right' (on screen) is +z.
  const panel = planOf([
    run('w', 'wood', [
      [0, 0],
      [4, 0],
    ]),
  ]);
  const block = planOf([
    run('s', 'stone', [
      [0, 0],
      [4, 0],
    ]),
  ]);

  it('hits a panel wall up to half its thickness plus tol, on both sides and past its end', () => {
    const edge = wood.thickness / 2 + TOL;
    expect(at(panel, 2, edge - 0.01)).toMatchObject({ kind: 'wall', id: 'w', segment: 0 });
    expect(at(panel, 2, -(edge - 0.01))).toMatchObject({ kind: 'wall', id: 'w' });
    expect(at(panel, 2, edge + 0.01)).toBeNull();
    expect(at(panel, 4 + TOL - 0.01, 0)).toMatchObject({ kind: 'wall' });
    expect(at(panel, 4 + TOL + 0.01, 0)).toBeNull();
  });

  it('hits a block wall on its strip side only', () => {
    expect(at(block, 2, stone.thickness - 0.05)).toMatchObject({ kind: 'wall', id: 's' });
    expect(at(block, 2, -TOL - 0.05)).toBeNull();
  });

  it('prefers a vertex handle, then a dimension, then a wall', () => {
    const plan = planOf(
      [
        run('w', 'wood', [
          [0, 0],
          [4, 0],
        ]),
      ],
      {
        d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, offset: 0 },
      }
    );
    expect(at(plan, 2, 0)).toMatchObject({ kind: 'dimension', id: 'd' });
    expect(at(plan, 4, 0, 'w')).toEqual({ kind: 'vertex', wallId: 'w', index: 1 });
    expect(at(plan, 4, 0)).toMatchObject({ kind: 'dimension' });
  });
});

describe('itemsInBox', () => {
  const plan = planOf([
    run('w', 'wood', [
      [0, 0],
      [4, 0],
    ]),
  ]);
  const halfBox = boxFromCorners({ x: -1, z: -1 }, { x: 2, z: 1 });
  const wholeBox = boxFromCorners({ x: -1, z: -1 }, { x: 5, z: 1 });

  it('contain needs the whole line inside; touch any part', () => {
    expect(itemsInBox(plan, halfBox, 'contain')).toEqual([]);
    expect(itemsInBox(plan, halfBox, 'touch')).toEqual([{ kind: 'wall', id: 'w' }]);
    expect(itemsInBox(plan, wholeBox, 'contain')).toEqual([{ kind: 'wall', id: 'w' }]);
  });
});
