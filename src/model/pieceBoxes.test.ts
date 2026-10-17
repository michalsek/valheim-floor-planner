import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { derivePlan } from './derivePlan';
import { boxesBounds, PANEL_THICKNESS, pieceBoxes, type PieceBox } from './pieceBoxes';
import { emptyPlan, type Plan } from './types';

const boxesOf = (parts: Partial<Plan>) => {
  const plan: Plan = { ...emptyPlan(), ...parts };
  return pieceBoxes(derivePlan(plan, testLibrary), plan, testLibrary);
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
          elevation: 0,
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

  it('hangs floors below their elevation, whatever their thickness', () => {
    const floor = (id: string, familyId: string, x: number) => ({
      id,
      familyId,
      min: { x, z: 0 },
      max: { x: x + 2, z: 2 },
      elevation: 1.5,
    });
    const boxes = boxesOf({ floors: { a: floor('a', 'stone', 0), b: floor('b', 'wood', 2) } });
    expect(boxes.map((b) => b.size.y)).toEqual([1, 0.13]);
    // Tops a millimetre up, so they don't flicker against a wall top at the same height.
    for (const b of boxes) expect(b.center.y + b.size.y / 2).toBeCloseTo(1.5, 2);
  });

  it('centres a turned prop on its offset footprint, at its collider height', () => {
    const [bed] = boxesOf({
      props: {
        p: {
          id: 'p',
          prefab: 'piece_bed02',
          position: { x: 10, z: 5 },
          rotation: 90,
          upgrades: 0,
          elevation: 0,
        },
      },
    });
    // The collider spans z −1.6…1.835 (centre 0.1175); turned 90° clockwise, that is −x.
    expect(bed?.center.x).toBeCloseTo(10 - 0.1175);
    expect(bed?.center.z).toBeCloseTo(5);
    // Its collider dips 0.045 below the pivot; props stand on the datum.
    expect(bed?.center.y).toBeCloseTo(1.455 / 2);
    expect(bed?.size.y).toBeCloseTo(1.455);
    expect(bed?.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(bed).toMatchObject({ kind: 'prop', group: 'furniture', material: 'wood' });
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
          elevation: 0,
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

describe('boxesBounds', () => {
  it('bounds a tilted slab by its corners', () => {
    const slab = {
      center: { x: 0, y: 1, z: 0 },
      size: { x: 2, y: 0, z: 2 * Math.SQRT2 },
      rotationY: Math.PI / 2,
      tiltX: Math.PI / 4,
    } as PieceBox;
    const bounds = boxesBounds([slab])!;
    // Turned a quarter, the slab runs along x and drops 2 m over its 2 m run.
    expect(bounds.min.x).toBeCloseTo(-1);
    expect(bounds.max.x).toBeCloseTo(1);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(2);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(2);
  });
});
