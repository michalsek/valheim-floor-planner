import { describe, expect, it } from 'vitest';

import type { PieceDef } from '../../catalog/pieceDefs';
import { testLibrary } from '../../catalog/testLibrary';
import { rawBox } from '../rawBoxes';
import type { RawPiece, Vec3 } from '../types';

import { placeSet, setSnaps, singlePiece } from './ghostSet';
import { basePose, blockedBy, duplicateOf, snapPose, stepManual } from './placement';
import { snapIndex } from './snapPoints';

const UP = { x: 0, y: 1, z: 0 };

const raw = (prefab: string, at: Vec3, yaw = 0): RawPiece => ({
  id: `${prefab}@${at.x},${at.y},${at.z}`,
  prefab,
  position: at,
  rotation: { yaw, pitch: 0, roll: 0 },
  elevation: 0,
});

const indexOf = (pieces: RawPiece[], lib = testLibrary) =>
  snapIndex(
    pieces.map((p) => rawBox(p, lib)),
    lib
  );

const expectNear = (a: Vec3, b: Vec3) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(a.z).toBeCloseTo(b.z, 6);
};

const wall = singlePiece('woodwall');
const opts = { lib: testLibrary };

describe('basePose', () => {
  it('stands a wall on the plate at the hit', () => {
    const pose = basePose(
      { point: { x: 2.3, y: 0, z: 0.1 }, normal: UP },
      wall,
      0,
      null,
      testLibrary
    );
    expectNear(pose.pivot, { x: 2.3, y: 1, z: 0.1 });
  });

  it('puts a manual snap point on the hit', () => {
    const hit = { point: { x: 5, y: 0, z: 5 }, normal: UP };
    const pose = basePose(hit, wall, 90, 2, testLibrary);
    expectNear(setSnaps(wall, pose, testLibrary)[2]!.point, hit.point);
  });
});

describe('snapPose', () => {
  const neighbour = indexOf([raw('woodwall', { x: 0, y: 1, z: 0 })]);

  it('snaps a wall beside a wall end to end; a tie keeps the first ghost point', () => {
    const base = basePose(
      { point: { x: 2.3, y: 0, z: 0.1 }, normal: UP },
      wall,
      0,
      null,
      testLibrary
    );
    const { pose, pair } = snapPose(base, wall, neighbour, opts);
    expectNear(pose.pivot, { x: 2, y: 1, z: 0 });
    // Its top-left and bottom-left points are equally near: the first (index 1) wins.
    expect(pair?.ghost.index).toBe(1);
    expect(pair?.target.index).toBe(0);
  });

  it("snaps a floor aimed at a wall's top edge onto the wall top's corners", () => {
    const floor = singlePiece('wood_floor');
    const hit = { point: { x: 0.2, y: 1.9, z: 0.15 }, normal: { x: 0, y: 0, z: 1 } };
    const base = basePose(hit, floor, 0, null, testLibrary);
    const { pose, pair } = snapPose(base, floor, neighbour, opts);
    expectNear(pose.pivot, { x: 0, y: 2, z: 1 });
    expect(pair?.target.point.y).toBeCloseTo(2);
  });

  it("doesn't snap in free mode", () => {
    const base = { pivot: { x: 2.3, y: 1, z: 0.1 }, yaw: 0 };
    expect(snapPose(base, wall, neighbour, { ...opts, free: true })).toEqual({
      pose: base,
      pair: null,
      dropped: false,
    });
  });

  it('snaps within 0.5 m and not beyond', () => {
    const pole = singlePiece('wood_pole2');
    const poles = indexOf([raw('wood_pole2', { x: 0, y: 1, z: 0 })]);
    const at = (x: number) => snapPose({ pivot: { x, y: 3, z: 0 }, yaw: 0 }, pole, poles, opts);
    expectNear(at(0.49).pose.pivot, { x: 0, y: 3, z: 0 });
    expect(at(0.51).pair).toBeNull();
  });

  it('ignores targets whose piece is more than 10 m from the ghost', () => {
    const reach = (x: number): PieceDef => ({
      ...testLibrary.catalog.pieces.get('wood_pole2')!,
      prefab: `reach${x}`,
      snapPoints: [[x, 0, 0]],
    });
    const pieces = new Map(testLibrary.catalog.pieces);
    for (const def of [reach(9), reach(11)]) pieces.set(def.prefab, def);
    const lib = { ...testLibrary, catalog: { ...testLibrary.catalog, pieces } };
    const snapsAt = (x: number) =>
      snapPose(
        { pivot: { x: 0, y: 1, z: 0 }, yaw: 0 },
        singlePiece(`reach${x}`),
        indexOf([raw('wood_pole2', { x: x + 0.1, y: 0, z: 0 })], lib),
        { lib }
      ).pair !== null;
    expect(snapsAt(9)).toBe(true);
    expect(snapsAt(11)).toBe(false);
  });

  it('only snaps the manual snap point when one is chosen', () => {
    const base = { pivot: { x: 2.3, y: 1, z: 0.1 }, yaw: 0 };
    const { pair } = snapPose(base, wall, neighbour, { ...opts, manual: 3 });
    expect(pair?.ghost.index).toBe(3);
  });

  it('drops the snap when it would land on a piece of the same prefab', () => {
    const base = { pivot: { x: 0.3, y: 1, z: 0.1 }, yaw: 0 };
    expect(snapPose(base, wall, neighbour, opts)).toEqual({
      pose: base,
      pair: null,
      dropped: true,
    });
  });
});

describe('duplicates', () => {
  const index = indexOf([raw('woodwall', { x: 0, y: 1, z: 0 })]);
  const at = (yaw: number, x = 0.03) => placeSet(wall, { pivot: { x, y: 1, z: 0 }, yaw });

  it('blocks the same prefab on the same pivot and yaw; the snap rule ignores the yaw', () => {
    expect(blockedBy(at(5), index)).not.toBeNull();
    expect(blockedBy(at(90), index)).toBeNull();
    expect(duplicateOf(at(90), index, null)).not.toBeNull();
    expect(duplicateOf(at(0, 0.06), index, null)).toBeNull();
  });
});

describe('stepManual', () => {
  it('runs auto, 0 … n − 1 and wraps both ways', () => {
    const seq = [null, 0, 1, 2, null];
    seq.slice(1).forEach((next, i) => expect(stepManual(seq[i]!, 3, 1)).toBe(next));
    expect(stepManual(null, 3, -1)).toBe(2);
    expect(stepManual(0, 3, -1)).toBeNull();
  });
});
