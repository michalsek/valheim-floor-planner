import { describe, expect, it } from 'vitest';

import type { SiteTerrain } from '../types';

import {
  decodeHeights,
  encodeHeights,
  groundAt,
  groundAtWorld,
  groundRange,
  groundUnder,
  groundUnderOrEdge,
  heightsFromBase64,
  planToWorld,
  terrainGrid,
  worldToPlan,
  type TerrainGrid,
} from './siteTerrain';

/** A grid from a height function of world (x, z). */
const gridOf = (
  x0: number,
  z0: number,
  cols: number,
  rows: number,
  h: (x: number, z: number) => number
): TerrainGrid => ({
  x0,
  z0,
  cols,
  rows,
  heights: Float32Array.from({ length: cols * rows }, (_, i) =>
    h(x0 + (i % cols), z0 + Math.floor(i / cols))
  ),
});

const flat = { origin: { x: 0, y: 30, z: 0 }, yaw: 0 };

describe('site terrain', () => {
  it('keeps heights as int16 centimetres, clamping the out-of-range', () => {
    const { heights, clamped } = encodeHeights([0, 1.234, -2.5, 327.67, 400]);
    expect(clamped).toBe(1);
    expect([...decodeHeights(heights)].map((v) => +v.toFixed(2))).toEqual([
      0, 1.23, -2.5, 327.67, 327.67,
    ]);
    expect([...heightsFromBase64(Buffer.from(heights.buffer).toString('base64'))!]).toEqual([
      ...heights,
    ]);
    expect(heightsFromBase64('*')).toBeNull();
    // Undo clones the terrain object but keeps its array: the grid is shared.
    const terrain = { x0: 0, z0: 0, cols: 5, rows: 1, heights } as SiteTerrain;
    expect(terrainGrid({ ...terrain })).toBe(terrainGrid(terrain));
  });

  it('maps plan to world and back at 22.5°, mirroring z', () => {
    const frame = { origin: { x: 120.5, y: 31, z: -40 }, yaw: 22.5 };
    const p = { x: 3.25, z: -7.5 };
    const w = planToWorld(frame, p);
    expect(worldToPlan(frame, w).x).toBeCloseTo(p.x, 9);
    expect(worldToPlan(frame, w).z).toBeCloseTo(p.z, 9);
    // At yaw 0, plan +z (screen down, south) is world −z.
    expect(planToWorld({ ...frame, yaw: 0 }, { x: 1, z: 2 })).toEqual({ x: 121.5, z: -42 });
  });

  it('reads the collider: each quad split along its (x+1, z)–(x, z+1) diagonal', () => {
    // One quad with only the far corner (1, 1) raised: the near triangle stays flat.
    const grid = gridOf(0, 0, 2, 2, (x, z) => (x === 1 && z === 1 ? 2 : 0));
    expect(groundAtWorld(grid, 0.4, 0.4)).toBe(0);
    expect(groundAtWorld(grid, 0.5, 0.5)).toBe(0);
    expect(groundAtWorld(grid, 0.75, 0.75)).toBeCloseTo(1, 9);
    expect(groundAtWorld(grid, 1, 1)).toBe(2);
    expect(groundAtWorld(grid, 1.01, 0)).toBeNull();
    // Through the frame: plan (0.75, −0.75) is world (0.75, 0.75).
    expect(groundAt(grid, flat, { x: 0.75, z: -0.75 })).toBeCloseTo(1, 9);
  });

  it('takes the highest ground under a footprint, an interior peak included', () => {
    const grid = gridOf(-5, -5, 11, 11, (x, z) => (x === 0 && z === 0 ? 3 : 0.1 * x));
    const square = (r: number) => [
      { x: -r, z: -r },
      { x: r, z: -r },
      { x: r, z: r },
      { x: -r, z: r },
    ];
    expect(groundUnder(grid, flat, square(1.5))).toBe(3);
    // A box between vertices: the slope's high edge (x = 0.4 → 0.04).
    expect(
      groundUnder(
        grid,
        flat,
        square(0.4).map((p) => ({ x: p.x + 2, z: p.z }))
      )
    ).toBeCloseTo(0.24, 6);
    expect(
      groundUnder(
        grid,
        flat,
        square(1).map((p) => ({ x: p.x + 50, z: p.z }))
      )
    ).toBeNull();
    // Off the patch, support carries the nearest edge on (x = 5 → 0.5).
    const far = square(1).map((p) => ({ x: p.x + 50, z: p.z }));
    expect(groundUnderOrEdge(grid, flat, far)).toBeCloseTo(0.5, 6);
    expect(groundRange(grid, flat, { min: { x: -2, z: -2 }, max: { x: 2, z: 2 } })).toEqual({
      min: expect.closeTo(-0.2, 6),
      max: 3,
    });
  });
});
