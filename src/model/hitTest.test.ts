import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';
import { emptyPlan, type Plan, type Prop, type RawPiece } from './types';

import { boxFromCorners } from './geometry/box';
import { hitTest, itemsInBox } from './hitTest';

/** A 2 m wood wall along x, its pivot at (x, z). */
const wall = (id: string, x: number, z = 0, y = 0): RawPiece => ({
  id,
  prefab: 'woodwall',
  position: { x, y, z },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
});

const prop = (id: string, prefab: string, x: number): Prop => ({
  id,
  prefab,
  position: { x, z: 0 },
  rotation: 0,
  upgrades: 0,
  elevation: 0,
});

const planOf = (
  raws: RawPiece[],
  props: Prop[] = [],
  dimensions: Plan['dimensions'] = {}
): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(raws.map((r) => [r.id, r])),
  props: Object.fromEntries(props.map((p) => [p.id, p])),
  dimensions,
});

const TOL = 0.1;
const opts = { propDefs: testLibrary.propDefs, rawLib: testLibrary, selection: [] };
const at = (plan: Plan, x: number, z: number) => hitTest(plan, { x, z }, TOL, opts);

describe('hitTest', () => {
  it('puts a dimension before a raw piece', () => {
    const plan = planOf([wall('w', 2)], [], {
      d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, offset: 0, elevation: 0 },
    });
    expect(at(plan, 2, 0)).toMatchObject({ kind: 'dimension', id: 'd' });
  });

  it('puts small props before raw pieces and large ones after', () => {
    // A wall runs through a chest (small) and a longship (large).
    const plan = planOf(
      [wall('a', -10), wall('b', 10)],
      [prop('c', 'piece_chest_wood', -10), prop('s', 'VikingShip', 10)]
    );
    expect(at(plan, -10, 0)).toMatchObject({ kind: 'prop', id: 'c' });
    expect(at(plan, 10, 0)).toMatchObject({ kind: 'raw', id: 'b' });
    expect(at(plan, 10, 2)).toMatchObject({ kind: 'prop', id: 's' });
  });

  it('of equal raw footprints takes the highest', () => {
    const plan = planOf([wall('low', 0), wall('high', 0, 0, 4), wall('mid', 0, 0, 2)]);
    expect(at(plan, 0, 0)).toMatchObject({ kind: 'raw', id: 'high' });
  });

  it('of equal prop footprints prefers the selected one, then the one drawn on top', () => {
    const stacked = planOf(
      [],
      [prop('a', 'piece_chest_wood', 0), prop('b', 'piece_chest_wood', 0)]
    );
    expect(at(stacked, 0, 0)).toMatchObject({ id: 'b' });
    const selection = [{ kind: 'prop' as const, id: 'a' }];
    expect(hitTest(stacked, { x: 0, z: 0 }, TOL, { ...opts, selection })).toMatchObject({
      id: 'a',
    });
  });
});

describe('itemsInBox', () => {
  const plan = planOf([wall('w', 0)], [prop('c', 'piece_chest_wood', 10)]);
  const halfBox = boxFromCorners({ x: -2, z: -1 }, { x: 0, z: 1 });
  const wallBox = boxFromCorners({ x: -2, z: -1 }, { x: 2, z: 1 });
  const chestBox = boxFromCorners({ x: 8, z: -2 }, { x: 12, z: 2 });

  it('contain needs the whole piece inside; touch any part', () => {
    expect(itemsInBox(plan, halfBox, 'contain', testLibrary)).toEqual([]);
    expect(itemsInBox(plan, halfBox, 'touch', testLibrary)).toEqual([{ kind: 'raw', id: 'w' }]);
    expect(itemsInBox(plan, wallBox, 'contain', testLibrary)).toEqual([{ kind: 'raw', id: 'w' }]);
  });

  it('takes a prop by its footprint', () => {
    expect(itemsInBox(plan, chestBox, 'contain', testLibrary)).toEqual([{ kind: 'prop', id: 'c' }]);
  });
});
