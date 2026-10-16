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
};

describe('serialize', () => {
  it('round-trips a plan', () => {
    expect(parsePlan(JSON.parse(serializePlan(plan)))).toEqual(plan);
  });

  it.each([null, [], { version: 2, walls: {} }, { version: 1, walls: { a: { id: 'a' } } }])(
    'rejects %j',
    (raw) => {
      expect(() => parsePlan(raw)).toThrow();
    }
  );
});
