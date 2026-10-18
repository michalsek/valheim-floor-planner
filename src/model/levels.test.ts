import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { applyCommands } from './commands';
import {
  boxesInView,
  ghostPlan,
  itemsFrom,
  levelIndex,
  levelPlan,
  selectionLevels,
  shiftElevation,
  type LevelViewMode,
} from './levels';
import type { PieceBox } from './pieceBoxes';
import { emptyPlan, type Floor, type Plan, type WallRun } from './types';

const wall = (id: string, elevation: number, height = 2): WallRun => ({
  id,
  familyId: 'wood',
  points: [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
  ],
  closed: false,
  side: 'right',
  height,
  elevation,
});

const floor = (id: string, elevation: number): Floor => ({
  id,
  familyId: 'wood',
  min: { x: 0, z: 0 },
  max: { x: 4, z: 4 },
  elevation,
});

const plan: Plan = {
  ...emptyPlan(),
  walls: { g: wall('g', 0), tall: wall('tall', 0, 5.6), u: wall('u', 2), top: wall('top', 4) },
  floors: { f2: floor('f2', 2), f4: floor('f4', 4) },
  openings: { d: { id: 'd', wallId: 'u', prefab: 'wood_door', at: { x: 2, z: 0 } } },
};

const stair = (id: string, elevation: number) => ({
  id,
  prefab: 'wood_stair',
  position: { x: 10, z: 10 - 2 * elevation },
  rotation: 0,
  upgrades: 0,
  elevation,
});

/** A 1 m box of the level at `elevation`, from `bottom` up `height` metres. */
const box = (key: string, elevation: number, bottom = elevation, height = 1): PieceBox =>
  ({
    key,
    elevation,
    group: key.startsWith('stair') ? 'stairs' : null,
    center: { x: 0, y: bottom + height / 2, z: 0 },
    size: { x: 1, y: height, z: 1 },
    rotationY: 0,
  }) as PieceBox;

describe('levels', () => {
  it('views one level with the plan’s own objects, and is the plan when all share it', () => {
    const level = levelPlan(plan, 2, testLibrary);
    expect(Object.keys(level.walls)).toEqual(['u']);
    expect(level.walls.u).toBe(plan.walls.u);
    expect(level.openings).toEqual({ d: plan.openings.d });
    expect(levelPlan(plan, 2, testLibrary)).toBe(level);
    // An edit elsewhere keeps the level's walls record (and so its rooms and splits).
    const renamed = { ...plan, name: 'Hall' };
    expect(levelPlan(renamed, 2, testLibrary).walls).toBe(level.walls);
    const flat = { ...emptyPlan(), walls: { g: wall('g', 0) } };
    expect(levelPlan(flat, 0, testLibrary)).toBe(flat);
  });

  it('puts a stair flight on the level it starts from, and makes no level of it', () => {
    const stairs = { ...plan, props: { s0: stair('s0', 2), s1: stair('s1', 3) } };
    expect(levelIndex(stairs, testLibrary).levels).toEqual([0, 2, 4]);
    expect(Object.keys(levelPlan(stairs, 2, testLibrary).props)).toEqual(['s0', 's1']);
  });

  it('ghosts the nearest level below, and lower things that reach near the current one', () => {
    const ghosts = ghostPlan(plan, 4, testLibrary);
    expect(Object.keys(ghosts.walls).sort()).toEqual(['tall', 'u']);
    expect(Object.keys(ghosts.floors)).toEqual(['f2']);
    expect(Object.keys(ghostPlan(plan, 0, testLibrary).walls)).toEqual([]);
  });

  it('ripples everything from a level up by one step, openings riding on their wall', () => {
    const items = itemsFrom(plan, 2);
    expect(items.map((i) => i.id).sort()).toEqual(['f2', 'f4', 'top', 'u']);
    const moved = applyCommands(plan, shiftElevation(plan, items, 1));
    expect([moved.walls.u?.elevation, moved.walls.top?.elevation]).toEqual([3, 5]);
    expect([moved.floors.f2?.elevation, moved.walls.g?.elevation]).toEqual([3, 0]);
    expect(Object.keys(levelPlan(moved, 3, testLibrary).openings)).toEqual(['d']);
  });

  it('draws the levels of each view mode, the current and hovered ones always whole', () => {
    const keys = (mode: LevelViewMode, datum: number, hovered: number | null = null) =>
      boxesInView(boxes, plan, testLibrary, { mode, datum, hovered }).map((b) => b.key);
    const boxes = [
      box('above', 4),
      box('pole', 2, 2, 4),
      box('course', 0, 3),
      box('low', 0, 2.9),
      box('stair', 3.5),
      // The current level's roof: its eave course under the cut, a course over it.
      { ...box('eave', 2, 2.5), roofCover: true as const },
      { ...box('cover', 2, 3), roofCover: true as const },
    ];
    expect(keys('cut', 2)).toEqual(['pole', 'low', 'stair', 'eave']);
    expect(keys('cut', 2, 4)).toEqual(['above', 'pole', 'low', 'stair', 'eave']);
    expect(keys('only', 2)).toEqual(['pole', 'stair', 'eave', 'cover']);
    expect(keys('only', 2, 0)).toEqual(['pole', 'course', 'low', 'stair', 'eave', 'cover']);
    expect(keys('above', 2)).toEqual(['above', 'pole', 'stair', 'eave', 'cover']);
    expect(boxesInView(boxes, plan, testLibrary, { mode: 'all', datum: 2, hovered: null })).toBe(
      boxes
    );
    expect(boxesInView(boxes, plan, testLibrary, { mode: 'cut', datum: 4, hovered: null })).toBe(
      boxes
    );
  });

  it('reports the levels of the selection: an opening’s wall’s, a stair piece’s flight’s', () => {
    const stairs = { ...plan, props: { s1: stair('s1', 3) } };
    const levels = selectionLevels(
      stairs,
      [
        { kind: 'opening', id: 'd' },
        { kind: 'prop', id: 's1' },
        { kind: 'wall', id: 'top' },
      ],
      testLibrary
    );
    expect([...levels].sort((a, b) => a - b)).toEqual([2, 4]);
  });
});
