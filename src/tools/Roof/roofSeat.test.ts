import { describe, expect, it } from 'vitest';

import type { WallRun } from '../../model/types';

import { roofSeat } from './roofSeat';

/** A closed 4 × 4 m room at `elevation`. */
const room = (id: string, elevation: number, height = 2): WallRun => ({
  id,
  familyId: 'wood',
  points: [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 4 },
    { x: 0, z: 4 },
  ],
  closed: true,
  side: 'right',
  height,
  elevation,
});

const outline = room('o', 0).points;

describe('roofSeat', () => {
  it('rests on the walls of its own level', () => {
    expect(roofSeat([room('a', 0), room('b', 2, 3)], outline, 2)).toEqual({
      elevation: 2,
      base: 3,
    });
  });

  it('seats a roof drawn at the wall tops of the storey below on those walls', () => {
    expect(roofSeat([room('a', 0), room('b', 2)], outline, 4)).toEqual({ elevation: 2, base: 2 });
  });

  it("keeps the level and the 2 m default when lower walls don't reach it", () => {
    expect(roofSeat([room('a', 0)], outline, 4)).toEqual({ elevation: 4, base: 2 });
  });
});
