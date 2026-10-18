import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { rotate } from '../geometry/propGeometry';
import { rawOutline } from '../rawBoxes';

import { planToWorld } from '../terrain/siteTerrain';

import { describeCluster, groupPieces } from './clusters';
import { frameGridOf, WORLD_LATTICE } from './frameGrid';
import { importCluster } from './importCluster';
import { snapAngle, type PieceCloud } from './pieceCloud';

type Spec = [prefab: string, x: number, y: number, z: number, yaw: number];

const cloudOf = (specs: readonly Spec[]): PieceCloud => {
  const prefabs = [...new Set(specs.map((s) => s[0]))];
  return {
    prefabs,
    prefabIndex: specs.map((s) => prefabs.indexOf(s[0])),
    position: specs.flatMap(([, x, y, z]) => [x, y, z]),
    rotation: specs.flatMap((s) => [0, s[4], 0]),
  };
};

const DEG = Math.PI / 180;
/** A point `(u, v)` of a frame turned by the game's `yaw` and moved to `(ox, oz)`. */
const world = (u: number, v: number, yaw: number, ox: number, oz: number): [number, number] => [
  ox + u * Math.cos(yaw * DEG) + v * Math.sin(yaw * DEG),
  oz - u * Math.sin(yaw * DEG) + v * Math.cos(yaw * DEG),
];

/** A 2 × 4 m shed turned 45° (saved as 44.5°): two floors, a wall along each long side. */
const shed = (yaw: number, ox: number, oz: number): Spec[] => {
  const at = (u: number, v: number) => world(u, v, yaw, ox, oz);
  const saved = yaw - 0.5;
  return [
    ['wood_floor', ...at(1, 1), 31.25, saved],
    ['wood_floor', ...at(3, 1), 31.25, saved],
    ['woodwall', ...at(1, 0), 32.25, saved],
    ['woodwall', ...at(3, 0), 32.25, saved + 180],
    ['woodwall', ...at(1, 2), 33.25, saved],
  ].map(([p, x, z, y, r]) => [p, x, y, z, r] as Spec);
};

