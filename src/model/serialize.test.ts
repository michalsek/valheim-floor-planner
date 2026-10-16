import { describe, expect, it } from 'vitest';

import { applyCommands, type PlanCommand } from './commands';
import { MAX_PROPS } from './props';
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
  props: {
    p: {
      id: 'p',
      prefab: 'piece_workbench',
      position: { x: 1, z: 1 },
      rotation: 22.5,
      upgrades: 2,
    },
  },
  underlay: {
    imageId: 'img',
    name: 'plan.png',
    pixelSize: { w: 800, h: 600 },
    origin: { x: -4, z: -3 },
    metresPerPixel: 0.05,
    opacity: 0.4,
    locked: true,
  },
};

const withProp = (prop: Record<string, unknown>) => ({
  version: 1,
  props: { p: { id: 'p', ...prop } },
});

describe('serialize', () => {
  it('round-trips a plan', () => {
    expect(parsePlan(JSON.parse(serializePlan(plan)))).toEqual(plan);
  });

  it('loads an M2-era file: name "Untitled", empty collections and no underlay', () => {
    expect(parsePlan({ version: 1, walls: {} })).toEqual(emptyPlan());
    expect(parsePlan({ version: 1, name: '  ', walls: {} }).name).toBe('Untitled');
  });

  it('defaults upgrades to 0, normalises rotation and keeps unknown prefabs', () => {
    const prop = { prefab: 'piece_from_the_future', position: { x: 0, z: 0 }, rotation: -90 };
    expect(parsePlan(withProp(prop)).props.p).toMatchObject({ rotation: 270, upgrades: 0 });
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
    withProp({ prefab: '', position: { x: 0, z: 0 }, rotation: 0 }),
    withProp({ prefab: 'bed', position: { x: 0, z: 0 }, rotation: 0, upgrades: 1.5 }),
    { version: 1, underlay: { ...plan.underlay, metresPerPixel: 0 } },
    { version: 1, underlay: { ...plan.underlay, opacity: 2 } },
  ])('rejects %j', (raw) => {
    expect(() => parsePlan(raw)).toThrow();
  });
});

describe('commands accept only what loads', () => {
  const underlay = plan.underlay!;
  const bench = plan.props.p!;

  it.each<[string, PlanCommand]>([
    [
      'a scale above 10 m/px',
      { type: 'underlay.set', underlay: { ...underlay, metresPerPixel: 20 } },
    ],
    ['opacity above 1', { type: 'underlay.patch', changes: { opacity: 1.5 } }],
    ['upgrades above the cap', { type: 'prop.patch', id: 'p', changes: { upgrades: 21 } }],
    ['an empty prefab', { type: 'prop.insert', prop: { ...bench, id: 'q', prefab: '' } }],
  ])('refuses %s', (_case, cmd) => {
    expect(() => applyCommands(plan, [cmd])).toThrow();
  });

  it('refuses an item past the cap', () => {
    const props = Object.fromEntries(
      Array.from({ length: MAX_PROPS }, (_, i) => [`p${i}`, { ...bench, id: `p${i}` }])
    );
    const full = { ...plan, props };
    expect(() => parsePlan(JSON.parse(serializePlan(full)))).not.toThrow();
    const insert: PlanCommand = { type: 'prop.insert', prop: { ...bench, id: 'extra' } };
    expect(() => applyCommands(full, [insert])).toThrow();
  });
});
