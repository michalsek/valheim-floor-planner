import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { boxSnapPoints } from '../build/snapPoints';
import { applyCommands } from '../commands';
import { rawBox } from '../rawBoxes';
import { emptyPlan, type Plan, type RawPiece, type Vec3 } from '../types';

import { mirrorCommands, symmetricAcross } from './mirror';

const lib = testLibrary;

const raw = (id: string, prefab: string, x: number, z: number, yaw: number): RawPiece => ({
  id,
  prefab,
  position: { x, y: 3, z },
  rotation: { yaw, pitch: 0, roll: 0 },
});

const planOf = (...pieces: RawPiece[]): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
});

/** Every raw piece's snap points (moved by `f`), as sorted keys to the 0.1 mm. */
const snapKeys = (plan: Plan, f: (p: Vec3) => Vec3 = (p) => p) =>
  Object.values(plan.rawPieces)
    .flatMap((piece) => boxSnapPoints(rawBox(piece, lib), lib))
    .map((p) => {
      const q = f(p);
      return [q.x, q.y, q.z].map((n) => (Math.round(n * 1e4) / 1e4 + 0).toFixed(4)).join();
    })
    .sort();

const mirrored = (plan: Plan, axis: 'x' | 'z') => {
  const items = Object.keys(plan.rawPieces).map((id) => ({ kind: 'raw', id }) as const);
  const { cmds, inexact } = mirrorCommands(plan, items, axis, lib);
  return { after: applyCommands(plan, cmds), inexact };
};

describe('mirrorCommands', () => {
  it('knows which way pieces are symmetric', () => {
    const def = (prefab: string) => lib.catalog.pieces.get(prefab);
    expect([symmetricAcross(def('woodwall'), 'x'), symmetricAcross(def('woodwall'), 'z')]).toEqual([
      true,
      true,
    ]);
    expect([
      symmetricAcross(def('wood_stair'), 'x'),
      symmetricAcross(def('wood_stair'), 'z'),
    ]).toEqual([true, false]);
  });

  it('mirrors walls round a corner onto their own lattice', () => {
    // Two walls along x from 0 to 4 and one along z at the corner x = 4.
    const plan = planOf(
      raw('a', 'woodwall', 1, 0, 0),
      raw('b', 'woodwall', 3, 0, 0),
      raw('c', 'woodwall', 4, 1, 90)
    );
    const { after, inexact } = mirrored(plan, 'x');
    expect(inexact).toBe(0);
    expect(Object.values(after.rawPieces).map((p) => p.prefab)).toEqual([
      'woodwall',
      'woodwall',
      'woodwall',
    ]);
    // The snap points' middle is x = 2: every end lands on another end reflected.
    expect(snapKeys(after)).toEqual(snapKeys(plan, (p) => ({ ...p, x: 4 - p.x })));
    expect(after.rawPieces.c!.position.x).toBe(0);
  });

  it('mirrors a pitched and rolled piece exactly', () => {
    const tilted = {
      ...raw('w', 'woodwall', 0.3, 0.7, 30),
      rotation: { yaw: 30, pitch: 20, roll: 10 },
    };
    const plan = planOf(tilted);
    const centre = (axis: 'x' | 'z') => {
      const values = boxSnapPoints(rawBox(tilted, lib), lib).map((p) => p[axis]);
      return Math.min(...values) + Math.max(...values);
    };
    for (const axis of ['x', 'z'] as const) {
      const { after } = mirrored(plan, axis);
      const flip = (p: Vec3) => ({ ...p, [axis]: centre(axis) - p[axis] });
      expect(snapKeys(after)).toEqual(snapKeys(plan, flip));
    }
  });

  it('makes a stair climb the mirrored way', () => {
    // At the origin its snap points span z −1…1: the mirror line is z = 0.
    const plan = planOf(raw('s', 'wood_stair', 0, 0, 0));
    const topZ = (p: Plan) => {
      const points = boxSnapPoints(rawBox(p.rawPieces.s!, lib), lib);
      const high = Math.max(...points.map((q) => q.y));
      return points.find((q) => q.y === high)!.z;
    };
    const { after } = mirrored(plan, 'z');
    expect(topZ(after)).toBeCloseTo(-topZ(plan), 6);
    expect(snapKeys(after)).toEqual(snapKeys(plan, (p) => ({ ...p, z: -p.z })));
  });
});