describe('world builds', () => {
  it('snaps truncated angles onto Hammer steps and leaves others', () => {
    expect([22, 22.5, 269.5, 359.5, 10, 0].map(snapAngle)).toEqual([22.5, 22.5, 270, 0, 10, 0]);
  });

  it('groups pieces within 32 m into sites and finds each grid', () => {
    const cloud = cloudOf([
      ...shed(45, 100, 100),
      ['piece_workbench', 120, 31, 110, 0], // beside the shed: one site
      ...shed(0, 300, 100),
      ['wood_beam', 500, 0, 0, 0],
      ['wood_beam', 532, 0, 0, 0], // just in reach
      ['wood_beam', 600, 0, 0, 0],
      ['wood_beam', 632.5, 0, 0, 0], // just out of it
    ]);
    const groups = groupPieces(cloud);
    expect(groups.map((g) => g.length)).toEqual([6, 5, 2, 1, 1]);
    const first = describeCluster(cloud, groups[0]!, () => 'wood');
    expect(first).toMatchObject({ yaw: 45, aligned: 5, material: 'wood' });
  });

  it('imports on the world axes by default, the origin on the world lattice', () => {
    const cloud = cloudOf(shed(45, 101.3, 99.1));
    const cluster = describeCluster(cloud, groupPieces(cloud)[0]!, () => null);
    const { plan } = importCluster(cloud, cluster, testLibrary, 'Fixture');
    const frame = plan.importFrame!;
    expect(frame.yaw).toBe(0);
    expect([frame.origin.x % WORLD_LATTICE, frame.origin.z % WORLD_LATTICE]).toEqual([0, 0]);
    expect(frameGridOf(frame)).toBe('world');
    // Pieces keep their angle in the world; every pivot maps back onto its world point.
    const pieces = Object.values(plan.rawPieces);
    expect(pieces.map((p) => p.rotation.yaw)).toEqual([45, 45, 45, 225, 45]);
    pieces.forEach((p, k) => {
      const w = planToWorld(frame, p.position);
      expect(w.x).toBeCloseTo(cloud.position[k * 3]!, 5);
      expect(w.z).toBeCloseTo(cloud.position[k * 3 + 2]!, 5);
    });
    // The origin is the lattice corner just below and left of every footprint.
    const corners = pieces.flatMap((p) => rawOutline(p, testLibrary));
    for (const axis of ['x', 'z'] as const) {
      const least = Math.min(...corners.map((c) => c[axis]));
      expect(least).toBeGreaterThanOrEqual(0);
      expect(least).toBeLessThan(WORLD_LATTICE);
    }
  });

  it('aligns to the build when asked: a turned shed comes in axis-aligned, cornered at the origin', () => {
    const cloud = cloudOf(shed(45, 100, 100));
    const cluster = describeCluster(cloud, groupPieces(cloud)[0]!, () => null);
    const { plan } = importCluster(cloud, cluster, testLibrary, 'Fixture', 'build');
    const pieces = Object.values(plan.rawPieces);
    expect(pieces.map((p) => p.rotation.yaw)).toEqual([0, 0, 0, 180, 0]);
    expect(plan.importFrame).toMatchObject({ worldName: 'Fixture', yaw: 45 });
    // The floors' edge is on x = 0; the far wall's 0.15 m half-thickness takes z to the
    // next grid line. The game's local +v is the plan's −z (north up).
    const corners = pieces.flatMap((p) => rawOutline(p, testLibrary));
    expect(Math.min(...corners.map((c) => c.x))).toBeCloseTo(-0.01);
    expect(Math.min(...corners.map((c) => c.z))).toBeCloseTo(0.35);
    expect(pieces[2]!.position).toMatchObject({ x: 1, y: 1, z: 2.5 });
    expect(pieces[4]!.position).toMatchObject({ x: 1, y: 2, z: 0.5 });
    // The frame maps every plan pivot back onto its world point.
    const frame = plan.importFrame!;
    const back = (x: number, z: number) => {
      const u = rotate({ x, z }, frame.yaw);
      return [frame.origin.x + u.x, frame.origin.z - u.z];
    };
    const [wx, wz] = back(pieces[2]!.position.x, pieces[2]!.position.z);
    expect(wx).toBeCloseTo(cloud.position[6]!);
    expect(wz).toBeCloseTo(cloud.position[8]!);
    // Heights from the structure's lowest bottom (31.25, the floors' top); the upper wall has no
    // floor under it, so it stays on level 0, 1 m up.
    expect(pieces.map((p) => p.elevation)).toEqual([0, 0, 0, 0, 0]);
  });

  it('keeps north up and turns pieces clockwise as the game does', () => {
    // A frame of two walls (grid 0°), one 10 m north; a chest east, turned 22.5°.
    const cloud = cloudOf([
      ['woodwall', 0, 31, 0, 0],
      ['woodwall', 0, 31, 10, 0],
      ['piece_chest_wood', 3, 30, 0, 22.5],
    ]);
    const cluster = describeCluster(cloud, [0, 1, 2], () => null);
    const [south, north, chest] = Object.values(
      importCluster(cloud, cluster, testLibrary, 'Fixture').plan.rawPieces
    );
    expect(north!.position.z).toBeCloseTo(south!.position.z - 10);
    expect(north!.position.x).toBeCloseTo(south!.position.x);
    expect(chest!.position.x).toBeCloseTo(south!.position.x + 3);
    expect(chest!.rotation.yaw).toBe(22.5);
  });

  // Two 8 × 2 m decks, 4 m and 8 m up, with walls on them (more on the upper one), and
  // one beam on the ground under them.
  const deck = (y: number, rows: number[]): Spec[] =>
    [0, 2, 4, 6].flatMap((x): Spec[] => [
      ['wood_floor', x + 1, y, 1, 0],
      ...rows.map((z): Spec => ['woodwall', x + 1, y + 1, z, 0]),
    ]);
  const decks: Spec[] = [...deck(34, [0, 2]), ...deck(38, [0, 1, 2]), ['wood_beam', 3, 30, 1, 0]];
  const imported = (specs: readonly Spec[]) => {
    const cloud = cloudOf(specs);
    const cluster = describeCluster(cloud, [...specs.keys()], () => null);
    return importCluster(cloud, cluster, testLibrary, 'Fixture');
  };

  it('starts on the main floor, not on a few stray pieces below it', () => {
    const { plan, level } = imported(decks);
    const floors = Object.values(plan.rawPieces).filter((p) => p.prefab === 'wood_floor');
    expect(level).toBeGreaterThan(0);
    expect(level).toBe(Math.min(...floors.map((p) => p.elevation)));
  });

  it('takes height 0 from the structure, not from a station on lower ground', () => {
    const bare = imported(decks).plan;
    const { plan } = imported([...decks, ['piece_workbench', 12, 29.3, 1, 0]]);
    expect(plan.importFrame!.origin.y).toBe(bare.importFrame!.origin.y);
    const pieces = Object.values(plan.rawPieces);
    expect(new Set(pieces.map((p) => p.elevation))).toEqual(new Set([0, 4, 8]));
    expect(pieces.at(-1)!.position.y).toBeLessThan(0);
  });

  it('puts each roof course on the storey under its lowest edge, as walls', () => {
    // A 45° course with its eave on each deck's 2 m walls (bottom 6 m and 10 m up).
    const roofs: Spec[] = [
      ['wood_roof_45', 1, 37, 3, 0],
      ['wood_roof_45', 1, 41, 3, 0],
    ];
    const { plan, level } = imported([...decks, ...roofs]);
    const pieces = Object.values(plan.rawPieces);
    const roofLevels = pieces.filter((p) => p.prefab === 'wood_roof_45').map((p) => p.elevation);
    expect(roofLevels).toEqual([4, 8]);
    expect(new Set(pieces.map((p) => p.elevation))).toEqual(new Set([0, 4, 8]));
    expect(level).toBe(4);
  });
});
