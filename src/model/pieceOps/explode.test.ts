import { describe, expect, it } from 'vitest';

import type { RoofPitch } from '../../catalog/roofFamilies';
import { testLibrary } from '../../catalog/testLibrary';
import { applyCommands } from '../commands';
import { derivePlan } from '../derivePlan';
import { pieceBoxes } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import { roofContacts } from '../roofs/roofContacts';
import { modelSupport, supportModel } from '../support/planSupport';
import { snapJoints } from '../support/snapJoints';
import { createPlanStore } from '../../store/planStore';
import { emptyPlan, type Plan } from '../types';

import { explodeCommands, explodeLabel } from './explode';

const lib = testLibrary;

/** A 6 × 8 m wood house: 2 m walls with a door, a floor on top, and a gable roof. */
const house = (pitch: RoofPitch): Plan => {
  const outline = [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
    { x: 6, z: 8 },
    { x: 0, z: 8 },
  ];
  return {
    ...emptyPlan(),
    walls: {
      w: {
        id: 'w',
        familyId: 'wood',
        points: outline,
        closed: true,
        side: 'right',
        height: 2,
        elevation: 0,
      },
    },
    openings: { d: { id: 'd', wallId: 'w', prefab: 'wood_door', at: { x: 3, z: 0 } } },
    floors: {
      f: { id: 'f', familyId: 'wood', min: { x: 0, z: 0 }, max: { x: 6, z: 8 }, elevation: 2 },
    },
    roofs: {
      r: {
        id: 'r',
        elevation: 0,
        base: 2,
        outline,
        familyId: 'thatch',
        pitch,
        kind: 'gable',
        ridgeAxis: 'z',
        lowSide: '-z',
        overhang: { eave: 1, gable: 1 },
        gableWalls: 'wood',
      },
    },
    props: {
      p: {
        id: 'p',
        prefab: 'wood_pole2',
        position: { x: 3, z: 4 },
        rotation: 0,
        upgrades: 0,
        elevation: 0,
      },
    },
  };
};

const ids = () => {
  let n = 0;
  return () => `n${n++}`;
};

const boxesOf = (plan: Plan) => pieceBoxes(derivePlan(plan, lib), plan, lib);

/** How many pieces would collapse, as the app works it out (roof rests and snap joints in). */
const collapsing = (plan: Plan): number => {
  const boxes = boxesOf(plan);
  const model = supportModel(boxes, lib.catalog.materialSupport);
  const extra = [
    ...roofContacts(plan, derivePlan(plan, lib), lib),
    ...snapJoints(boxes, lib).pairs,
  ];
  return modelSupport(model, extra).collapsing.reduce((n, line) => n + line.count, 0);
};

/** The house's items. */
const everything = [
  { kind: 'wall', id: 'w' },
  { kind: 'floor', id: 'f' },
  { kind: 'roof', id: 'r' },
  { kind: 'prop', id: 'p' },
] as const;

describe('explodeCommands', () => {
  it('turns a house into raw pieces with the same bill and model pivots', () => {
    const plan = house(26);
    const before = boxesOf(plan);
    const { cmds, items, exploded, skipped } = explodeCommands(plan, everything, lib, ids());
    const after = applyCommands(plan, cmds);
    expect([after.walls, after.openings, after.floors, after.roofs, after.props]).toEqual([
      {},
      {},
      {},
      {},
      {},
    ]);
    expect(Object.keys(after.rawPieces)).toHaveLength(before.length);
    expect(items).toHaveLength(before.length);
    expect(exploded).toHaveLength(4);
    expect(skipped).toBe(0);
    expect(derivePlan(after, lib).bom).toEqual(derivePlan(plan, lib).bom);
    // Pieces come in box order: each model pivot where its box's was (a floor's 1 mm lift aside).
    before.forEach((box, i) => {
      const pivot = rawBox(after.rawPieces[items[i]!.id]!, lib).pivot;
      expect(
        Math.hypot(pivot.x - box.pivot.x, pivot.y - box.pivot.y, pivot.z - box.pivot.z)
      ).toBeLessThanOrEqual(1.0001e-3);
    });
    expect(explodeLabel({ exploded, items })).toBe(`Explode 4 items (${before.length} pieces)`);
  });

  it('takes a wall with its door panel; an opening alone or a raw piece is not explodable', () => {
    const plan = house(45);
    const wall = explodeCommands(
      plan,
      [
        { kind: 'wall', id: 'w' },
        { kind: 'opening', id: 'd' },
      ],
      lib,
      ids()
    );
    expect(wall.exploded).toEqual([{ kind: 'wall', id: 'w' }]);
    expect(wall.items.map((i) => applyCommands(plan, wall.cmds).rawPieces[i.id]!.prefab)).toContain(
      'wood_door'
    );
    expect(explodeLabel(wall)).toMatch(/^Explode wall \(\d+ pieces\)$/);
    expect(explodeCommands(plan, [{ kind: 'opening', id: 'd' }], lib, ids()).cmds).toEqual([]);
  });

  it('skips boxes without a prefab and counts them', () => {
    const plan = house(26);
    const boxes = boxesOf(plan).map((box) =>
      box.kind === 'floor' ? { ...box, prefab: null } : box
    );
    const floors = boxes.filter((b) => b.kind === 'floor').length;
    const { skipped, items } = explodeCommands(
      plan,
      [{ kind: 'floor', id: 'f' }],
      lib,
      ids(),
      boxes
    );
    expect([skipped, items.length]).toEqual([floors, 0]);
  });

  it.each([26, 45, 67] as const)('keeps a %i° house standing once exploded', (pitch) => {
    const plan = house(pitch);
    const after = applyCommands(plan, explodeCommands(plan, everything, lib, ids()).cmds);
    expect(collapsing(after)).toBe(collapsing(plan));
  });

  it('keeps a drawn roof resting on its exploded walls', () => {
    const plan = house(45);
    const after = applyCommands(plan, explodeCommands(plan, [everything[0]], lib, ids()).cmds);
    const notes = (p: Plan) =>
      derivePlan(p, lib).warnings.filter((w) => /not resting/.test(w.message));
    expect(notes(after)).toEqual([]);
    const rests = (p: Plan) => roofContacts(p, derivePlan(p, lib), lib);
    expect(rests(plan).length).toBeGreaterThan(0);
    expect(rests(after).length).toBe(rests(plan).length);
    expect(rests(after).every(([, wall]) => wall.startsWith('raw:'))).toBe(true);
  });

  it('commits as one undo entry, which brings the house back', () => {
    const plan = house(26);
    const store = createPlanStore(plan);
    const explosion = explodeCommands(plan, everything, lib, ids());
    const label = explodeLabel(explosion);
    expect(store.transact(label, (dispatch) => explosion.cmds.forEach(dispatch)).ok).toBe(true);
    expect(store.historyLabels().undo).toEqual([label]);
    store.undo();
    expect(store.getPlan()).toEqual(plan);
  });
});
