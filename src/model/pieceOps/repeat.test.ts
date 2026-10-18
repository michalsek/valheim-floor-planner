import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { applyCommands } from '../commands';
import { emptyPlan, type Plan, type RawPiece } from '../types';

import { repeatCommands, repeatLabel, setSnapExtent } from './repeat';

const lib = testLibrary;

const wall: RawPiece = {
  id: 'w',
  prefab: 'woodwall',
  position: { x: 1, y: 1, z: 0 },
  rotation: { yaw: 90, pitch: 0, roll: 0 },
  elevation: 0,
};
const plan: Plan = { ...emptyPlan(), rawPieces: { w: wall } };
const items = [{ kind: 'raw', id: 'w' }] as const;

describe('repeatCommands', () => {
  it('steps by the snap extent along, across and up the primary piece', () => {
    // Turned 90° (clockwise), the wall runs along z; it is 2 m long and high, flat across.
    expect(setSnapExtent(plan, items, 'along', lib)).toBe(2);
    expect(setSnapExtent(plan, items, 'up', lib)).toBe(2);
    expect(setSnapExtent(plan, items, 'across', lib)).toBe(0.3);
  });

  it('makes count − 1 copies at multiples of the step, as one list of inserts', () => {
    let n = 0;
    const step = setSnapExtent(plan, items, 'along', lib);
    const result = repeatCommands(
      plan,
      items,
      { count: 5, axis: 'along', sign: -1, step },
      () => `c${n++}`
    );
    expect(result.cmds.every((cmd) => cmd.type === 'raw.insert')).toBe(true);
    const after = applyCommands(plan, result.cmds);
    const zs = result.items.map((item) => after.rawPieces[item.id]!.position.z);
    expect(zs).toEqual([-2, -4, -6, -8]);
    expect(result.items.every((item) => after.rawPieces[item.id]!.prefab === 'woodwall')).toBe(
      true
    );
    expect(repeatLabel(1, 5)).toBe('Repeat 1 piece ×5');
  });
});
