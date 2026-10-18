import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { boxSnapPoints } from '../build/snapPoints';
import { applyCommands } from '../commands';
import { boxesBounds } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import { emptyPlan, type Plan, type RawPiece } from '../types';

import { mirrorCommands, symmetricAcross } from './mirror';

const lib = testLibrary;

const raw = (id: string, prefab: string, x: number, z: number, yaw: number): RawPiece => ({
  id,
  prefab,
  position: { x, y: 1, z },
  rotation: { yaw, pitch: 0, roll: 0 },
  elevation: 2,
});

const planOf = (...pieces: RawPiece[]): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
});

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

  it('keeps a wall its prefab with its centre reflected, and its line', () => {
    // A wall turned 30°, 4 m right of a stair: the selection's centre line lies between.
    const plan = planOf(raw('w', 'woodwall', 4, 0, 30), raw('s', 'wood_stair', 0, 0, 0));
    const { after, inexact } = mirrored(plan, 'x');
    expect(inexact).toBe(0);
    const [before, now] = [rawBox(plan.rawPieces.w!, lib), rawBox(after.rawPieces.w!, lib)];
    expect(after.rawPieces.w!.prefab).toBe('woodwall');
    const bounds = boxesBounds([rawBox(plan.rawPieces.s!, lib), before])!;
    const line = (bounds.min.x + bounds.max.x) / 2;
    expect(now.center.x + before.center.x).toBeCloseTo(2 * line, 6);
    expect(now.center.z).toBeCloseTo(before.center.z, 6);
    // Its ends (snap points) are the old ones reflected.
    const key = (p: { x: number; y: number; z: number }) =>
      [p.x, p.y, p.z].map((n) => n.toFixed(4)).join();
    const reflected = boxSnapPoints(before, lib).map((p) => key({ ...p, x: 2 * line - p.x }));
    expect(boxSnapPoints(now, lib).map(key).sort()).toEqual(reflected.sort());
  });

  it('makes a stair climb the mirrored way', () => {
    const plan = planOf(raw('s', 'wood_stair', 0, 0, 0));
    const top = (p: Plan) => {
      const points = boxSnapPoints(rawBox(p.rawPieces.s!, lib), lib);
      const high = Math.max(...points.map((q) => q.y));
      return points.filter((q) => q.y === high)[0]!.z - rawBox(p.rawPieces.s!, lib).center.z;
    };
    const { after } = mirrored(plan, 'z');
    expect(Math.sign(top(after))).toBe(-Math.sign(top(plan)));
    expect(rawBox(after.rawPieces.s!, lib).center.z).toBeCloseTo(
      rawBox(plan.rawPieces.s!, lib).center.z,
      6
    );
  });
});
