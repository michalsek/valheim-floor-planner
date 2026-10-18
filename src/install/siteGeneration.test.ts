import { describe, expect, it } from 'vitest';

import { decodeHeights } from '../model/terrain/siteTerrain';

import { siteTerrainFrom, terrainAvailability, worldMatchesFrame } from './siteGeneration';

const site = { seed: 12345, worldGenVersion: 2 };
const rect = (x0: number, z0: number) => ({ x0, z0, cols: 129, rows: 129 });

describe('terrainAvailability', () => {
  it('says why a site has no ground', () => {
    expect(terrainAvailability({ site: null }, rect(0, 0))).toMatchObject({
      reason: expect.stringContaining('.db'),
    });
    expect(
      terrainAvailability({ site: { ...site, worldGenVersion: 1 } }, rect(0, 0))
    ).toMatchObject({ reason: expect.stringContaining('v1') });
    // Far south is Ashlands and far north Deep North, whatever the seed.
    expect(terrainAvailability({ site }, rect(0, -9900))).toMatchObject({
      reason: 'Ashlands ground isn’t supported yet.',
    });
    expect(terrainAvailability({ site }, rect(0, 9800))).toMatchObject({
      reason: 'Deep North ground isn’t supported yet.',
    });
  });

  it('allows the middle of the world', () => {
    expect(terrainAvailability({ site }, rect(-64, -64))).toEqual({ ok: true });
  });
});

describe('siteTerrainFrom', () => {
  const world = {
    name: 'Test',
    site,
    terrainComps: [],
    pieces: {
      prefabs: [],
      prefabIndex: new Uint16Array(),
      position: new Float32Array([5, 0, 5]),
      rotation: new Float32Array(3),
    },
    // x, y, z: one inside, one 30 m off the patch, one 40 m off.
    locations: {
      position: new Float32Array([10, 0, 10, -30, 0, 50, 0, 0, 168]),
      hash: new Int32Array(3),
    },
    // x, z: one inside, one outside.
    legacyEdits: new Float32Array([1, 1, -5, 0]),
  };

  it('stores plan heights, the biomes and the notices', () => {
    const r = { x0: 0, z0: 0, cols: 2, rows: 64 };
    const heights = Float32Array.from({ length: 128 }, (_, i) => 30 + i / 100);
    const biomes = { zx0: 0, zz0: 0, cols: 2, rows: 2, codes: [1, 1, 1, 1] };
    const terrain = siteTerrainFrom(world, { origin: { x: 0, y: 30, z: 0 } }, r, {
      heights,
      biomes,
      check: { n: 3, maxError: 0.001 },
      unreadEdits: 1,
    });
    expect(decodeHeights(terrain.heights)?.[127]).toBeCloseTo(1.27, 5);
    expect(terrain.notices).toEqual({
      locations: [
        { x: 10, z: 10 },
        { x: -30, z: 50 },
      ],
      legacyEdits: 1,
      unreadEdits: 1,
      check: { n: 3, maxError: 0.001 },
    });
  });

  it('matches a plan to the world it came from', () => {
    const frame = { worldName: 'Test', origin: { x: 50, y: 0, z: 50 }, yaw: 0, terrain: null };
    expect(worldMatchesFrame(world, frame)).toBe(true);
    expect(worldMatchesFrame(world, { ...frame, origin: { x: 500, y: 0, z: 0 } })).toBe(false);
    expect(worldMatchesFrame(world, { ...frame, worldName: 'Other' })).toBe(false);
  });
});
