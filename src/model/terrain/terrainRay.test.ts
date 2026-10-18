import { describe, expect, it } from 'vitest';

import { normalizeVec3 } from '../geometry/ray';

import type { TerrainGrid } from './siteTerrain';
import { rayTerrain } from './terrainRay';

// A slope rising 0.5 m per metre along world +x; plan z is world −z.
const grid: TerrainGrid = {
  x0: 0,
  z0: 0,
  cols: 21,
  rows: 21,
  heights: Float32Array.from({ length: 21 * 21 }, (_, i) => 0.5 * (i % 21)),
};
const frame = { origin: { x: 0, y: 0, z: 0 }, yaw: 0 };

describe('rayTerrain', () => {
  it('meets a slope within 1 mm', () => {
    const ray = { origin: { x: 0, y: 10, z: -10 }, dir: normalizeVec3({ x: 1, y: -1, z: 0 }) };
    const hit = rayTerrain(ray, grid, frame, 100);
    // y = 10 − s meets 0.5 s at s = 20 / 3.
    expect(Math.abs(hit!.point.x - 20 / 3)).toBeLessThan(0.001);
    expect(Math.abs(hit!.point.y - 10 / 3)).toBeLessThan(0.001);
  });

  it('misses from below, off the patch and beyond its reach', () => {
    const up = { origin: { x: 5, y: -5, z: -10 }, dir: { x: 0, y: 1, z: 0 } };
    const off = { origin: { x: 5, y: 20, z: 10 }, dir: { x: 0, y: -1, z: 0 } };
    const down = { origin: { x: 5, y: 20, z: -10 }, dir: { x: 0, y: -1, z: 0 } };
    expect(rayTerrain(up, grid, frame, 100)).toBeNull();
    expect(rayTerrain(off, grid, frame, 100)).toBeNull();
    expect(rayTerrain(down, grid, frame, 17)).toBeNull();
    expect(rayTerrain(down, grid, frame, 18)?.t).toBeCloseTo(17.5, 2);
  });
});
