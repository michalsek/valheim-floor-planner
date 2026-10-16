import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { fillFace } from './fillFace';

const fill = (familyId: string, length: number, height: number) => {
  const { placed, unfilled } = fillFace(
    testLibrary.wallFamilies.get(familyId)!.pieces,
    length,
    height
  );
  const counts: Record<string, number> = {};
  for (const { piece } of placed) counts[piece.prefab] = (counts[piece.prefab] ?? 0) + 1;
  return { counts, area: unfilled.reduce((sum, r) => sum + r.length * r.height, 0) };
};

describe('fillFace', () => {
  it.each([
    ['wood', 10, 2, { woodwall: 5 }, 0],
    ['wood', 11, 2, { woodwall: 5, wood_wall_quarter: 2 }, 0],
    ['wood', 3.5, 2, { woodwall: 1, wood_wall_quarter: 2 }, 1],
    ['stone', 10, 2, { stone_wall_4x2: 2, stone_wall_2x1: 2 }, 0],
    ['timber', 2, 3, { stave_wall_2x2: 1 }, 2],
  ])('fills %s %f × %f', (familyId, length, height, counts, area) => {
    expect(fill(familyId, length, height)).toEqual({ counts, area });
  });
});
