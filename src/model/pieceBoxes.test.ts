import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { derivePlan } from './derivePlan';
import { PANEL_THICKNESS, pieceBoxes } from './pieceBoxes';
import { emptyPlan, type Plan } from './types';

const boxesOf = (parts: Partial<Plan>, datum?: number) => {
  const plan: Plan = { ...emptyPlan(), ...parts };
  return pieceBoxes(derivePlan(plan, testLibrary), plan, testLibrary, datum);
};

describe('pieceBoxes', () => {
  it('stacks a 4 m stone wall in courses, its 1 m strip on the drawn side', () => {
    const boxes = boxesOf({
      walls: {
        w: {
          id: 'w',
          familyId: 'stone',
          points: [
            { x: 0, z: 0 },
            { x: 4, z: 0 },
          ],
          closed: false,
          side: 'right',
          height: 4,
        },
      },
    });
    expect(boxes.map((b) => [b.center.y, b.size.y])).toEqual([
      [1, 2],
      [3, 2],
    ]);
    for (const b of boxes) {
      expect(b).toMatchObject({ kind: 'wall', item: { kind: 'wall', id: 'w' } });
      expect(b.size).toEqual({ x: 4, y: 2, z: 1 });
      // 'right' of a line drawn towards +x is +z (screen down).
      expect(b.center.z).toBeCloseTo(0.5);
    }
  });

  it('hangs floors below the datum, whatever their thickness', () => {
    const floor = (id: string, familyId: string, x: number) => ({
      id,
      familyId,
      min: { x, z: 0 },
      max: { x: x + 2, z: 2 },
    });
    const boxes = boxesOf({ floors: { a: floor('a', 'stone', 0), b: floor('b', 'wood', 2) } }, 1.5);
    expect(boxes.map((b) => [b.size.y, b.center.y + b.size.y / 2])).toEqual([
      [1, 1.5],
      [0.13, 1.5],
    ]);
  });

  it('centres a turned prop on its offset footprint, at its collider height', () => {
    const [bed] = boxesOf({
      props: {
        p: { id: 'p', prefab: 'piece_bed02', position: { x: 10, z: 5 }, rotation: 90, upgrades: 0 },
      },
    });
    // The collider spans z −1.6…1.835 (centre 0.1175); turned 90° clockwise, that is −x.
    expect(bed?.center.x).toBeCloseTo(10 - 0.1175);
    expect(bed?.center.z).toBeCloseTo(5);
    // Its collider dips 0.045 below the pivot; props stand on the datum.
    expect(bed?.center.y).toBeCloseTo(1.455 / 2);
    expect(bed?.size.y).toBeCloseTo(1.455);
    expect(bed?.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(bed).toMatchObject({ kind: 'prop', group: 'furniture', material: null });
  });

  it('draws a door as a thin panel of its real height in the wall gap', () => {
    const boxes = boxesOf({
      walls: {
        w: {
          id: 'w',
          familyId: 'wood',
          points: [
            { x: 0, z: 0 },
            { x: 8, z: 0 },
          ],
          closed: false,
          side: 'right',
          height: 2,
        },
      },
      openings: { d: { id: 'd', wallId: 'w', prefab: 'wood_door', at: { x: 4, z: 0 } } },
    });
    const door = testLibrary.openingDefs.get('wood_door');
    const panel = boxes.find((b) => b.kind === 'opening');
    expect(panel?.size).toEqual({ x: door?.width, y: door?.height, z: PANEL_THICKNESS });
    expect(panel?.center).toMatchObject({ x: 4, z: 0 });
    expect(panel?.item).toEqual({ kind: 'opening', id: 'd' });
  });
});
