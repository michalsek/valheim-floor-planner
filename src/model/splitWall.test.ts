import { describe, expect, it } from 'vitest';

import { wallFamilyById } from '../catalog';

import { orientClockwise, signedArea } from './geometry/polyline';
import { splitWall, type WallCut } from './splitWall';
import type { Vec2, WallRun, WallSide } from './types';

const run = (
  familyId: string,
  points: Vec2[],
  closed = false,
  side: WallSide = 'right',
  height = 2
): WallRun => ({ id: 'w', familyId, points, closed, side, height });

const split = (r: WallRun, cuts: readonly WallCut[] = []) =>
  splitWall(r, wallFamilyById.get(r.familyId)!, cuts).pieces;

const groundLength = (r: WallRun) =>
  split(r)
    .filter((piece) => piece.base === 0)
    .reduce((sum, piece) => sum + piece.footprint.length, 0);

const count = (r: WallRun) => {
  const counts: Record<string, number> = {};
  for (const { prefab } of split(r)) counts[prefab] = (counts[prefab] ?? 0) + 1;
  return counts;
};

// Clockwise on screen (+z is down), so 'right' is inside.
const square8 = [
  { x: 0, z: 0 },
  { x: 8, z: 0 },
  { x: 8, z: 8 },
  { x: 0, z: 8 },
];

describe('splitWall', () => {
  it('centres panel pieces on the line', () => {
    const pieces = split(
      run('wood', [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
      ])
    );
    expect(pieces.map((piece) => [piece.center, piece.rotation])).toEqual([
      [{ x: 1, z: 0 }, 0],
      [{ x: 3, z: 0 }, 0],
    ]);
  });

  it('rotates pieces on a vertical segment', () => {
    const [piece] = split(
      run('wood', [
        { x: 0, z: 0 },
        { x: 0, z: 2 },
      ])
    );
    expect(piece?.rotation).toBeCloseTo(Math.PI / 2);
  });

  it.each([
    ['right', 0.5],
    ['left', -0.5],
  ] as const)('offsets a block strip to the %s', (side, z) => {
    const [piece] = split(
      run(
        'stone',
        [
          { x: 0, z: 0 },
          { x: 4, z: 0 },
        ],
        false,
        side
      )
    );
    expect(piece?.center.z).toBeCloseTo(z);
  });

  it('builds an 8 × 8 stone loop with the strip inside', () => {
    const r = run('stone', square8, true, 'right');
    expect(groundLength(r)).toBeCloseTo(28);
    expect(count(r)).toEqual({ stone_wall_4x2: 4, stone_wall_2x1: 8, stone_wall_1x1: 8 });
  });

  it('builds an 8 × 8 stone loop with the strip outside', () => {
    expect(groundLength(run('stone', square8, true, 'left'))).toBeCloseTo(36);
  });

  it('gives an open L corner to the first segment only', () => {
    // Right turn with the strip on the left: a gap, so the first segment runs on by 1 m.
    const r = run(
      'stone',
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 4 },
      ],
      false,
      'left'
    );
    const lengthOf = (segment: number) =>
      split(r)
        .filter((piece) => piece.segment === segment && piece.base === 0)
        .reduce((sum, piece) => sum + piece.footprint.length, 0);
    expect([lengthOf(0), lengthOf(1)]).toEqual([5, 4]);
  });

  it('keeps the strip inside when an anticlockwise loop is turned clockwise', () => {
    const anticlockwise = run('stone', [...square8].reverse(), true, 'left');
    const oriented = orientClockwise(anticlockwise);
    expect(oriented.side).toBe('right');
    expect(signedArea(oriented.points)).toBeGreaterThan(0);
    expect(groundLength(oriented)).toBeCloseTo(28);
  });

  describe('with an opening cut', () => {
    const line = (familyId: string, length: number, height: number) =>
      run(
        familyId,
        [
          { x: 0, z: 0 },
          { x: length, z: 0 },
        ],
        false,
        'right',
        height
      );
    const door = (start: number, width: number, height: number): WallCut[] => [
      { segment: 0, start, width, height },
    ];

    it('leaves a 2 m wood door gap in an 8 × 2 wall: 3 ground pieces, none above', () => {
      const pieces = split(line('wood', 8, 2), door(2, 2, 2));
      expect(pieces.filter((p) => p.course === 0)).toHaveLength(3);
      expect(pieces.every((p) => p.center.x < 2 || p.center.x > 4)).toBe(true);
    });

    it('fills the 2 m above a 2 m door in a 4 m stone wall', () => {
      const above = split(line('stone', 8, 4), door(2, 2, 2)).filter(
        (p) => p.center.x > 2 && p.center.x < 4
      );
      expect(above.reduce((sum, p) => sum + p.footprint.length * p.height, 0)).toBeCloseTo(4);
      expect(Math.min(...above.map((p) => p.base))).toBe(2);
    });

    it('cuts a 3 m gate through the full height of a 2 m wall', () => {
      const pieces = split(line('wood', 8, 2), door(2, 2, 3));
      expect(pieces.some((p) => p.center.x > 2 && p.center.x < 4)).toBe(false);
    });
  });
});
