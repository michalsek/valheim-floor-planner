import { describe, expect, it } from 'vitest';

import { applyCommands, type PlanCommand } from './commands';
import { MAX_PROPS } from './props';
import { parsePlan, serializePlan } from './serialize';
import { emptyPlan, type Plan } from './types';

const plan: Plan = {
  version: 4,
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
      elevation: 2,
    },
  },
  dimensions: { d: { id: 'd', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, offset: -1.5, elevation: 0 } },
  floors: {
    f: { id: 'f', familyId: 'wood', min: { x: 0, z: 0 }, max: { x: 4, z: 2 }, elevation: 2 },
  },
  openings: { o: { id: 'o', wallId: 'a', prefab: 'wood_door', at: { x: 2, z: 0 } } },
  props: {
    p: {
      id: 'p',
      prefab: 'piece_workbench',
      position: { x: 1, z: 1 },
      rotation: 22.5,
      upgrades: 2,
      elevation: -0.5,
    },
  },
  roofs: {
    r: {
      id: 'r',
      elevation: 2,
      base: 2,
      outline: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 2 },
        { x: 0, z: 2 },
      ],
      familyId: 'thatch',
      pitch: 26,
      kind: 'gable',
      ridgeAxis: 'x',
      lowSide: '-z',
      overhang: { eave: 1, gable: 1 },
      gableWalls: 'wood',
    },
  },
  rawPieces: {
    w: {
      id: 'w',
      prefab: 'wood_roof_45',
      position: { x: 3.5, y: 2.25, z: -1 },
      rotation: { yaw: 337.5, pitch: 0, roll: 0 },
      elevation: 4,
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
  importFrame: { worldName: 'Fixture', origin: { x: 120.5, y: 31, z: -40 }, yaw: 22.5 },
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

  it('loads a version 2 file without roofs, and saves it as version 4', () => {
    const v2 = { ...JSON.parse(serializePlan(plan)), version: 2 };
    const loaded = parsePlan(v2);
    expect(loaded.version).toBe(4);
    expect(loaded.roofs).toEqual({});
    expect(loaded.rawPieces).toEqual({});
    expect(loaded.importFrame).toBeNull();
    expect(loaded.walls).toEqual(plan.walls);
  });

  it('loads a version 3 file with its roofs and without raw pieces', () => {
    const loaded = parsePlan({ ...JSON.parse(serializePlan(plan)), version: 3 });
    expect(loaded.roofs).toEqual(plan.roofs);
    expect(loaded.rawPieces).toEqual({});
  });

  it('loads a version 1 file with every elevation at 0, and saves it as version 4', () => {
    const v1 = JSON.parse(serializePlan(plan));
    v1.version = 1;
    for (const kind of ['walls', 'floors', 'props', 'dimensions']) {
      for (const item of Object.values(v1[kind]) as { elevation?: number }[]) {
        delete item.elevation;
      }
    }
    const loaded = parsePlan(v1);
    expect(loaded.version).toBe(4);
    expect(loaded.walls.a?.elevation).toBe(0);
    expect(loaded.floors.f?.elevation).toBe(0);
    expect(loaded.props.p?.elevation).toBe(0);
    expect(loaded.dimensions.d?.elevation).toBe(0);
  });

  it('defaults upgrades to 0, normalises rotation and keeps unknown prefabs', () => {
    const prop = { prefab: 'piece_from_the_future', position: { x: 0, z: 0 }, rotation: -90 };
    expect(parsePlan(withProp(prop)).props.p).toMatchObject({
      rotation: 270,
      upgrades: 0,
      elevation: 0,
    });
  });

  it.each([
    null,
    [],
    { version: 5, walls: {} },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, elevation: 200 } } },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, position: { x: 0, y: 300, z: 0 } } } },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, rotation: { yaw: 0 } } } },
    { version: 4, importFrame: { ...plan.importFrame, worldName: 7 } },
    { version: 3, roofs: { r: { ...plan.roofs.r, pitch: 30 } } },
    { version: 2, walls: { a: { ...plan.walls.a, elevation: 200 } } },
    { version: 2, props: { p: { ...plan.props.p, elevation: undefined } } },
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
    ['an elevation out of range', { type: 'wall.patch', id: 'a', changes: { elevation: -20 } }],
    [
      'a piece far off its level',
      { type: 'raw.patch', id: 'w', changes: { position: { x: 0, y: -300, z: 0 } } },
    ],
    [
      'a piece without a prefab',
      { type: 'raw.insert', piece: { ...plan.rawPieces.w!, id: 'v', prefab: '' } },
    ],
  ])('refuses %s', (_case, cmd) => {
    expect(() => applyCommands(plan, [cmd])).toThrow();
  });

  it('normalises a raw piece yaw as parsing does', () => {
    const w = plan.rawPieces.w!;
    const turned = applyCommands(plan, [
      { type: 'raw.patch', id: 'w', changes: { rotation: { ...w.rotation, yaw: -22.5 } } },
    ]);
    expect(turned.rawPieces.w?.rotation.yaw).toBe(337.5);
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
