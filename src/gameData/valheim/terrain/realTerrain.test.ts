/**
 * Terrain against a real 1.0 world save. Runs only with `VALHEIM_WORLD_TEST=<world
 * folder>` (`pnpm test:world`). The expected numbers are aggregates of the user's world
 * (M16 §8.7; the hashes from the Python reference, `worldGen.py`). Only counts, errors
 * and timings are printed: never the seed, names or coordinates.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { testLibrary } from '../../../catalog/testLibrary';
import { runTerrainJob } from '../../../install/terrainJob';
import {
  siteRect,
  siteTerrainFrom,
  terrainAvailability,
  terrainJobFor,
} from '../../../install/siteGeneration';
import { derivePlan } from '../../../model/derivePlan';
import { pieceBoxes } from '../../../model/pieceBoxes';
import { planFileText, readPlanJson } from '../../../model/planFile';
import { ghostSupport } from '../../../model/support/ghostSupport';
import {
  modelSupport,
  planSupport,
  supportModel,
  type PlanSupport,
} from '../../../model/support/planSupport';
import { boxShape } from '../../../model/support/shape';
import { snapJoints } from '../../../model/support/snapJoints';
import {
  groundAt,
  groundAtWorld,
  groundUnder,
  terrainGrid,
} from '../../../model/terrain/siteTerrain';
import type { Plan } from '../../../model/types';
import { describeCluster, groupPieces } from '../../../model/world/clusters';
import { importCluster } from '../../../model/world/importCluster';
import { readChunkedWorld, type WorldScan } from '../world/readWorld';
import { folderFiles } from '../world/testWorld';
import { scanPrefabs } from '../world/worldPrefabs';

import { ZONE_VERTICES, zoneHeights, zoneOf, zoneOrigin } from './heightmap';
import { lakesHash, riversHash } from './pregenCodec';
import { pregenerate } from './pregenerate';
import { readVegetation } from './testTerrain';
import { WorldGenerator } from './worldGenerator';

const dir = process.env.VALHEIM_WORLD_TEST;

const ms = (from: number) => Math.round(performance.now() - from);

/** Location centres by zone, for "how far is the nearest" (≤ one zone away). */
const locationsByZone = (position: Float32Array) => {
  const zones = new Map<string, number[]>();
  for (let i = 0; i < position.length; i += 3) {
    const key = `${zoneOf(position[i]!)},${zoneOf(position[i + 2]!)}`;
    zones.set(key, [...(zones.get(key) ?? []), position[i]!, position[i + 2]!]);
  }
  return (x: number, z: number): number => {
    let best = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = zones.get(`${zoneOf(x) + dx},${zoneOf(z) + dz}`) ?? [];
        for (let i = 0; i < list.length; i += 2) {
          best = Math.min(best, Math.hypot(list[i]! - x, list[i + 1]! - z));
        }
      }
    }
    return best;
  };
};

