import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { findRooms } from './rooms';
import type { Vec2, WallRun, WallSide } from './types';
import { buildWallGraph } from './wallGraph';

const pts = (...xz: [number, number][]): Vec2[] => xz.map(([x, z]) => ({ x, z }));

let nextId = 0;
const run = (
  familyId: string,
  points: Vec2[],
  { closed = false, side = 'right' }: { closed?: boolean; side?: WallSide } = {}
): WallRun => ({ id: `w${nextId++}`, familyId, points, closed, side, height: 2, elevation: 0 });

const square = (x: number, z: number, size: number) =>
  pts([x, z], [x + size, z], [x + size, z + size], [x, z + size]);

const roomsOf = (...runs: WallRun[]) =>
  findRooms(
    buildWallGraph(Object.fromEntries(runs.map((r) => [r.id, r])), testLibrary.wallFamilies)
  );

describe('findRooms', () => {
  it('measures a wood 8 × 8 room', () => {
    const { rooms, summary } = roomsOf(run('wood', square(0, 0, 8), { closed: true }));
    expect(rooms).toHaveLength(1);
    const room = rooms[0]!;
    expect(room.clearBox?.w).toBeCloseTo(7.7);
    expect(room.clearArea).toBeCloseTo(59.29);
    expect(room.outerBox.w).toBeCloseTo(8.3);
    expect(room.gridArea).toBe(64);
    expect(room.roof).toMatchObject({ span: 8, wholePiece: true });
    expect(summary.footprintArea).toBeCloseTo(8.3 * 8.3);
  });

  it('measures stone 8 × 8 with the strip inside and outside', () => {
    const inside = roomsOf(run('stone', square(0, 0, 8), { closed: true })).rooms[0]!;
    expect([inside.clearBox?.w, inside.clearArea, inside.outerBox.w]).toEqual([6, 36, 8]);
    const outside = roomsOf(run('stone', square(0, 0, 8), { closed: true, side: 'left' }))
      .rooms[0]!;
    expect([outside.clearBox?.w, outside.outerBox.w]).toEqual([8, 10]);
  });

  it('finds two rooms sharing a wall', () => {
    const { rooms, buildings } = roomsOf(
      run('wood', pts([0, 0], [16, 0], [16, 8], [0, 8]), { closed: true }),
      run('wood', pts([8, 0], [8, 8]))
    );
    expect(rooms.map((r) => r.clearArea)).toEqual([
      expect.closeTo(7.7 * 7.7),
      expect.closeTo(7.7 * 7.7),
    ]);
    expect(buildings).toHaveLength(1);
  });

  it('measures an L-shaped room', () => {
    const [room] = roomsOf(
      run('wood', pts([0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]), { closed: true })
    ).rooms;
    expect(room?.gridArea).toBe(48);
    expect(room?.rectangular).toBe(false);
  });

  it('subtracts a room inside a room, and a free-standing wall', () => {
    const outer = run('wood', square(0, 0, 12), { closed: true });
    const result = roomsOf(outer, run('wood', square(4, 4, 4), { closed: true }));
    const big = result.rooms.find((r) => r.gridBox.w === 12)!;
    expect(big.gridArea).toBe(144 - 16);
    expect(big.clearArea).toBeCloseTo(11.7 ** 2 - 4.3 ** 2);
    expect(result.buildings).toHaveLength(1);

    const walled = roomsOf(outer, run('wood', pts([4, 6], [8, 6]))).rooms[0]!;
    expect(walled.clearArea).toBeCloseTo(11.7 ** 2 - 4 * 0.3);
  });

  it('reduces the clear area for a stub, and makes no room of an open wall', () => {
    const [room] = roomsOf(
      run('wood', square(0, 0, 8), { closed: true }),
      run('wood', pts([4, 0], [4, 3]))
    ).rooms;
    expect(room?.clearArea).toBeCloseTo(7.7 * 7.7 - 0.3 * 2.85);
    expect(roomsOf(run('wood', pts([0, 0], [8, 0], [8, 8], [0, 8]))).rooms).toHaveLength(0);
  });

  it('splits the clear floor at a neck too narrow for its walls', () => {
    // Two 4 × 4 stone lobes joined by a 2 × 1 neck, strip inside.
    const neck = run(
      'stone',
      pts(
        [0, 0],
        [4, 0],
        [4, 1.5],
        [6, 1.5],
        [6, 0],
        [10, 0],
        [10, 4],
        [6, 4],
        [6, 2.5],
        [4, 2.5],
        [4, 4],
        [0, 4]
      ),
      { closed: true }
    );
    const [room] = roomsOf(neck).rooms;
    expect(room?.clearArea).toBeCloseTo(8);
    expect(room?.clear).toHaveLength(2);
  });

  it('fills a narrow notch when growing the outside', () => {
    // A stone U with a 1 m slot between its arms, strip outside.
    const u = run('stone', pts([0, 0], [3, 0], [3, 6], [4, 6], [4, 0], [7, 0], [7, 8], [0, 8]), {
      closed: true,
      side: 'left',
    });
    const { rooms, summary } = roomsOf(u);
    expect([rooms[0]?.outerBox.w, rooms[0]?.outerBox.d]).toEqual([9, 10]);
    expect(summary.footprintArea).toBeCloseTo(90);
  });

  it('collapses a 1 × 1 stone room with the strip inside', () => {
    const [room] = roomsOf(run('stone', square(0, 0, 1), { closed: true })).rooms;
    expect(room?.clear).toEqual([]);
    expect(room?.clearArea).toBe(0);
  });
});
