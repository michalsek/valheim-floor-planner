import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import type { Vec2, WallRun } from './types';
import { buildWallGraph } from './wallGraph';

const pts = (...xz: [number, number][]): Vec2[] => xz.map(([x, z]) => ({ x, z }));

let nextId = 0;
const run = (points: Vec2[], closed = false): WallRun => ({
  id: `w${nextId++}`,
  familyId: 'wood',
  points,
  closed,
  side: 'right',
  height: 2,
});

const graphOf = (...runs: WallRun[]) =>
  buildWallGraph(Object.fromEntries(runs.map((r) => [r.id, r])), testLibrary.wallFamilies);

describe('buildWallGraph', () => {
  it('splits a through-wall at a T-junction and at a crossing', () => {
    const through = run(pts([0, 0], [8, 0]));
    expect(graphOf(through, run(pts([4, 0], [4, 3]))).edges).toHaveLength(3);
    const crossing = graphOf(through, run(pts([4, -3], [4, 3])));
    expect(crossing.edges).toHaveLength(4);
    expect(crossing.edges.filter((e) => [e.a, e.b].includes('4,0'))).toHaveLength(4);
  });

  it('merges collinear overlaps into edges with two owners', () => {
    const g = graphOf(run(pts([0, 0], [6, 0])), run(pts([4, 0], [10, 0])));
    expect(g.edges.map((e) => e.owners.length).sort()).toEqual([1, 1, 2]);
  });

  it('joins walls whose coordinates differ by less than EPS', () => {
    const g = graphOf(
      run(pts([0, 0], [8, 0], [8, 8.0000004], [0, 8.0000004]), true),
      run(pts([0, 8.0000006], [8, 8.0000006], [8, 16], [0, 16]), true)
    );
    expect([g.vertices.size, g.edges.length]).toEqual([6, 7]);
  });

  it('skips diagonal segments with a warning', () => {
    expect(graphOf(run(pts([0, 0], [3, 4]))).skipped).toHaveLength(1);
  });
});
