import { describe, expect, it } from 'vitest';

import { signedArea } from './geometry/polyline';
import type { Vec2, WallRun } from './types';
import { clampVertexTarget, dragVertex } from './vertexDrag';

const pts = (...xz: [number, number][]): Vec2[] => xz.map(([x, z]) => ({ x, z }));

const run = (points: Vec2[], closed: boolean): WallRun => ({
  id: 'w',
  familyId: 'stone',
  points,
  closed,
  side: 'right',
  height: 2,
});

// Clockwise on screen (+z down).
const rect = run(pts([0, 0], [4, 0], [4, 4], [0, 4]), true);
const ell = run(pts([0, 0], [4, 0], [4, 4]), false);

describe('dragVertex', () => {
  it('moves both neighbours of a rectangle corner, keeping a rectangle', () => {
    expect(dragVertex(rect, 2, { x: 6, z: 5 })?.points).toEqual(
      pts([0, 0], [6, 0], [6, 5], [0, 5])
    );
  });

  it('keeps an L an L when its inner corner moves', () => {
    expect(dragVertex(ell, 1, { x: 5, z: 1 })?.points).toEqual(pts([0, 1], [5, 1], [5, 4]));
  });

  it('slides an open end along its segment', () => {
    expect(dragVertex(ell, 0, { x: -2, z: 3 })?.points).toEqual(pts([-2, 0], [4, 0], [4, 4]));
  });

  it('refuses a drag that collapses the run, and clamps it short of the collapse', () => {
    expect(dragVertex(rect, 2, { x: 0, z: 4 })).toBeNull();
    expect(dragVertex(run(pts([0, 0], [4, 0]), false), 1, { x: 0, z: 0 })).toBeNull();
    expect(clampVertexTarget(rect, 2, { x: 4, z: 4 }, { x: 0, z: 4 }, 0.5)).toEqual({
      x: 0.5,
      z: 4,
    });
  });

  it('merges a segment that shrinks to nothing', () => {
    const stepped = run(pts([0, 0], [2, 0], [2, 1], [4, 1], [4, 4], [0, 4]), true);
    expect(dragVertex(stepped, 2, { x: 2, z: 0 })?.points).toEqual(
      pts([0, 0], [4, 0], [4, 4], [0, 4])
    );
  });

  it('re-orients a loop dragged inside out, keeping its strip inside', () => {
    const result = dragVertex(rect, 2, { x: -2, z: 6 });
    expect(result?.side).toBe('right');
    expect(signedArea(result!.points)).toBeGreaterThan(0);
    expect(new Set(result!.points.map((p) => `${p.x},${p.z}`))).toEqual(
      new Set(['0,0', '-2,0', '-2,6', '0,6'])
    );
  });

  it('carries a spike along with its corner', () => {
    // A reversal: 0,0 → 4,0 → 2,0 → 2,3. Dragging 4,0 down moves the whole x-axis chain.
    const spike = run(pts([0, 0], [4, 0], [2, 0], [2, 3]), false);
    expect(dragVertex(spike, 1, { x: 4, z: 1 })?.points).toEqual(
      pts([0, 1], [4, 1], [2, 1], [2, 3])
    );
  });
});
