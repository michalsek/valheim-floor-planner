import { describe, expect, it } from 'vitest';

import { parsePlan, serializePlan } from './serialize';
import type { Plan } from './types';

const plan: Plan = {
  version: 1,
  walls: {
    a: {
      id: 'a',
      familyId: 'wood',
      points: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
      ],
      closed: false,
      side: 'right',
      height: 2,
    },
  },
  dimensions: { d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, offset: -1.5 } },
};

describe('serialize', () => {
  it('round-trips a plan', () => {
    expect(parsePlan(JSON.parse(serializePlan(plan)))).toEqual(plan);
  });

  it('defaults a missing dimensions collection to {}', () => {
    expect(parsePlan({ version: 1, walls: {} }).dimensions).toEqual({});
  });

  it.each([
    null,
    [],
    { version: 2, walls: {} },
    { version: 1, walls: { a: { id: 'a' } } },
    { version: 1, dimensions: { d: { id: 'd', a: { x: 1, z: 1 }, b: { x: 1, z: 1 }, offset: 0 } } },
  ])('rejects %j', (raw) => {
    expect(() => parsePlan(raw)).toThrow();
  });
});
