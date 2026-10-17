import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { splitFloor } from './splitFloor';

const split = (familyId: string, w: number, d: number) => {
  const { pieces, leftover } = splitFloor(
    { id: 'f', min: { x: 0, z: 0 }, max: { x: w, z: d } },
    testLibrary.floorFamilies.get(familyId)!
  );
  const counts: Record<string, number> = {};
  for (const { prefab } of pieces) counts[prefab] = (counts[prefab] ?? 0) + 1;
  return { counts, leftover };
};

describe('splitFloor', () => {
  it.each([
    ['wood', 4, 4, { wood_floor: 4 }, 0],
    ['grausten', 6, 6, { Piece_grausten_floor_4x4: 1, Piece_grausten_floor_2x2: 5 }, 0],
    ['stone', 3, 4, { stone_floor_2x2: 2 }, 4],
    ['wood', 0.5, 0.5, {}, 0.25],
  ])('tiles %s %f × %f', (familyId, w, d, counts, leftover) => {
    expect(split(familyId, w, d)).toEqual({ counts, leftover });
  });
});
