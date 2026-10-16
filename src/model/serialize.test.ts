import { describe, expect, it } from 'vitest';

import { parsePlan, serializePlan } from './serialize';
import { emptyPlan, type Plan } from './types';

const plan: Plan = {
  version: 1,
  name: 'Longhouse',
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
  floors: { f: { id: 'f', familyId: 'wood', min: { x: 0, z: 0 }, max: { x: 4, z: 2 } } },
  openings: { o: { id: 'o', wallId: 'a', prefab: 'wood_door', at: { x: 2, z: 0 } } },
};

describe('serialize', () => {
  it('round-trips a plan', () => {
    expect(parsePlan(JSON.parse(serializePlan(plan)))).toEqual(plan);
  });

  it('loads an M2-era file: name "Untitled", dimensions, floors and openings {}', () => {
    expect(parsePlan({ version: 1, walls: {} })).toEqual(emptyPlan());
    expect(parsePlan({ version: 1, name: '  ', walls: {} }).name).toBe('Untitled');
  });

  it.each([
    null,
    [],
    { version: 2, walls: {} },
    { version: 1, walls: { a: { id: 'a' } } },
    { version: 1, dimensions: { d: { id: 'd', a: { x: 1, z: 1 }, b: { x: 1, z: 1 }, offset: 0 } } },
    {
      version: 1,
      floors: { f: { id: 'f', familyId: 'wood', min: { x: 1, z: 0 }, max: { x: 1, z: 2 } } },
    },
    {
      version: 1,
      floors: { f: { id: 'f', familyId: 'wood', min: { x: 0, z: 0 }, max: { x: 600, z: 2 } } },
    },
    {
      version: 1,
      openings: { o: { id: 'o', wallId: 'gone', prefab: 'wood_door', at: { x: 0, z: 0 } } },
    },
  ])('rejects %j', (raw) => {
    expect(() => parsePlan(raw)).toThrow();
  });
});
