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
import { emptyPlan, type Plan, type RawPiece } from './types';

/** A raw piece on the level at `elevation`, its pivot `y` above it. */
const raw = (id: string, prefab: string, elevation: number, y = 0): RawPiece => ({
  id,
  prefab,
  position: { x: 0, y, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  elevation,
});

const plan: Plan = {
  ...emptyPlan(),
  rawPieces: {
    g: raw('g', 'woodwall', 0),
    // On the ground level, its pivot 3.6 m up: `ghostPlan` takes a raw piece's pivot for its
    // reach, so this ghosts on the level at 4 (the pivot is the box's middle, not its top).
    tall: raw('tall', 'wood_pole_log_4', 0, 3.6),
    u: raw('u', 'woodwall', 2),
    top: raw('top', 'woodwall', 4),
    f2: raw('f2', 'wood_floor', 2),
    f4: raw('f4', 'wood_floor', 4),
  },
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
    expect(Object.keys(level.rawPieces)).toEqual(['u', 'f2']);
    expect(level.rawPieces.u).toBe(plan.rawPieces.u);
    expect(levelPlan(plan, 2, testLibrary)).toBe(level);
    // An edit elsewhere keeps the level's record (and so its cached boxes).
    const renamed = { ...plan, name: 'Hall' };
    expect(levelPlan(renamed, 2, testLibrary).rawPieces).toBe(level.rawPieces);
    const flat = { ...emptyPlan(), rawPieces: { g: raw('g', 'woodwall', 0) } };
    expect(levelPlan(flat, 0, testLibrary)).toBe(flat);
  });

  it('puts a stair flight on the level it starts from, and makes no level of it', () => {
    const stairs = { ...plan, props: { s0: stair('s0', 2), s1: stair('s1', 3) } };
    expect(levelIndex(stairs, testLibrary).levels).toEqual([0, 2, 4]);
    expect(Object.keys(levelPlan(stairs, 2, testLibrary).props)).toEqual(['s0', 's1']);
  });

  it('ghosts the nearest level below, and lower things that reach near the current one', () => {
    const ghosts = ghostPlan(plan, 4, testLibrary);
    expect(Object.keys(ghosts.rawPieces).sort()).toEqual(['f2', 'tall', 'u']);
    expect(Object.keys(ghostPlan(plan, 0, testLibrary).rawPieces)).toEqual([]);
  });

  it('ripples everything from a level up by one step', () => {
    const items = itemsFrom(plan, 2);
    expect(items.map((i) => i.id).sort()).toEqual(['f2', 'f4', 'top', 'u']);
    const moved = applyCommands(plan, shiftElevation(plan, items, 1));
    const { u, top, f2, g } = moved.rawPieces;
    expect([u?.elevation, top?.elevation, f2?.elevation, g?.elevation]).toEqual([3, 5, 3, 0]);
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

  it('reports the levels of the selection: a stair piece’s is its flight’s', () => {
    const stairs = { ...plan, props: { s1: stair('s1', 3) } };
    const levels = selectionLevels(
      stairs,
      [
        { kind: 'raw', id: 'u' },
        { kind: 'prop', id: 's1' },
        { kind: 'raw', id: 'top' },
      ],
      testLibrary
    );
    expect([...levels].sort((a, b) => a - b)).toEqual([2, 4]);
  });
});
