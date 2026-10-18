import { describe, expect, it } from 'vitest';

import { normalizeVec3, pickBoxes, rayBox, rayPiece, rayPieceHit, type Ray3 } from './ray';

const down = (x: number, z: number): Ray3 => ({
  origin: { x, y: 10, z },
  dir: { x: 0, y: -1, z: 0 },
});

const unit = { center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotationY: 0 };

describe('rayBox', () => {
  it('enters through the top face, and misses beside the box', () => {
    expect(rayBox(down(0.2, -0.3), unit)).toBeCloseTo(9);
    expect(rayBox(down(0.6, 0), unit)).toBeNull();
  });

  it('tests a turned prop in its own frame', () => {
    // A 4 × 1 box turned 30° counter-clockwise (seen from above): its length axis runs
    // along (cos 30°, −sin 30°) on the plan.
    const turned = {
      center: { x: 10, y: 1, z: 5 },
      size: { x: 4, y: 2, z: 1 },
      rotationY: Math.PI / 6,
    };
    const along = (t: number) =>
      down(10 + t * Math.cos(Math.PI / 6), 5 - t * Math.sin(Math.PI / 6));
    expect(rayBox(along(1.8), turned)).toBeCloseTo(8);
    // The mirror image (the turn's sign flipped) is off the box.
    expect(
      rayBox(down(10 + 1.8 * Math.cos(Math.PI / 6), 5 + 1.8 * Math.sin(Math.PI / 6)), turned)
    ).toBeNull();
  });

  it('ignores a box the ray starts inside', () => {
    const ray = { origin: { x: 0, y: 0.5, z: 0 }, dir: normalizeVec3({ x: 1, y: 0, z: 1 }) };
    expect(rayBox(ray, unit)).toBeNull();
  });
});

describe('tilted boxes and shapes', () => {
  // A 2 × 0.1 × 2 slab tilted 45° down towards +z: its top runs from y 1 (z −1) to −1 (z 1).
  const slab = {
    center: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 0.1, z: 2 * Math.SQRT2 },
    rotationY: 0,
    tiltX: Math.PI / 4,
  };

  it('hits a tilted slab where its surface is, and misses past its end on the plan', () => {
    expect(rayBox(down(0, 0.5), slab)).toBeCloseTo(10.5 - 0.05 * Math.SQRT2, 3);
    expect(rayBox(down(0, 1.2), slab)).toBeNull();
  });

  it('hits a hip corner on its sloped top, and misses the empty part of its box', () => {
    // High at local (−x, −z): 2 m cell, 1 m rise, centred at y 0.5.
    const corner = {
      center: { x: 0, y: 0.5, z: 0 },
      size: { x: 2, y: 1, z: 2 },
      rotationY: 0,
      shape: 'hipCorner' as const,
    };
    // Over the middle of the cell the top is halfway up (y 0.5).
    expect(rayPiece(down(0, 0), corner)).toBeCloseTo(9.5);
    // Beside the low corner the top is near the bottom; the box would have been hit at its top.
    expect(rayPiece(down(0.9, 0.9), corner)).toBeCloseTo(10 - 0.05, 1);
    expect(rayPiece(down(3, 0), corner)).toBeNull();
  });
});

describe('rayPieceHit normals', () => {
  const close = (v: { x: number; y: number; z: number }) =>
    [v.x, v.y, v.z].map((c) => Math.round(c * 1e6) / 1e6 + 0);

  it('gives each face of a turned box its world normal', () => {
    // Turned 90° counter-clockwise: local +x points to world −z, local +z to world +x.
    const box = {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      rotationY: Math.PI / 2,
    };
    for (const n of [
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
    ]) {
      const ray = {
        origin: { x: 5 * n.x, y: 5 * n.y, z: 5 * n.z },
        dir: { x: -n.x, y: -n.y, z: -n.z },
      };
      const hit = rayPieceHit(ray, box);
      expect(hit?.t).toBeCloseTo(4.5);
      expect(close(hit!.normal)).toEqual(close(n));
    }
  });

  it("gives a ridge's slopes their normals, facing the ray", () => {
    // 2 m across, 1 m rise: each slope at 45°, low at z ±1, the ridge at z 0.
    const ridge = {
      center: { x: 0, y: 0.5, z: 0 },
      size: { x: 2, y: 1, z: 2 },
      rotationY: 0,
      shape: 'ridge' as const,
    };
    const s = Math.SQRT1_2;
    expect(close(rayPieceHit(down(0, -0.5), ridge)!.normal)).toEqual(close({ x: 0, y: s, z: -s }));
    expect(close(rayPieceHit(down(0, 0.5), ridge)!.normal)).toEqual(close({ x: 0, y: s, z: s }));
  });
});

describe('pickBoxes', () => {
  it('takes the nearest box along the ray', () => {
    const ray = { origin: { x: -10, y: 0.5, z: 0 }, dir: { x: 1, y: 0, z: 0 } };
    const far = { ...unit, center: { x: 5, y: 0.5, z: 0 }, id: 'far' };
    const near = { ...unit, center: { x: 2, y: 0.5, z: 0 }, id: 'near' };
    const hit = pickBoxes(ray, [far, near]);
    expect(hit?.box.id).toBe('near');
    expect(hit?.t).toBeCloseTo(11.5);
  });
});
