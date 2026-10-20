import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { boxesBounds, pieceBoxes, type PieceBox } from './pieceBoxes';
import { emptyPlan, type Plan } from './types';

const boxesOf = (parts: Partial<Plan>) => pieceBoxes({ ...emptyPlan(), ...parts }, testLibrary);

describe('pieceBoxes', () => {
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
    // The game's collider spans z −1.6…1.835, so the planner's (mirrored) spans
    // −1.835…1.6 (centre −0.1175); turned 90° clockwise, local +z is −x.
    expect(bed?.center.x).toBeCloseTo(10 + 0.1175);
    expect(bed?.center.z).toBeCloseTo(5);
    // Its collider dips 0.045 below the pivot; props stand on the datum.
    expect(bed?.center.y).toBeCloseTo(1.455 / 2);
    expect(bed?.size.y).toBeCloseTo(1.455);
    expect(bed?.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(bed).toMatchObject({ kind: 'prop', group: 'furniture', material: 'wood' });
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
