import { describe, expect, it } from 'vitest';

import { contourSegments } from './contours';
import { hillshade, SEA_LEVEL } from './hillshade';
import type { TerrainGrid } from './siteTerrain';

const gridOf = (n: number, h: (x: number, z: number) => number): TerrainGrid => ({
  x0: -n,
  z0: -n,
  cols: 2 * n + 1,
  rows: 2 * n + 1,
  heights: Float32Array.from({ length: (2 * n + 1) ** 2 }, (_, k) =>
    h((k % (2 * n + 1)) - n, Math.floor(k / (2 * n + 1)) - n)
  ),
});

/** Segments as [x1, z1, x2, z2] tuples. */
const segmentsOf = (data: Float32Array) =>
  Array.from({ length: data.length / 4 }, (_, i) => [...data.subarray(4 * i, 4 * i + 4)]);

describe('contours', () => {
  it('traces a range of quads as its part of the whole', () => {
    const grid = gridOf(6, (x, z) => 0.4 * x + 0.25 * z * z);
    const whole = segmentsOf(contourSegments(grid, 0.5)).map(String).sort();
    const left = { i0: 0, i1: 5, j0: 0, j1: 12 };
    const right = { i0: 5, i1: 12, j0: 0, j1: 12 };
    const parts = [left, right]
      .flatMap((range) => segmentsOf(contourSegments(grid, 0.5, null, range)))
      .map(String)
      .sort();
    expect(parts).toEqual(whole);
  });

  it('draws a plane as straight lines at the right offsets, each once', () => {
    // 0.3 m per metre along x: the 1 m lines at x = 10/3 · k.
    const segments = segmentsOf(
      contourSegments(
        gridOf(5, (x) => 0.3 * x),
        1
      )
    );
    const xs = new Set(segments.flatMap(([x1, , x2]) => [x1!.toFixed(4), x2!.toFixed(4)]));
    expect([...xs].map(Number).sort((a, b) => a - b)).toEqual(
      [-1, 0, 1].map((k) => +((10 / 3) * k).toFixed(4))
    );
    expect(segments.every(([x1, , x2]) => Math.abs(x1! - x2!) < 1e-4)).toBe(true);
    // Each line spans the patch's 10 m once (not twice along a shared edge).
    const length = segments.reduce(
      (sum, [x1, z1, x2, z2]) => sum + Math.hypot(x2! - x1!, z2! - z1!),
      0
    );
    expect(length).toBeCloseTo(30, 4);
  });

  it('leaves out the levels a coarser set draws', () => {
    const grid = gridOf(5, (x) => 0.3 * x);
    const half = segmentsOf(contourSegments(grid, 0.5, 1));
    expect(half.every(([x1]) => Math.abs((0.3 * x1!) % 1) > 0.4)).toBe(true);
  });

  it('draws a cone as closed rings', () => {
    // Off by 0.3 m, so no level passes through a vertex and every ring fits the patch.
    const cone = gridOf(8, (x, z) => -0.5 * Math.hypot(x, z) - 0.3);
    const data = contourSegments(cone, 2);
    // Every end point is shared by exactly two segments: the rings close.
    const ends = new Map<string, number>();
    for (let i = 0; i < data.length; i += 2) {
      const key = `${data[i]!.toFixed(3)},${data[i + 1]!.toFixed(3)}`;
      ends.set(key, (ends.get(key) ?? 0) + 1);
    }
    expect([...ends.values()].every((n) => n === 2)).toBe(true);
    const radii = new Set(segmentsOf(data).map(([x, z]) => Math.round(Math.hypot(x!, z!) / 2) * 2));
    expect([...radii].sort((a, b) => a - b)).toEqual([4, 8]);
  });
});

describe('hillshade', () => {
  it('lights slopes facing the upper left, and marks water', () => {
    const frame = { origin: { x: 0, y: SEA_LEVEL - 1, z: 0 }, yaw: 0 };
    // Rising towards world +x (plan right): it faces the light on the left.
    const flat = hillshade(
      gridOf(2, () => 2),
      frame
    );
    expect(
      hillshade(
        gridOf(2, (x) => x),
        frame
      )[2 * 12]
    ).toBeGreaterThan(flat[2 * 12]!);
    expect(
      hillshade(
        gridOf(2, (x) => -x),
        frame
      )[2 * 12]
    ).toBeLessThan(flat[2 * 12]!);
    // Plan up is world +z (the mirror): ground rising towards plan down faces it too.
    expect(
      hillshade(
        gridOf(2, (_, z) => -z),
        frame
      )[2 * 12]
    ).toBeGreaterThan(flat[2 * 12]!);
    // Plan heights below 1 m are below the sea here.
    expect(
      hillshade(
        gridOf(2, () => 0.5),
        frame
      )[2 * 12 + 1]
    ).toBe(255);
    expect(flat[2 * 12 + 1]).toBe(0);
  });
});
