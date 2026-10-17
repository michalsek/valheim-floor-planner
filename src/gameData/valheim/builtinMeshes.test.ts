import { describe, expect, it } from 'vitest';

import { BUILTIN_MESHES, builtinMesh } from './builtinMeshes';

describe('builtinMesh', () => {
  it('makes the quad 1 m in the XY plane, facing −Z like Unity', () => {
    const quad = builtinMesh(BUILTIN_MESHES.quad)!;
    expect(quad.bounds).toEqual({ min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] });
    expect([...quad.normals!]).toEqual(Array.from({ length: 4 }, () => [0, 0, -1]).flat());
    const p = (i: number) => [...quad.positions.subarray(i * 3, i * 3 + 3)];
    for (let t = 0; t < quad.indices.length; t += 3) {
      const [a, b, c] = [p(quad.indices[t]!), p(quad.indices[t + 1]!), p(quad.indices[t + 2]!)];
      const [ux, uy] = [b[0]! - a[0]!, b[1]! - a[1]!];
      const [vx, vy] = [c[0]! - a[0]!, c[1]! - a[1]!];
      expect(ux * vy - uy * vx).toBeLessThan(0); // (b − a) × (c − a) points to −Z
    }
  });
});
