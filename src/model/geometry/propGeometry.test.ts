import { describe, expect, it } from 'vitest';

import type { LocalRect } from '../../catalog/propDefs';
import { testLibrary } from '../../catalog/testLibrary';

import {
  placementPosition,
  pointInProp,
  propBoxTest,
  propCentre,
  propCorners,
  rotateAboutCentre,
} from './propGeometry';

/** The workbench: 3.01 × 1.1, centred on its pivot. */
const BENCH: LocalRect = { minX: -1.505, maxX: 1.505, minZ: -0.55, maxZ: 0.55 };
/** Offset from its pivot, like the stonecutter. */
const OFFSET: LocalRect = { minX: -1, maxX: 3, minZ: 0, maxZ: 1 };
const origin = { x: 0, z: 0 };

const close = (p: { x: number; z: number }, x: number, z: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.z).toBeCloseTo(z, 6);
};

describe('propGeometry', () => {
  it('turns corners clockwise on screen', () => {
    const [a, b] = propCorners(origin, 0, OFFSET);
    close(a!, -1, 0);
    close(b!, 3, 0);
    const [c, d] = propCorners(origin, 90, OFFSET);
    close(c!, 0, -1);
    close(d!, 0, 3);
  });

  it('snaps poles by their axis and beams by their ends, and turns poles about the axis', () => {
    const pole = testLibrary.propDefs.get('wood_pole_log')!;
    const polePos = placementPosition({ x: 3.9, z: 0.1 }, 0, pole.rect, 0.5, pole.snap);
    close(polePos, 4, 0);
    const turned = rotateAboutCentre(
      { position: polePos, rotation: 0 },
      pole.rect,
      90,
      pole.snap!.centre
    );
    close(turned.position, 4, 0);
    // A beam turned 90° runs along z: centred near the cursor, its end (snap point
    // x = −1) on the grid point (1, −1), so it spans z −1…1 on the line x = 1.
    const beam = testLibrary.propDefs.get('wood_beam')!;
    close(placementPosition({ x: 1.1, z: 0.1 }, 90, beam.rect, 1, beam.snap), 1, 0);
  });

  it('snaps the minimum corner at right angles and the centre otherwise', () => {
    const at0 = placementPosition({ x: 0.1, z: 0.1 }, 0, BENCH, 0.5);
    const [min0] = propCorners(at0, 0, BENCH);
    close(min0!, -1.5, -0.5);
    const at90 = placementPosition({ x: 0.1, z: 0.1 }, 90, BENCH, 0.5);
    const xs = propCorners(at90, 90, BENCH).map((p) => p.x);
    const zs = propCorners(at90, 90, BENCH).map((p) => p.z);
    close({ x: Math.min(...xs), z: Math.min(...zs) }, -0.5, -1.5);
    const at22 = placementPosition({ x: 0.3, z: 0.6 }, 22.5, OFFSET, 0.5);
    close(propCentre(at22, 22.5, OFFSET), 0.5, 0.5);
    close(placementPosition({ x: 0.3, z: 0.6 }, 0, BENCH, null), 0.3, 0.6);
  });

  it('rotates about the centre; four quarter turns restore the pivot', () => {
    let prop = { position: { x: 2, z: 1 }, rotation: 0 };
    const centre = propCentre(prop.position, prop.rotation, OFFSET);
    for (let i = 0; i < 4; i++) {
      prop = rotateAboutCentre(prop, OFFSET, 90);
      close(propCentre(prop.position, prop.rotation, OFFSET), centre.x, centre.z);
    }
    expect(prop).toEqual({ position: { x: 2, z: 1 }, rotation: 0 });
    expect(rotateAboutCentre(prop, OFFSET, -22.5).rotation).toBe(337.5);
  });

  it('hits points on a rotated footprint', () => {
    expect(pointInProp({ x: 0, z: 2.5 }, origin, 90, OFFSET, 0)).toBe(true);
    expect(pointInProp({ x: 2.5, z: 0 }, origin, 90, OFFSET, 0)).toBe(false);
    expect(pointInProp({ x: 0.55, z: 0 }, origin, 0, BENCH, 0.1)).toBe(true);
  });

  it('box-tests contain and touch, including a box inside the footprint', () => {
    const corners = propCorners(origin, 45, BENCH);
    const big = { min: { x: -2, z: -2 }, max: { x: 2, z: 2 } };
    const inside = { min: { x: -0.1, z: -0.1 }, max: { x: 0.1, z: 0.1 } };
    const corner = { min: { x: 1, z: -1.1 }, max: { x: 1.2, z: -0.9 } };
    expect(propBoxTest(corners, big, 'contain')).toBe(true);
    expect(propBoxTest(corners, inside, 'contain')).toBe(false);
    expect(propBoxTest(corners, inside, 'touch')).toBe(true);
    // Inside the footprint's bounding box but off the rotated footprint.
    expect(propBoxTest(corners, corner, 'touch')).toBe(false);
  });
});
