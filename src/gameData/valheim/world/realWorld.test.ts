/**
 * Golden test against a real 1.0 world save. Runs only with
 * `VALHEIM_WORLD_TEST=<world folder>` (`pnpm test:world`); the expected numbers are the
 * user's validated world (research/README.md §7, M13 §6). Only aggregates are checked
 * and nothing from the save is written anywhere.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { testLibrary } from '../../../catalog/testLibrary';
import { rawPivot, setFromRaw, rawPose } from '../../../model/build/ghostSet';
import { snapPose } from '../../../model/build/placement';
import { boxSnapPoints, snapIndex, snapsNear } from '../../../model/build/snapPoints';
import { rotate } from '../../../model/geometry/propGeometry';
import { storeyStops } from '../../../model/cut';
import { pieceBoxes } from '../../../model/pieceBoxes';
import { planFileText, readPlanJson } from '../../../model/planFile';
import type { Plan, RawPiece, Vec3 } from '../../../model/types';
import { describeCluster, groupPieces } from '../../../model/world/clusters';
import { planToWorld } from '../../../model/terrain/siteTerrain';
import { frameGridOf, WORLD_LATTICE } from '../../../model/world/frameGrid';
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
        Math.abs(a.position.y - b.position.y) < 0.05;
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
    // Nothing a player placed is left out unseen.
    expect(world.skipped).toBe(0);
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

  it('finds one big site (with a workbench beside it) and a lone workbench', () => {
    const groups = groupPieces(pieces);
    expect(groups.map((g) => g.length)).toEqual([1_141, 1]);
    const build = describeCluster(pieces, groups[0]!, () => null);
    expect(build.yaw).toBe(22.5);
    expect(build.aligned).toBe(1_090);
    // The site's pivots, the workbench beside the build included.
    expect(build.size.x).toBeCloseTo(47.8, 0);
    expect(build.size.z).toBeCloseTo(60.1, 0);
  });

  it('imports on the world axes by default: the grid on the terrain lattice, the build at 22.5°', () => {
    const groups = groupPieces(pieces);
    const build = describeCluster(pieces, groups[0]!, () => null);
    const plan = importCluster(pieces, build, testLibrary, world.name);
    const frame = plan.importFrame!;
    expect(frame.yaw).toBe(0);
    expect(frameGridOf(frame)).toBe('world');
    expect([frame.origin.x, frame.origin.z].map((v) => Math.abs(v % WORLD_LATTICE))).toEqual([
      0, 0,
    ]);
    const raw = Object.values(plan.rawPieces);
    // The build's grid pieces sit at 22.5° (mod 90) on the plan, as in the game.
    expect(raw.filter((p) => p.rotation.yaw % 90 === 22.5).length).toBe(1_090);
    // Every pivot maps back onto its world pivot.
    const misplaced = groups[0]!.filter((index, k) => {
      const at = planToWorld(frame, plan.rawPieces[`raw${k}`]!.position);
      return (
        Math.abs(at.x - pieces.position[index * 3]!) > 1e-3 ||
        Math.abs(at.z - pieces.position[index * 3 + 2]!) > 1e-3
      );
    });
    expect(misplaced).toEqual([]);
    const stops = storeyStops(pieceBoxes(plan, testLibrary), testLibrary);
    expect(stops.map((s) => Math.round(s.top))).toEqual([4, 5, 7, 8]);
  });

  it('imports the build axis-aligned (aligned to the build), every piece, and the plan loads back', async () => {
    const groups = groupPieces(pieces);
    const build = describeCluster(pieces, groups[0]!, () => null);
    const plan = importCluster(pieces, build, testLibrary, world.name, 'build');
    const raw = Object.values(plan.rawPieces);
    expect(raw.length).toBe(1_141);
    expect(raw.filter((p) => p.rotation.yaw % 90 === 0).length).toBe(1_090);
    expect(await readPlanJson(JSON.parse(await planFileText(plan)))).toEqual(plan);
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
    const stops = storeyStops(pieceBoxes(plan, testLibrary), testLibrary);
    const rows = stops.map((s) => [s.height, s.top, s.count]);
    console.info('Storey stops (height, top, pieces):', JSON.stringify(rows));
    // The floors' storeys only: roofs make none.
    expect(stops.map((s) => Math.round(s.top))).toEqual([4, 5, 7, 8]);
    // Handedness: neighbouring pieces continue along their own x axis as the plan turns
    // them. Only pieces off the build's grid tell a flipped yaw apart (at 45° it turns
    // the axis by 90°): here two roof pieces side by side along their eave.
    const all = continuity(raw);
    const diagonal = continuity(raw.filter((p) => p.rotation.yaw % 90 !== 0));
    console.info(`Continuity: ${JSON.stringify(all)}; off the grid ${JSON.stringify(diagonal)}`);
    expect(all.along).toBeGreaterThan(10 * all.across);
    expect(diagonal).toEqual({ along: 2, across: 0 });
  });

  describe('snapping (M17)', () => {
    let plan!: Plan;
    beforeAll(() => {
      const groups = groupPieces(pieces);
      plan = importCluster(
        pieces,
        describeCluster(pieces, groups[0]!, () => null),
        testLibrary,
        ''
      );
    });
    const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const rate = (n: number, of: number) => `${n} / ${of} (${((100 * n) / of).toFixed(1)} %)`;

    it("shares a snap point with a neighbour (the catalogue's snap points match the build)", () => {
      const boxes = pieceBoxes(plan, testLibrary);
      const index = snapIndex(boxes, testLibrary);
      const withSnaps = boxes.filter((box) => boxSnapPoints(box, testLibrary).length > 0);
      const coincident = withSnaps.filter((box) =>
        boxSnapPoints(box, testLibrary).some((p) =>
          snapsNear(index, p, 0.03).some((t) => index.boxes[t.box] !== box)
        )
      );
      console.info(`Snap coincidence within 3 cm: ${rate(coincident.length, withSnaps.length)}`);
      expect(withSnaps.length).toBe(1_118);
      expect(coincident.length).toBeGreaterThanOrEqual(1_117);
    });

    it('snaps a nudged piece back onto its place', () => {
      const raw = Object.values(plan.rawPieces);
      const boxes = pieceBoxes(plan, testLibrary);
      const index = snapIndex(boxes, testLibrary);
      const nudges = [
        { x: 0.15, y: 0.05, z: -0.1 },
        { x: -0.3, y: 0.1, z: 0.25 },
        { x: 0, y: 0.3, z: 0 },
      ];
      const back = nudges.map((nudge) => {
        let n = 0;
        let ok = 0;
        raw.forEach((piece, i) => {
          const self = boxes[i]!;
          if (boxSnapPoints(self, testLibrary).length === 0) return;
          n++;
          const pose = rawPose(piece);
          const base = {
            ...pose,
            pivot: {
              x: pose.pivot.x + nudge.x,
              y: pose.pivot.y + nudge.y,
              z: pose.pivot.z + nudge.z,
            },
          };
          const set = setFromRaw([piece], piece.id);
          const snapped = snapPose(base, set, index, {
            lib: testLibrary,
            ignore: (b) => b === self,
          });
          if (dist(snapped.pose.pivot, rawPivot(piece)) <= 0.03) ok++;
        });
        console.info(`Back within 3 cm from ${JSON.stringify(nudge)}: ${rate(ok, n)}`);
        return ok / n;
      });
      expect(back[0]).toBeGreaterThanOrEqual(0.97);
      expect(back[1]).toBeGreaterThanOrEqual(0.97);
    });
  });
});
