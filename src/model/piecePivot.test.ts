import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { pieceBoxes } from './pieceBoxes';
import { pieceAnchor, pivotFrom } from './piecePivot';
import { emptyPlan, type Plan, type Vec3 } from './types';

const def = (prefab: string) => testLibrary.catalog.pieces.get(prefab);

const boxesOf = (parts: Partial<Plan>) => pieceBoxes({ ...emptyPlan(), ...parts }, testLibrary);

/** `pivot + R·local`, R a turn of `rotationY` about +y (three.js `makeRotationY`). */
const place = (pivot: Vec3, rotationY: number, local: Vec3): Vec3 => ({
  x: pivot.x + Math.cos(rotationY) * local.x + Math.sin(rotationY) * local.z,
  y: pivot.y + local.y,
  z: pivot.z - Math.sin(rotationY) * local.x + Math.cos(rotationY) * local.z,
});

const expectClose = (a: Vec3, b: Vec3) => {
  for (const axis of ['x', 'y', 'z'] as const) expect(a[axis]).toBeCloseTo(b[axis], 6);
};

describe('piecePivot', () => {
  it('puts the anchor back on the centre, whatever the turn', () => {
    const centre = { x: 3, y: 1.5, z: -2 };
    const anchor = { x: -1, y: 1.5, z: 0.2 };
    for (const turn of [0, 0.4, Math.PI / 2, -2.5]) {
      expectClose(place(pivotFrom(centre, turn, anchor), turn, anchor), centre);
    }
  });

  it('anchors on the snap points where the box spans them, else on the collider', () => {
    // The hardwood gate's collider reaches 0.43 m past its snap points and 0.4 m above.
    expect(pieceAnchor(def('stave_gate'), { x: 2, y: 6, z: 0.12 })).toEqual({
      x: 0,
      y: 3,
      z: expect.closeTo(0.002, 3),
    });
    // The ashwood door hinges at its pivot; its height (3 m) comes from the collider.
    const door = pieceAnchor(def('ashwood_door'), { x: 2, y: 3, z: 0.12 });
    expect(door.x).toBeCloseTo(-1);
    expect(door.y).toBeCloseTo(1.5, 2);
    // A wood floor's thickness is its collider's, which sits above the snap plane.
    expect(pieceAnchor(def('wood_floor'), { x: 2, y: 0.13, z: 2 }).y).toBeCloseTo(0.032);
  });

  it("lifts a pole's pivot by its lower half, and keeps a bed's on the level", () => {
    const boxes = boxesOf({
      props: {
        p: {
          id: 'p',
          prefab: 'wood_pole_log',
          position: { x: 1, z: 1 },
          rotation: 0,
          upgrades: 0,
          elevation: 2,
        },
        b: {
          id: 'b',
          prefab: 'piece_bed02',
          position: { x: 10, z: 5 },
          rotation: 90,
          upgrades: 0,
          elevation: 2,
        },
      },
    });
    expect(boxes.map((b) => [b.prefab, b.pivot])).toEqual([
      ['wood_pole_log', { x: 1, y: 3, z: 1 }],
      ['piece_bed02', { x: 10, y: 2, z: 5 }],
    ]);
  });
});
