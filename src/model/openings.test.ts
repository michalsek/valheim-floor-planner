import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { translateCommands } from './editCommands';
import { orientClockwise } from './geometry/polyline';
import { carryOpenings, resolveOpenings } from './openings';
import { emptyPlan, type Opening, type Plan, type Vec2, type WallRun } from './types';
import { moveVertexRaw } from './vertexDrag';

const loop = (familyId: string, points: [number, number][]): WallRun => ({
  id: 'w',
  familyId,
  points: points.map(([x, z]) => ({ x, z })),
  closed: true,
  side: 'right',
  height: 2,
  elevation: 0,
});

// Clockwise on screen: top, right, bottom, left.
const square8 = loop('wood', [
  [0, 0],
  [8, 0],
  [8, 8],
  [0, 8],
]);

const door = (id: string, at: Vec2): Opening => ({ id, wallId: 'w', prefab: 'wood_door', at });

const resolve = (run: WallRun, ...openings: Opening[]) =>
  resolveOpenings(
    run,
    testLibrary.wallFamilies.get(run.familyId),
    openings,
    testLibrary.openingDefs
  );

describe('resolveOpenings', () => {
  it('keeps an anchor through loop reversal, with a new segment index', () => {
    const anticlockwise = {
      ...square8,
      points: [...square8.points].reverse(),
      side: 'left' as const,
    };
    const before = resolve(anticlockwise, door('d', { x: 8, z: 4 }));
    const after = resolve(orientClockwise(anticlockwise), door('d', { x: 8, z: 4 }));
    expect(before[0]).toMatchObject({ problem: null, start: 3 });
    expect(after[0]).toMatchObject({ problem: null, segment: 2, start: 3 });
    expect(after[0]?.segment).not.toBe(before[0]?.segment);
  });

  it('resolves onto a segment that normalisation merged', () => {
    const run = loop('wood', [
      [0, 0],
      [4, 0],
      [8, 0],
      [8, 8],
      [0, 8],
    ]);
    expect(resolve(run, door('d', { x: 5, z: 0 }))[0]).toMatchObject({
      segment: 0,
      start: 4,
      problem: null,
    });
  });

  it('flags an anchor off the wall, and the later of two overlapping openings', () => {
    const [off, first, second] = resolve(
      square8,
      door('off', { x: 4, z: 1 }),
      door('b', { x: 4, z: 0 }),
      door('a', { x: 5, z: 0 })
    );
    expect(off?.problem).toBe('offWall');
    expect([first?.problem, second?.problem]).toEqual([null, 'overlaps']);
  });

  it('keeps block-wall openings off a corner column inside the segment only', () => {
    const inside = { ...square8, familyId: 'stone' };
    const [atCorner, clear] = resolve(inside, door('a', { x: 1, z: 0 }), door('b', { x: 5, z: 0 }));
    expect([atCorner?.problem, clear?.problem]).toEqual(['doesNotFit', null]);
    // Strip outside: the corner column lies beyond the segment, so nothing is reserved.
    const outside = { ...inside, side: 'left' as const };
    expect(resolve(outside, door('a', { x: 1, z: 0 }))[0]?.problem).toBe(null);
  });
});

describe('sliding openings', () => {
  it('moves neighbouring openings together, both ways', () => {
    const plan: Plan = {
      ...emptyPlan(),
      walls: { w: square8 },
      openings: { a: door('a', { x: 3, z: 0 }), b: door('b', { x: 5, z: 0 }) },
    };
    const items = [
      { kind: 'opening', id: 'a' },
      { kind: 'opening', id: 'b' },
    ] as const;
    const ats = (dx: number) =>
      translateCommands(plan, items, { x: dx, z: 0 }, testLibrary).map((c) =>
        c.type === 'opening.patch' ? [c.id, c.changes.at] : null
      );
    expect(ats(1)).toEqual([
      ['a', { x: 4, z: 0 }],
      ['b', { x: 6, z: 0 }],
    ]);
    expect(ats(-1)).toEqual([
      ['a', { x: 2, z: 0 }],
      ['b', { x: 4, z: 0 }],
    ]);
  });
});

describe('carryOpenings', () => {
  it('moves a door across with its side, and leaves one on a stretched side alone', () => {
    const moved = moveVertexRaw(square8.points, true, 2, { x: 8, z: 10 });
    const carried = carryOpenings(square8, moved, [
      door('bottom', { x: 4, z: 8 }),
      door('right', { x: 8, z: 4 }),
    ]);
    expect(carried).toEqual([{ id: 'bottom', at: { x: 4, z: 10 } }]);
  });
});
