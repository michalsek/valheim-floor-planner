import { describe, expect, it } from 'vitest';

import { applyCommands, type PlanCommand } from './commands';
import { MAX_PROPS } from './props';
import { planFileText, readPlanJson } from './planFile';
import { parsePlan } from './serialize';
import { encodeHeights } from './terrain/siteTerrain';
import { emptyPlan, type Plan, type SiteTerrain } from './types';

/** A 3 × 2 vertex patch with one location notice. */
const terrain: SiteTerrain = {
  x0: 100,
  z0: -50,
  cols: 3,
  rows: 2,
  heights: encodeHeights([0, 0.5, 1, -0.25, 0, 2.5]).heights,
  biomes: { zx0: 2, zz0: -1, cols: 2, rows: 2, codes: [1, 1, 1, 8] },
  worldGenVersion: 2,
  revision: 1,
  notices: {
    locations: [{ x: 120, z: -40 }],
    legacyEdits: 0,
    unreadEdits: 1,
    check: { n: 4, maxError: 0.001 },
  },
};

const plan: Plan = {
  version: 6,
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
  importFrame: {
    worldName: 'Fixture',
    origin: { x: 120.5, y: 31, z: -40 },
    yaw: 22.5,
    terrain,
  },
};

const withProp = (prop: Record<string, unknown>) => ({
  version: 1,
  props: { p: { id: 'p', ...prop } },
});

/**
 * The plan as the autosave stores it (a structured clone), untyped as parsed JSON is, to
 * edit into older shapes.
 */
const stored = (): ReturnType<typeof JSON.parse> => structuredClone(plan);

describe('serialize', () => {
  it('round-trips a plan through a file, its heights packed', async () => {
    const text = await planFileText(plan);
    expect(JSON.parse(text).importFrame.terrain.heights.packing).toBe('plane/deflate');
    expect(await readPlanJson(JSON.parse(text))).toEqual(plan);
    expect(parsePlan(stored())).toEqual(plan);
  });

  it('reads a version 5 file’s base64 heights', async () => {
    const v5 = stored();
    v5.version = 5;
    v5.importFrame.terrain.heights = Buffer.from(terrain.heights.buffer).toString('base64');
    expect(await readPlanJson(JSON.parse(JSON.stringify(v5)))).toEqual(plan);
  });

  it('refuses packed heights that don’t fill the patch', async () => {
    const file = JSON.parse(await planFileText(plan));
    file.importFrame.terrain.rows = 3;
    await expect(readPlanJson(file)).rejects.toThrow(/packed heights of 3 × 3/);
  });

  it('loads an M2-era file: name "Untitled", empty collections and no underlay', () => {
    expect(parsePlan({ version: 1, walls: {} })).toEqual(emptyPlan());
    expect(parsePlan({ version: 1, name: '  ', walls: {} }).name).toBe('Untitled');
  });

  it('loads a version 4 import frame without terrain', () => {
    const loaded = parsePlan({ ...stored(), version: 4 });
    expect(loaded.version).toBe(6);
    expect(loaded.importFrame).toEqual({ ...plan.importFrame, terrain: null });
    expect(loaded.rawPieces).toEqual(plan.rawPieces);
  });

  it('reads terrain saved before the unread-edits notice as none unread', () => {
    const saved = stored();
    delete saved.importFrame.terrain.notices.unreadEdits;
    expect(parsePlan(saved).importFrame?.terrain?.notices.unreadEdits).toBe(0);
  });

  it('loads a version 2 file without roofs, and saves it as version 6', () => {
    const v2 = { ...stored(), version: 2 };
    const loaded = parsePlan(v2);
    expect(loaded.version).toBe(6);
    expect(loaded.roofs).toEqual({});
    expect(loaded.rawPieces).toEqual({});
    expect(loaded.importFrame).toBeNull();
    expect(loaded.walls).toEqual(plan.walls);
  });

  it('loads a version 3 file with its roofs and without raw pieces', () => {
    const loaded = parsePlan({ ...stored(), version: 3 });
    expect(loaded.roofs).toEqual(plan.roofs);
    expect(loaded.rawPieces).toEqual({});
  });

  it('loads a version 1 file with every elevation at 0, and saves it as version 6', () => {
    const v1 = stored();
    v1.version = 1;
    for (const kind of ['walls', 'floors', 'props', 'dimensions']) {
      for (const item of Object.values(v1[kind]) as { elevation?: number }[]) {
        delete item.elevation;
      }
    }
    const loaded = parsePlan(v1);
    expect(loaded.version).toBe(6);
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
    { version: 7, walls: {} },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, elevation: 200 } } },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, position: { x: 0, y: 300, z: 0 } } } },
    { version: 4, rawPieces: { w: { ...plan.rawPieces.w, rotation: { yaw: 0 } } } },
    { version: 4, importFrame: { ...plan.importFrame, worldName: 7 } },
    { version: 6, importFrame: { ...plan.importFrame, terrain: { ...terrain, cols: 4 } } },
    { version: 6, importFrame: { ...plan.importFrame, terrain: { ...terrain, x0: 0.5 } } },
    { version: 6, importFrame: { ...plan.importFrame, terrain: { ...terrain, heights: 7 } } },
    {
      version: 6,
      importFrame: {
        ...plan.importFrame,
        terrain: { ...terrain, biomes: { ...terrain.biomes, codes: [1] } },
      },
    },
    // A 1 × 1 corner grid, and a grid that stops short of the patch.
    {
      version: 6,
      importFrame: {
        ...plan.importFrame,
        terrain: { ...terrain, biomes: { zx0: 2, zz0: -1, cols: 1, rows: 1, codes: [1] } },
      },
    },
    {
      version: 6,
      importFrame: {
        ...plan.importFrame,
        terrain: { ...terrain, biomes: { ...terrain.biomes, zx0: 3 } },
      },
    },
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

  it('sets and removes terrain only on an imported build', () => {
    const bare = { ...plan, importFrame: { ...plan.importFrame!, terrain: null } };
    const set = applyCommands(bare, [{ type: 'site.setTerrain', terrain }]);
    expect(set.importFrame?.terrain).toBe(terrain);
    expect(applyCommands(set, [{ type: 'site.setTerrain', terrain: null }])).toEqual(bare);
    expect(() => applyCommands(emptyPlan(), [{ type: 'site.setTerrain', terrain }])).toThrow();
    const bad = { ...terrain, heights: terrain.heights.slice(4) };
    expect(() => applyCommands(bare, [{ type: 'site.setTerrain', terrain: bad }])).toThrow();
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
    expect(() => parsePlan(full)).not.toThrow();
    const insert: PlanCommand = { type: 'prop.insert', prop: { ...bench, id: 'extra' } };
    expect(() => applyCommands(full, [insert])).toThrow();
  });
});
