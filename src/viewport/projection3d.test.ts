import { describe, expect, it } from 'vitest';

import {
  project3d,
  pxPerMetreAt,
  screenRay,
  workPlanePoint,
  type Projection3d,
} from './projection3d';

const SIZE = { width: 800, height: 600 };

/** A camera `distance` from the origin, looking at it from +z, `elevationDeg` down. */
const view = (elevationDeg = 45, distance = Math.hypot(10, 10)): Projection3d => {
  const e = (elevationDeg * Math.PI) / 180;
  return {
    eye: { x: 0, y: distance * Math.sin(e), z: distance * Math.cos(e) },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: Math.cos(e), z: -Math.sin(e) },
    forward: { x: 0, y: -Math.sin(e), z: -Math.cos(e) },
    tanHalfFov: Math.tan(Math.PI / 8),
    aspect: SIZE.width / SIZE.height,
    size: SIZE,
    orbitDistance: distance,
  };
};

describe('projection3d', () => {
  it('round-trips ground points through their rays, the target at the canvas centre', () => {
    const v = view();
    expect(project3d({ x: 0, y: 0, z: 0 }, v)).toEqual({ x: 400, y: 300 });
    const s = project3d({ x: 3, y: 0, z: -2 }, v);
    expect(s).not.toBeNull();
    const p = s && workPlanePoint(s, v, 0);
    expect(p?.x).toBeCloseTo(3);
    expect(p?.z).toBeCloseTo(-2);
  });

  it('has no plane point above the horizon, and no screen point behind the eye', () => {
    // 10° down, the top of the canvas looks above the horizon.
    const low = view(10);
    expect(screenRay({ x: 400, y: 0 }, low).dir.y).toBeGreaterThan(0);
    expect(workPlanePoint({ x: 400, y: 0 }, low, 0)).toBeNull();
    // Just below the horizon, the plane is too far away to use.
    const horizon = 300 - 300 * (Math.tan((10 * Math.PI) / 180) / Math.tan(Math.PI / 8));
    expect(workPlanePoint({ x: 400, y: horizon + 1 }, low, 0)).toBeNull();
    expect(workPlanePoint({ x: 400, y: horizon + 60 }, low, 0)).not.toBeNull();
    expect(project3d({ x: 0, y: 20, z: 30 }, view())).toBeNull();
  });

  it('scales px per metre with depth', () => {
    const v = view();
    const atTarget = pxPerMetreAt({ x: 0, y: 0, z: 0 }, v);
    expect(atTarget).toBeCloseTo(300 / (v.orbitDistance * Math.tan(Math.PI / 8)));
    // A point at half the depth is drawn twice as large.
    expect(pxPerMetreAt({ x: 0, y: 5, z: 5 }, v)).toBeCloseTo(atTarget * 2);
  });
});