describe.skipIf(!dir)('terrain of a real world save', () => {
  let world!: WorldScan;
  let gen!: WorldGenerator;
  let pregenMs = 0;
  let pre!: ReturnType<typeof pregenerate>;
  beforeAll(async () => {
    const catalogue = scanPrefabs([...testLibrary.catalog.pieces.keys()]);
    world = await readChunkedWorld(folderFiles(dir!), catalogue);
    gen = new WorldGenerator(world.site!.seed, world.site!.worldGenVersion);
    const started = performance.now();
    pre = pregenerate(gen, { deepNorth: true });
    pregenMs = ms(started);
  });

  it('pregenerates the rivers as the game does', () => {
    console.info(`Pregeneration with the Deep North pass: ${pregenMs} ms`);
    expect([pre.lakes.length, pre.rivers.length, pre.streams.length]).toEqual([119, 157, 2_037]);
    expect([lakesHash(pre.lakes), riversHash(pre.rivers), riversHash(pre.streams)]).toEqual([
      1_405_597_621, 3_869_408_788, 1_357_964_858,
    ]);
  });

  it('gives the save’s own location heights', () => {
    const p = world.locations!.position;
    let n = 0;
    let max = 0;
    for (let i = 0; i < p.length; i += 3) {
      const h = gen.getHeight(p[i]!, p[i + 2]!);
      if (!Number.isFinite(h)) continue; // Ashlands and Deep North
      n++;
      max = Math.max(max, Math.abs(p[i + 1]! - h));
    }
    console.info(
      `Locations: ${n} of ${p.length / 3} checked, max error ${(max * 1000).toFixed(2)} mm`
    );
    expect(n).toBeGreaterThan(9_000);
    expect(max).toBeLessThanOrEqual(0.01);
  });

  it('puts the vegetation away from locations on the ground', () => {
    const edited = new Set(world.terrainComps.map((c) => `${c.zx},${c.zz}`));
    const zones = [...readVegetation(folderFiles(dir!)).entries()]
      .filter(([key]) => !edited.has(key))
      .sort(([a], [b]) => (a < b ? -1 : 1));
    // Every 4th zone, as a spread sample.
    const sample = zones.filter((_, i) => i % 4 === 0).map(([, zone]) => zone);
    const nearest = locationsByZone(world.locations!.position);
    let zonesUsed = 0;
    let n = 0;
    let max = 0;
    let within = 0;
    for (const { zx, zz, points } of sample) {
      const { heights } = zoneHeights(gen, zx, zz);
      if (heights.some((h) => !Number.isFinite(h))) continue; // Ashlands, Deep North
      zonesUsed++;
      const grid = {
        x0: zoneOrigin(zx),
        z0: zoneOrigin(zz),
        cols: ZONE_VERTICES,
        rows: ZONE_VERTICES,
        heights,
      };
      for (let i = 0; i < points.length; i += 3) {
        const [x, y, z] = [points[i]!, points[i + 1]!, points[i + 2]!];
        if (nearest(x, z) <= 30) continue;
        const error = Math.abs(y - groundAtWorld(grid, x, z)!);
        n++;
        max = Math.max(max, error);
        if (error < 0.1) within++;
      }
    }
    console.info(
      `Vegetation over ${zonesUsed} zones, > 30 m from a location: ${n} objects, max ${(max * 1000).toFixed(2)} mm`
    );
    expect(zonesUsed).toBeGreaterThanOrEqual(100);
    expect(within).toBe(n);
  });

  it('imports the build with its ground: floors on it, none under it', async () => {
    const groups = groupPieces(world.pieces);
    const cluster = describeCluster(world.pieces, groups[0]!, () => null);
    const { plan: bare } = importCluster(world.pieces, cluster, testLibrary, world.name);
    const rect = siteRect(bare, testLibrary)!;
    expect(terrainAvailability(world, rect)).toEqual({ ok: true });

    let started = performance.now();
    const cold = await runTerrainJob(terrainJobFor(world, rect, null));
    const coldMs = ms(started);
    started = performance.now();
    const warm = await runTerrainJob(terrainJobFor(world, rect, cold.rivers));
    const warmMs = ms(started);
    console.info(
      `Site ${rect.cols} × ${rect.rows}: cold ${coldMs} ms (${JSON.stringify(cold.ms, (_, v: unknown) => (typeof v === 'number' ? Math.round(v) : v))}), warm ${warmMs} ms; ${cold.edited} edited vertices; check ${warm.check.n} locations, max ${(warm.check.maxError * 1000).toFixed(2)} mm`
    );
    expect(warm.rivers).toBeNull();
    expect(warm.heights).toEqual(cold.heights);
    expect(cold.edited).toBeGreaterThan(0);
    expect(warm.check.n).toBeGreaterThan(0);
    expect(warm.check.maxError).toBeLessThanOrEqual(0.01);

    const frame = bare.importFrame!;
    const terrain = siteTerrainFrom(world, frame, rect, warm);
    expect(terrain.notices.legacyEdits).toBe(0);
    expect(terrain.notices.unreadEdits).toBe(0);
    const plan: Plan = { ...bare, importFrame: { ...frame, terrain } };
    const file = await planFileText(plan);
    expect(await readPlanJson(JSON.parse(file))).toEqual(plan);
    console.info(
      `Plan file: ${file.length} chars, heights ${terrain.heights.byteLength} bytes packed to ${JSON.parse(file).importFrame.terrain.heights.data.length} base64 chars`
    );

    const grid = terrainGrid(terrain);
    const ground = (footprint: Parameters<typeof groundUnder>[2]) =>
      groundUnder(grid, frame, footprint) ?? 0;
    const tiles = new Set(
      [...testLibrary.floorFamilies.values()].flatMap((f) => f.tiles.map((t) => t.prefab))
    );
    const boxes = pieceBoxes(derivePlan(plan, testLibrary), plan, testLibrary);
    const support = planSupport(boxes, testLibrary.catalog.materialSupport, [], ground);
    const floors = boxes.filter((b) => b.prefab !== null && tiles.has(b.prefab));
    // How far the ground rises over each tile's top: at its centre, and the highest under
    // its footprint (its edges may meet a slope).
    const shapes = floors.map(boxShape);
    const under = shapes.map((s) => groundAt(grid, frame, s.com)! - s.aabb.max.y);
    const poke = shapes.map((s) => ground(s.footprint) - s.aabb.max.y);
    const grounded = floors.filter((b) => support.byKey.get(b.key)?.state === 'grounded').length;
    console.info(
      `Floors: ${floors.length}, grounded ${grounded}; ground over a top at its centre ≤ ${Math.max(...under).toFixed(3)} m, anywhere ≤ ${Math.max(...poke).toFixed(3)} m (${poke.filter((d) => d > 0.02).length} tiles over 0.02 m)`
    );
    expect(floors.filter((b) => b.prefab === 'wood_floor').length).toBe(221);
    expect(Math.max(...under)).toBeLessThanOrEqual(0.02);
    expect(grounded).toBeGreaterThanOrEqual(80);

    // Raw pieces checked (M17): with snap joints only stone on core wood should drop.
    started = performance.now();
    const model = supportModel(boxes, testLibrary.catalog.materialSupport, ground);
    const joints = snapJoints(boxes, testLibrary);
    const modelMs = ms(started);
    started = performance.now();
    const jointed = modelSupport(model, joints.pairs);
    const solveMs = ms(started);
    const dropping = (support: PlanSupport) =>
      boxes.filter((b) => support.byKey.get(b.key)?.state === 'collapsing');
    const loose = dropping(modelSupport(model));
    const held = dropping(jointed);
    console.info(
      `Raw pieces checked: ${loose.length} would collapse, ${held.length} with ${joints.pairs.length} snap joints (${held.filter((b) => b.material === 'stone').length} stone); model ${modelMs} ms, solve ${solveMs} ms`
    );
    expect(loose.length).toBeGreaterThan(held.length);
    expect(held.length).toBeLessThanOrEqual(10);
    expect(held.every((b) => b.material === 'stone')).toBe(true);

    // A ghost's support, as Build asks it per pointer move: each raw piece once, as if
    // placed again where it is (itself left out), against the committed result.
    const committed = { model, joints };
    const sample = boxes.filter((_, i) => i % 5 === 0);
    started = performance.now();
    const ghosts = sample.map(
      (box) => ghostSupport([box], committed, jointed, new Set([box.key]))[0]!
    );
    const perGhost = (performance.now() - started) / sample.length;
    const same = sample.filter((box, i) => {
      const full = jointed.byKey.get(box.key)!;
      return ghosts[i]!.state === full.state && Math.abs(ghosts[i]!.value - full.value) < 0.5;
    }).length;
    console.info(
      `Ghost support: ${perGhost.toFixed(3)} ms per piece over ${sample.length}; ${same} agree with the full solve`
    );
    // Reported above; the bound only catches a blow-up (it runs ~0.03 ms when idle).
    expect(perGhost).toBeLessThan(3);
    expect(same / sample.length).toBeGreaterThan(0.9);
  }, 30_000); // the cold river job alone takes seconds on a busy machine
});
