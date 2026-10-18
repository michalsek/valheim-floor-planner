import { describe, expect, it } from 'vitest';

import { parseCatalog } from './pieceDefs';
import { readGameData } from './testGameData';
import { deriveWallFamilies, WALL_FAMILY_SPECS } from './wallFamilies';

const families = deriveWallFamilies(
  parseCatalog(readGameData('valheim-pieces.json')),
  WALL_FAMILY_SPECS
);
const family = (id: string) => families.find((f) => f.id === id);

describe('deriveWallFamilies', () => {
  it('derives the wood panel family', () => {
    const wood = family('wood');
    expect(wood?.snapKind).toBe('centerline');
    expect(wood?.thickness).toBe(0.3);
    expect(wood?.pieces.map((p) => p.length)).toEqual([2, 2, 1]);
    expect(wood?.pieces.map((p) => p.height)).toEqual([2, 1, 1]);
    expect(wood?.openings.map((o) => o.width)).toEqual([2, 2]);
  });

  it.each([
    ['stone', 'face', 1, [4, 2, 1]],
    ['grausten', 'centerline', 0.4, [4, 2, 1]],
    // Timber's collider is 2.015 long; lengths come from snap extents.
    ['timber', 'centerline', 0.67, [2]],
  ])('derives %s: %s, %f m thick', (id, snapKind, thickness, lengths) => {
    const f = family(id);
    expect(f).toMatchObject({ snapKind, thickness });
    expect(f?.pieces.map((p) => p.length)).toEqual(lengths);
  });
});
