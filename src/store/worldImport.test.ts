import { createStore } from 'jotai';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';
import { siteRect, type TerrainSource } from '../install/siteGeneration';
import { planFileText, readPlanJson } from '../model/planFile';
import { growSiteTerrain, type SiteGrowth } from '../model/terrain/siteExtend';
import type { PatchRect } from '../model/terrain/sitePatch';
import { planToWorld } from '../model/terrain/siteTerrain';
import { emptyPlan, type Plan, type SiteTerrain } from '../model/types';
import { describeCluster } from '../model/world/clusters';

import { setLibrary } from './libraryInstance';
import { createPlanStore } from './planStore';
import { cutHeightAtom, lastCutAtom } from './session';
import { extendTerrain, importBuild, prepareBuild, type ExtendResult } from './worldImport';

/** Flat ground over `rect` with biomes over its zones: what the worker would give. */
const flat = (rect: PatchRect) => {
  const zone = (v: number) => Math.floor((v + 32) / 64);
  const zx0 = zone(rect.x0);
  const zz0 = zone(rect.z0);
  const cols = zone(rect.x0 + rect.cols - 1) - zx0 + 2;
  const rows = zone(rect.z0 + rect.rows - 1) - zz0 + 2;
  return {
    heights: new Int16Array(rect.cols * rect.rows),
    biomes: { zx0, zz0, cols, rows, codes: new Array<number>(cols * rows).fill(1) },
  };
};

vi.mock('../install/siteGeneration', async (original) => ({
  ...(await original<typeof import('../install/siteGeneration')>()),
  terrainAvailability: () => ({ ok: true }),
  growSiteGround: async (_w: unknown, _f: unknown, terrain: SiteTerrain, growth: SiteGrowth) => ({
    terrain: growSiteTerrain(terrain, growth, flat(growth.strip), terrain.notices),
  }),
}));

type Spec = [prefab: string, x: number, y: number, z: number];

/** A 4 × 2 m hut: two floor tiles and a wall on them, at `(x, z)`. */
const hut = (x: number, z: number, y = 30): Spec[] => [
  ['wood_floor', x + 1, y, z + 1],
  ['wood_floor', x + 3, y, z + 1],
  ['woodwall', x + 1, y + 1, z],
];

/**
 * The main hut, a hut 50 m north (on its first patch), a shed 150 m east (off it) and a
 * hut far west.
 */
const specs: Spec[] = [...hut(0, 0), ...hut(0, 50), ...hut(150, 4, 32), ...hut(-600, 0)];
const world: TerrainSource = {
  name: 'Fixture',
  site: { seed: 1, worldGenVersion: 2 },
  terrainComps: [],
  locations: null,
  legacyEdits: new Float32Array(),
  pieces: {
    prefabs: ['wood_floor', 'woodwall'],
    prefabIndex: Uint16Array.from(specs.map((s) => (s[0] === 'woodwall' ? 1 : 0))),
    position: Float32Array.from(specs.flatMap(([, x, y, z]) => [x, y, z])),
    rotation: new Float32Array(specs.length * 3),
  },
};

const NOTICES = { locations: [], legacyEdits: 0, unreadEdits: 0, check: { n: 0, maxError: 0 } };

const mainHut = () => describeCluster(world.pieces, [0, 1, 2], () => null);

/** The main hut imported with flat ground over its patch (and the hut beside it). */
const imported = (): Plan => {
  const build = prepareBuild(world, mainHut(), true);
  if ('error' in build) throw new Error(build.error);
  const rect = siteRect(build.plan, testLibrary)!;
  const terrain: SiteTerrain = {
    ...rect,
    ...flat(rect),
    worldGenVersion: 2,
    revision: 1,
    notices: NOTICES,
  };
  return { ...build.plan, importFrame: { ...build.plan.importFrame!, terrain } };
};

