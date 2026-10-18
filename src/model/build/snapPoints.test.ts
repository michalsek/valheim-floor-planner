import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { derivePlan } from '../derivePlan';
import { pieceBoxes } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import { emptyPlan, type Plan, type RawPiece } from '../types';

import { boxSnapPoints, snapIndex, snapsNear } from './snapPoints';

const raw = (id: string, prefab: string, x: number, y: number, z: number, yaw = 0): RawPiece => ({
  id,
  prefab,
  position: { x, y, z },
  rotation: { yaw, pitch: 0, roll: 0 },
  elevation: 0,
});

const rounded = (points: { x: number; y: number; z: number }[]) =>
  points.map((p) => [p.x, p.y, p.z].map((v) => Math.round(v * 1000) / 1000 + 0));

describe('boxSnapPoints', () => {
  it('turns a raw piece clockwise with its yaw, in prefab order', () => {
    const wall = rawBox(raw('w', 'woodwall', 2, 1, 3, 90), testLibrary);
    // Local +x turns to +z (clockwise on screen).
    expect(rounded(boxSnapPoints(wall, testLibrary))).toEqual([
      [2, 2, 4],
      [2, 2, 2],
      [2, 0, 4],
      [2, 0, 2],
    ]);
  });

  it("puts a drawn wall's snap points where the same raw wall's are", () => {
    const plan: Plan = {
      ...emptyPlan(),
      walls: {
        w: {
          id: 'w',
          familyId: 'wood',
          points: [
            { x: 0, z: 0 },
            { x: 0, z: 2 },
          ],
          closed: false,
          side: 'right',
          height: 2,
          elevation: 0,
        },
      },
    };
    const [drawn] = pieceBoxes(derivePlan(plan, testLibrary), plan, testLibrary);
    const twin = rawBox(raw('r', drawn!.prefab!, 0, 1, 1, 90), testLibrary);
    const sorted = (box: typeof twin) =>
      rounded(boxSnapPoints(box, testLibrary)).sort((a, b) => a.join().localeCompare(b.join()));
    expect(sorted(drawn!)).toEqual(sorted(twin));
  });
});

describe('snapIndex', () => {
  it('finds the snap points within a radius, in box then point order', () => {
    const boxes = [raw('a', 'wood_pole2', 0, 1, 0), raw('b', 'wood_pole2', 0.3, 1, 0)].map((p) =>
      rawBox(p, testLibrary)
    );
    const index = snapIndex(boxes, testLibrary);
    expect(snapIndex(boxes, testLibrary)).toBe(index);
    const near = snapsNear(index, { x: 0.2, y: 2, z: 0 }, 0.25);
    expect(near.map((t) => [t.box, t.index])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(snapsNear(index, { x: 0.2, y: 2, z: 0 }, 0.15).map((t) => t.box)).toEqual([1]);
  });
});
