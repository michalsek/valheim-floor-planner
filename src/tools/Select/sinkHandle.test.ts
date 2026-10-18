import { beforeAll, describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { emptyPlan, type Plan, type RawPiece } from '../../model/types';
import { setLibrary } from '../../store/libraryInstance';

import { sinkCommands, sinkTargets } from './sinkHandle';

const wall = (id: string, x: number, y = 1): RawPiece => ({
  id,
  prefab: 'woodwall',
  position: { x, y, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  elevation: 0,
});

const planOf = (...pieces: RawPiece[]): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
});

const sel = (...ids: string[]) => ids.map((id) => ({ kind: 'raw' as const, id }));

beforeAll(() => setLibrary(testLibrary));

describe('sink handle', () => {
  it('sinks a raw piece on the ground by the step, and finer with Shift', () => {
    const plan = planOf(wall('a', 0));
    const targets = sinkTargets(plan, sel('a'));
    expect(targets).toHaveLength(1);
    expect(targets[0]!.depth).toBeCloseTo(0, 6);
    const half = sinkCommands(plan, targets, -0.6, 0.5);
    expect(half.depth).toBeCloseTo(-0.5, 6);
    expect(half.cmds).toEqual([
      { type: 'raw.patch', id: 'a', changes: { position: { x: 0, y: 0.5, z: 0 } } },
    ]);
    expect(sinkCommands(plan, targets, -0.6, 0.1).depth).toBeCloseTo(-0.6, 6);
  });

  it('stops at the ground on the way up', () => {
    const plan = planOf(wall('a', 0, 0));
    const [target] = sinkTargets(plan, sel('a'));
    expect(target!.depth).toBeCloseTo(-1, 6);
    expect(sinkCommands(plan, [target!], 5, 0.5).depth).toBeCloseTo(0, 6);
  });

  it('needs every piece free of unselected ones, and moves them together', () => {
    const stacked = planOf(wall('a', 0), wall('b', 0, 3));
    expect(sinkTargets(stacked, sel('b'))).toEqual([]);
    expect(sinkTargets(stacked, sel('a'))).toEqual([]);
    const both = sinkTargets(stacked, sel('b', 'a'));
    expect(both.map((t) => t.item.id)).toEqual(['a', 'b']);
    expect(sinkCommands(stacked, both, -1, 1).cmds).toHaveLength(2);
    const row = planOf(wall('a', 0), wall('b', 2));
    expect(sinkTargets(row, sel('b'))).toEqual([]);
    expect(sinkTargets(row, sel('a', 'b'))).toHaveLength(2);
  });
});
