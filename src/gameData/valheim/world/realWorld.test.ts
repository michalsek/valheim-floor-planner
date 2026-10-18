/**
 * Golden test against a real 1.0 world save. Runs only with
 * `VALHEIM_WORLD_TEST=<world folder>` (`pnpm test:world`); the expected numbers are the
 * user's validated world (research/README.md §7, M13 §6). Only aggregates are checked
 * and nothing from the save is written anywhere.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { testLibrary } from '../../../catalog/testLibrary';
import { rotate } from '../../../model/geometry/propGeometry';
import { parsePlan, serializePlan } from '../../../model/serialize';
import type { RawPiece } from '../../../model/types';
import { describeCluster, groupPieces } from '../../../model/world/clusters';
import { importCluster } from '../../../model/world/importCluster';
import { cloudPiece } from '../../../model/world/pieceCloud';

import { readChunkedWorld } from './readWorld';
import { folderFiles } from './testWorld';
import { scanPrefabs } from './worldPrefabs';

const dir = process.env.VALHEIM_WORLD_TEST;

const countBy = <T>(values: readonly T[]): Map<T, number> =>
  values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<T, number>());

const extent = (prefab: string, axis: number): number => {
  const values = testLibrary.catalog.pieces.get(prefab)?.snapPoints.map((p) => p[axis]!) ?? [];
  return values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
};

/**
 * Pieces that continue a neighbour of the same prefab, yaw and height one piece length
 * (snap extent along x) away: whether that step runs along the piece's own x axis as the
 * plan turns it (the yaw convention and the frame turn agree), or across it. Flat square
 * pieces (floors) continue both ways and are left out; a roof row only along its eave.
 */
const continuity = (pieces: readonly RawPiece[]) => {
  const square = (prefab: string) =>
    extent(prefab, 1) === 0 && extent(prefab, 0) === extent(prefab, 2);
  const length = (prefab: string) => (square(prefab) ? 0 : extent(prefab, 0));
  let along = 0;
  let across = 0;
  for (const a of pieces) {
    const l = length(a.prefab);
    if (l === 0) continue;
    for (const b of pieces) {
      const same =
        a !== b &&
        a.prefab === b.prefab &&
        a.rotation.yaw === b.rotation.yaw &&
        Math.abs(a.elevation + a.position.y - b.elevation - b.position.y) < 0.05;
      const d = { x: b.position.x - a.position.x, z: b.position.z - a.position.z };
      if (!same || Math.abs(Math.hypot(d.x, d.z) - l) > 0.05) continue;
      const axis = rotate({ x: 1, z: 0 }, a.rotation.yaw);
      const cos = Math.abs(axis.x * d.x + axis.z * d.z) / l;
      if (cos > 0.99) along++;
      else if (cos < 0.01) across++;
    }
  }
  return { along, across };
};