const extend = (plan: ReturnType<typeof createPlanStore>, reveal = true): Promise<ExtendResult> =>
  extendTerrain({ ...createStore(), plan }, world, 'east', 192, {
    onPhase: () => {},
    signal: new AbortController().signal,
    reveal,
  });

const pieceCount = (plan: ReturnType<typeof createPlanStore>) =>
  Object.keys(plan.getPlan().rawPieces).length;

describe('sites the terrain reveals', () => {
  beforeAll(() => setLibrary(testLibrary));

  it('come in with an import, from its starting patch, unless left out', () => {
    const plan = imported();
    expect(Object.keys(plan.rawPieces)).toHaveLength(6);
    expect(plan.importFrame!.worldPieces).toHaveLength(6);
    const alone = prepareBuild(world, mainHut(), false);
    expect('error' in alone ? alone : Object.keys(alone.plan.rawPieces)).toHaveLength(3);
  });

  it('come in with the extension, in the plan’s frame, as one undo step', async () => {
    const plan = createPlanStore(imported());
    expect(pieceCount(plan)).toBe(6);
    expect(await extend(plan)).toEqual({ sites: [3], refused: [] });
    expect(plan.peekUndoLabel()).toBe('Extend terrain east, 1 site');
    const frame = plan.getPlan().importFrame!;
    expect(frame.worldPieces).toHaveLength(9);
    // A revealed piece maps back onto its world point, at its world height.
    const floor = Object.values(plan.getPlan().rawPieces).find(
      (p) => p.prefab === 'wood_floor' && planToWorld(frame, p.position).x > 100
    )!;
    expect(planToWorld(frame, floor.position).x).toBeCloseTo(151);
    expect(floor.position.y + frame.origin.y).toBeCloseTo(32);
    plan.undo();
    expect(pieceCount(plan)).toBe(6);
    expect(plan.getPlan().importFrame!.worldPieces).toHaveLength(6);
    plan.redo();
    expect(pieceCount(plan)).toBe(9);
  });

  it('never come in twice: after an undo and redo, a reopen, or deleting their pieces', async () => {
    const plan = createPlanStore(imported());
    await extend(plan);
    plan.undo();
    plan.redo();
    expect(await extend(plan)).toEqual({ sites: [], refused: [] });
    const reopened = createPlanStore(
      await readPlanJson(JSON.parse(await planFileText(plan.getPlan())))
    );
    const id = Object.keys(reopened.getPlan().rawPieces).find((k) => k.startsWith('w'))!;
    reopened.dispatch({ type: 'raw.remove', id });
    expect(await extend(reopened)).toEqual({ sites: [], refused: [] });
    expect(pieceCount(reopened)).toBe(8);
  });

  it('stay out with the option off, and an older plan’s own site isn’t brought again', async () => {
    const plan = createPlanStore(imported());
    expect(await extend(plan, false)).toEqual({ sites: [], refused: [] });
    expect(pieceCount(plan)).toBe(6);
    const { worldPieces: _, ...frame } = imported().importFrame!;
    const older = createPlanStore({ ...imported(), importFrame: frame });
    expect(await extend(older)).toEqual({ sites: [3], refused: [] });
    expect(pieceCount(older)).toBe(9);
  });
});

describe('importing a build', () => {
  beforeAll(() => setLibrary(testLibrary));

  it('shows it whole: the cut goes back to All', async () => {
    const ctx = { ...createStore(), plan: createPlanStore(emptyPlan()) };
    ctx.set(cutHeightAtom, 3);
    ctx.set(lastCutAtom, 3);
    const build = prepareBuild(world, mainHut());
    if ('error' in build) throw new Error(build.error);
    expect(await importBuild(ctx, world, build, null)).toBe('done');
    expect(ctx.get(cutHeightAtom)).toBeNull();
    expect(ctx.get(lastCutAtom)).toBeNull();
    expect(Object.keys(ctx.plan.getPlan().rawPieces)).toHaveLength(3);
  });
});
