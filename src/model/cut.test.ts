import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { applyCommands } from './commands';
import {
  aboveCut,
  cutBoxes,
  cutPlan,
  cutShowing,
  nextStop,
  prevStop,
  raiseCommands,
  cutRange,
  steppedCut,
  storeyStops,
} from './cut';
import { pieceBoxes } from './pieceBoxes';
import { emptyPlan, type Plan, type RawPiece } from './types';

const raw = (id: string, prefab: string, y: number, x = 0): RawPiece => ({
  id,
  prefab,
  position: { x, y, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
});

const planOf = (...pieces: RawPiece[]): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
});

const boxesOf = (plan: Plan) => pieceBoxes(plan, testLibrary);
const stopsOf = (plan: Plan) => storeyStops(boxesOf(plan), testLibrary);

describe('the cut', () => {
  it('shows a box by its bottom, so one straddling the cut shows whole', () => {
    // Wood walls are 2 m tall about a middle pivot.
    const plan = planOf(raw('low', 'woodwall', 1), raw('high', 'woodwall', 3));
    const boxes = boxesOf(plan);
    const keys = (h: number) => cutBoxes(boxes, h).map((b) => b.key);
    expect(keys(1)).toEqual(['raw:low']);
    expect(keys(2)).toEqual(['raw:low']);
    expect(keys(2.01)).toEqual(['raw:low', 'raw:high']);
    expect(cutBoxes(boxes, null)).toBe(boxes);
    expect(cutBoxes(boxes, 2.01)).toBe(boxes);
    expect(aboveCut(boxes, 2).map((b) => b.key)).toEqual(['raw:high']);
    expect(aboveCut(boxes, null)).toEqual([]);
  });

  it('cuts the plan keeping the objects, and raises items', () => {
    const plan: Plan = {
      ...planOf(raw('low', 'woodwall', 1), raw('high', 'woodwall', 3)),
      dimensions: { d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 1, z: 0 }, offset: 0, elevation: 2 } },
      props: {
        p: {
          id: 'p',
          prefab: 'piece_workbench',
          position: { x: 5, z: 5 },
          rotation: 0,
          upgrades: 0,
          elevation: 3,
        },
      },
    };
    const cut = (p: Plan, h: number | null) => cutPlan(p, boxesOf(p), h);
    const view = cut(plan, 2);
    expect(cut(plan, 2)).toBe(view);
    expect(cut(plan, null)).toBe(plan);
    expect(cut(plan, 10)).toBe(plan);
    expect(Object.keys(view.rawPieces)).toEqual(['low']);
    expect(view.rawPieces.low).toBe(plan.rawPieces.low);
    // An edit to a hidden piece leaves the view as it was.
    const edited = applyCommands(plan, raiseCommands(plan, [{ kind: 'raw', id: 'high' }], 1));
    expect(edited.rawPieces.high?.position.y).toBe(4);
    expect(cut(edited, 2)).toBe(view);
    // Dimensions by their elevation, props by their box.
    expect(view.dimensions).toEqual({});
    expect(Object.keys(cut(plan, 2.5).dimensions)).toEqual(['d']);
    expect(cut(plan, 3).props).toEqual({});
    expect(Object.keys(cut(plan, 3.5).props)).toEqual(['p']);
    // Raw heights stay on the micrometre.
    const nudged = applyCommands(plan, raiseCommands(plan, [{ kind: 'raw', id: 'low' }], 0.1));
    expect(nudged.rawPieces.low?.position.y).toBe(1.1);
    expect(raiseCommands(plan, [{ kind: 'raw', id: 'low' }], 0)).toEqual([]);
  });

  it('stops at the bottom of each storey floor (the user’s example)', () => {
    // Stone floors are 1 m thick about their middle; wood floors' walking tops are at
    // their pivot, their colliders 3.3 cm under it.
    const plan = planOf(
      raw('s1', 'stone_floor_2x2', 1),
      raw('s2', 'stone_floor_2x2', 1, 2),
      raw('f1', 'wood_floor', 6),
      raw('f2', 'wood_floor', 6, 2),
      raw('wall', 'woodwall', 1, 4),
      raw('onStone', 'woodwall', 2.5),
      raw('lone', 'wood_floor', 9)
    );
    const stops = stopsOf(plan);
    // The lone tile makes no stop, but counts with the storey under it.
    expect(stops).toEqual([
      { height: 0.501, top: 1.5, count: 3 },
      { height: 5.968, top: 6, count: 3 },
    ]);
  });

  it('makes no stop of tiles resting on a floor', () => {
    const floor = [0, 2, 4, 6].map((x) => raw(`f${x}`, 'stone_floor_2x2', 1, x));
    const stacked = [0, 2, 4].map((x) => raw(`s${x}`, 'stone_floor_2x2', 2, x));
    const stops = stopsOf(planOf(...floor, ...stacked));
    expect(stops.map((s) => s.height)).toEqual([0.501]);
    expect(stops[0]?.count).toBe(7);
  });

  it('clusters drifted tiles into one stop', () => {
    const drift = [0, 0.012, -0.013, 0.027, -0.008, 0.02];
    const plan = planOf(
      ...drift.map((d, i) => raw(`t${i}`, 'wood_floor', 4 + d, 2 * i)),
      raw('u1', 'wood_floor', 4.5),
      raw('u2', 'wood_floor', 4.5, 2)
    );
    const stops = stopsOf(plan);
    expect(stops.map((s) => [s.height, s.top])).toEqual([
      [3.955, 4.027],
      [4.468, 4.5],
    ]);
  });

  it('steps and jumps between stops', () => {
    // Highest box bottom 8.968 (the lone tile at 9).
    expect(steppedCut(null, -1, 1, 8.968)).toBe(8);
    expect(steppedCut(null, -1, 0.5, 8.968)).toBe(8.5);
    expect(steppedCut(null, -1, 1, null)).toBe(0);
    expect(steppedCut(null, 1, 1, 8.968)).toBeNull();
    expect(steppedCut(7, 1, 1, 8.968)).toBe(8);
    // 9 would show everything: that is All.
    expect(steppedCut(8, 1, 1, 8.968)).toBeNull();
    expect(steppedCut(2.3, 1, 1, 8.968)).toBe(3);
    expect(steppedCut(2.3, -1, 1, 8.968)).toBe(2);
    expect(steppedCut(-16, -1, 1, 8.968)).toBe(-16);
    // A bottom above the elevation range (201): down from All stops at 128, and up from
    // there is All.
    expect(steppedCut(null, -1, 1, 201)).toBe(128);
    expect(steppedCut(127, 1, 1, 201)).toBe(128);
    expect(steppedCut(128, 1, 1, 201)).toBeNull();
    expect(steppedCut(127.5, 1, 1, 201)).toBe(128);

    const stops = [
      { height: 0.501, top: 1.5, count: 3 },
      { height: 5.968, top: 6, count: 2 },
    ];
    expect(nextStop(stops, null)).toBeNull();
    expect(nextStop(stops, 0)).toBe(0.501);
    expect(nextStop(stops, 0.501)).toBe(5.968);
    expect(nextStop(stops, 5.968)).toBeNull();
    expect(prevStop(stops, null)).toBe(5.968);
    expect(prevStop(stops, 5.968)).toBe(0.501);
    expect(prevStop(stops, 0.501)).toBeNull();

    // A wall from 2 to 4 is hidden at 2 and shown at 3: the cut rises to the step above
    // its bottom.
    const plan = planOf(raw('w', 'woodwall', 3));
    const items = [{ kind: 'raw', id: 'w' }] as const;
    expect(cutShowing(3, plan, items, 1, testLibrary)).toBe(3);
    expect(cutShowing(2, plan, items, 1, testLibrary)).toBe(3);
    expect(cutShowing(2, plan, items, 0.5, testLibrary)).toBe(2.5);
    expect(cutShowing(null, plan, items, 1, testLibrary)).toBeNull();
    // Above the elevation range the cut can't show it: All.
    const high = planOf(raw('w', 'woodwall', 201));
    expect(cutShowing(3, high, items, 1, testLibrary)).toBeNull();

    // The slider's range: bottoms 0 and 2 (walls at 1 and 3).
    const walls = boxesOf(planOf(raw('low', 'woodwall', 1), raw('high', 'woodwall', 3)));
    expect(cutRange(walls, 1)).toEqual({ min: 1, max: 2 });
    expect(cutRange(walls, 0.5)).toEqual({ min: 0.5, max: 2 });
    expect(cutRange([], 1)).toBeNull();
    // Every bottom within one step: no value between them, so no slider.
    expect(cutRange(boxesOf(planOf(raw('w', 'woodwall', 1.2))), 1)).toBeNull();
  });
});