describe.skipIf(!dir)('a real world save', () => {
  const catalogue = [...testLibrary.catalog.pieces.keys()];
  let scanMs = 0;
  let world!: Awaited<ReturnType<typeof readChunkedWorld>>;
  let pieces!: typeof world.pieces;
  beforeAll(async () => {
    const started = performance.now();
    world = await readChunkedWorld(folderFiles(dir!), scanPrefabs(catalogue));
    scanMs = performance.now() - started;
    pieces = world.pieces;
  });

  it('decodes every chunk to its last byte and finds the built pieces', () => {
    console.info(`Scanned ${world.zdos} objects in ${Math.round(scanMs)} ms`);
    // The reader throws on a count mismatch or a byte left over, chunk by chunk.
    expect(world.chunks.length).toBe(8);
    expect(world.chunks.reduce((n, c) => n + c.zdos, 0)).toBe(110_186);
    expect(world.zdos).toBe(110_186);
    expect(world.generation).toBe(62);
    expect(world.version).toBe(42);
    expect(pieces.prefabIndex.length).toBe(1_142);
    expect(pieces.prefabs.length).toBe(41);
  });

  it('keeps what the terrain needs (aggregates only; the seed is never printed)', () => {
    expect(world.site?.worldGenVersion).toBe(2);
    expect(Number.isInteger(world.site?.seed)).toBe(true);
    // Three edited zones; every payload is gzip (1f 8b).
    expect(world.terrainComps.length).toBe(3);
    expect(world.terrainComps.every((c) => c.data[0] === 0x1f && c.data[1] === 0x8b)).toBe(true);
    expect(world.legacyEdits.length).toBe(0);
    expect(world.locations?.hash.length).toBe(12_165);
  });

  it('snaps the saved yaws onto the Hammer steps', () => {
    const yaws = countBy(
      Array.from({ length: pieces.prefabIndex.length }, (_, i) => cloudPiece(pieces, i).yaw)
    );
    expect([22.5, 112.5, 202.5, 292.5].map((y) => yaws.get(y))).toEqual([436, 196, 269, 189]);
    expect([...yaws.keys()].every((y) => y % 22.5 === 0)).toBe(true);
  });

  it('finds one big build and two lone workbenches', () => {
    const groups = groupPieces(pieces);
    expect(groups.map((g) => g.length)).toEqual([1_140, 1, 1]);
    const build = describeCluster(pieces, groups[0]!, () => null);
    expect(build.yaw).toBe(22.5);
    expect(build.aligned).toBe(1_090);
    expect(build.size.x).toBeCloseTo(40, 0);
    expect(build.size.z).toBeCloseTo(57.8, 0);
  });

  it('imports the build axis-aligned, every piece, and the plan loads back', () => {
    const groups = groupPieces(pieces);
    const build = describeCluster(pieces, groups[0]!, () => null);
    const { plan, level } = importCluster(pieces, build, testLibrary, world.name);
    const raw = Object.values(plan.rawPieces);
    expect(raw.length).toBe(1_140);
    expect(raw.filter((p) => p.rotation.yaw % 90 === 0).length).toBe(1_090);
    expect(parsePlan(JSON.parse(serializePlan(plan)))).toEqual(plan);
    // Wall and floor pivots sit on the 0.5 m grid from the origin (the game drifts ±3 cm).
    const onGrid = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < 0.06;
    const square = raw.filter((p) => p.rotation.yaw % 90 === 0 && /wall|floor/.test(p.prefab));
    expect(square.every((p) => onGrid(p.position.x) && onGrid(p.position.z))).toBe(true);
    // The frame maps every plan pivot back onto the world pivot (planner z is −z).
    const frame = plan.importFrame!;
    const misplaced = groups[0]!.filter((index, k) => {
      const piece = plan.rawPieces[`raw${k}`]!;
      const u = rotate({ x: piece.position.x, z: piece.position.z }, frame.yaw);
      const world = [frame.origin.x + u.x, frame.origin.z - u.z];
      return (
        Math.abs(world[0]! - pieces.position[index * 3]!) > 1e-3 ||
        Math.abs(world[1]! - pieces.position[index * 3 + 2]!) > 1e-3
      );
    });
    expect(misplaced).toEqual([]);
    const levels = [...countBy(raw.map((p) => p.elevation))].sort((a, b) => a[0] - b[0]);
    console.info('Levels (elevation, pieces):', JSON.stringify(levels), 'start at', level);
    expect(levels[0]![0]).toBe(0);
    // Handedness: neighbouring pieces continue along their own x axis as the plan turns
    // them. Only pieces off the build's grid tell a flipped yaw apart (at 45° it turns
    // the axis by 90°): here two roof pieces side by side along their eave.
    const all = continuity(raw);
    const diagonal = continuity(raw.filter((p) => p.rotation.yaw % 90 !== 0));
    console.info(`Continuity: ${JSON.stringify(all)}; off the grid ${JSON.stringify(diagonal)}`);
    expect(all.along).toBeGreaterThan(10 * all.across);
    expect(diagonal).toEqual({ along: 2, across: 0 });
  });
});
