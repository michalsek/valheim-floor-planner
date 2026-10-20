import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { applyCommands } from '../commands';
import { derivePlan } from '../derivePlan';
import { pieceBoxes } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import { createPlanStore } from '../../store/planStore';
import { emptyPlan, type Plan, type Prop } from '../types';

import { explodeCommands, explodeLabel } from './explode';

const lib = testLibrary;

const prop = (id: string, prefab: string, x: number, elevation = 0): Prop => ({
  id,
  prefab,
  position: { x, z: 2 },
  rotation: 22.5,
  upgrades: 0,
  elevation,
});

/** A workbench, a log pole a level up, a raw wall and a dimension. */
const plan: Plan = {
  ...emptyPlan(),
  props: { b: prop('b', 'piece_workbench', 0), p: prop('p', 'wood_pole_log', 4, 2) },
  rawPieces: {
    q: {
      id: 'q',
      prefab: 'woodwall',
      position: { x: 10, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 },
    },
  },
  dimensions: { m: { id: 'm', a: { x: 0, z: -2 }, b: { x: 6, z: -2 }, offset: 0, elevation: 0 } },
};

const props = [
  { kind: 'prop', id: 'b' },
  { kind: 'prop', id: 'p' },
] as const;

const ids = () => {
  let n = 0;
  return () => `n${n++}`;
};

describe('explodeCommands', () => {
  it('turns a workbench and a log pole into raw pieces with the same bill and pivots', () => {
    const before = pieceBoxes(plan, lib).filter((box) => box.kind === 'prop');
    const { cmds, items, exploded } = explodeCommands(plan, props, lib, ids());
    const after = applyCommands(plan, cmds);
    expect(after.props).toEqual({});
    expect(items).toHaveLength(2);
    expect(exploded).toEqual(props);
    expect(derivePlan(after, lib).bom).toEqual(derivePlan(plan, lib).bom);
    before.forEach((box, i) => {
      const pivot = rawBox(after.rawPieces[items[i]!.id]!, lib).pivot;
      expect(
        Math.hypot(pivot.x - box.pivot.x, pivot.y - box.pivot.y, pivot.z - box.pivot.z)
      ).toBeLessThanOrEqual(1e-3);
    });
    expect(explodeLabel({ exploded, items })).toBe('Explode 2 items (2 pieces)');
  });

  it('leaves raw pieces and dimensions alone', () => {
    const items = [
      { kind: 'raw', id: 'q' },
      { kind: 'dimension', id: 'm' },
    ] as const;
    expect(explodeCommands(plan, items, lib, ids())).toMatchObject({ cmds: [], exploded: [] });
  });

  it('commits as one undo entry, which brings the items back', () => {
    const store = createPlanStore(plan);
    const explosion = explodeCommands(plan, props, lib, ids());
    const label = explodeLabel(explosion);
    expect(store.transact(label, (dispatch) => explosion.cmds.forEach(dispatch)).ok).toBe(true);
    expect(store.historyLabels().undo).toEqual([label]);
    store.undo();
    expect(store.getPlan()).toEqual(plan);
  });
});
