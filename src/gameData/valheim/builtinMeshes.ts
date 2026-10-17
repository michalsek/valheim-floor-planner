/**
 * Unity's built-in primitives (`Library/unity default resources`), generated instead
 * of read: the planner opens no other bundle. Sizes match Unity's: a 1 m cube, a 1 m
 * quad in the XY plane facing −Z, a 10 m plane facing +Y, a 1 m sphere, and a cylinder
 * and capsule 1 m wide and 2 m tall. Triangles wind like Unity's: the cross product
 * (b − a) × (c − a) points out of the front face.
 */
import type { V3 } from '../unity/values';
import type { MeshData } from '../unity/mesh';

/** Path IDs in `unity default resources`. */
export const BUILTIN_MESHES = {
  cube: 10202,
  cylinder: 10206,
  sphere: 10207,
  capsule: 10208,
  plane: 10209,
  quad: 10210,
} as const;

interface Builder {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const SEGMENTS = 24;

const vertex = (b: Builder, p: V3, n: V3, u: number, v: number): number => {
  b.positions.push(...p);
  b.normals.push(...n);
  b.uvs.push(u, v);
  return b.positions.length / 3 - 1;
};

/** Adds a triangle facing its vertices' normals (degenerate ones as they come). */
const triangle = (b: Builder, i: number, j: number, k: number) => {
  const p = (index: number, axis: number) => b.positions[index * 3 + axis]!;
  const e1 = [0, 1, 2].map((a) => p(j, a) - p(i, a));
  const e2 = [0, 1, 2].map((a) => p(k, a) - p(i, a));
  const cross = [
    e1[1]! * e2[2]! - e1[2]! * e2[1]!,
    e1[2]! * e2[0]! - e1[0]! * e2[2]!,
    e1[0]! * e2[1]! - e1[1]! * e2[0]!,
  ];
  const facing = [0, 1, 2].reduce(
    (sum, a) =>
      sum + cross[a]! * (b.normals[i * 3 + a]! + b.normals[j * 3 + a]! + b.normals[k * 3 + a]!),
    0
  );
  b.indices.push(...(facing < 0 ? [i, k, j] : [i, j, k]));
};

/** A rectangle of size |a| × |b| centred at `c`, facing a × b. */
const rect = (b: Builder, c: V3, a: V3, d: V3, n: V3) => {
  const at = (s: number, t: number): V3 => [
    c[0] + (s * a[0] + t * d[0]) / 2,
    c[1] + (s * a[1] + t * d[1]) / 2,
    c[2] + (s * a[2] + t * d[2]) / 2,
  ];
  const i = vertex(b, at(-1, -1), n, 0, 0);
  vertex(b, at(1, -1), n, 1, 0);
  vertex(b, at(1, 1), n, 1, 1);
  vertex(b, at(-1, 1), n, 0, 1);
  triangle(b, i, i + 1, i + 2);
  triangle(b, i, i + 2, i + 3);
};

/** Profile points [radius, y, normal radius, normal y], revolved about Y. */
type Band = readonly [number, number, number, number][];

const lathe = (b: Builder, bands: readonly Band[]) => {
  for (const band of bands) {
    const start = b.positions.length / 3;
    band.forEach(([r, y, nr, ny], j) => {
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = (2 * Math.PI * i) / SEGMENTS;
        const [cos, sin] = [Math.cos(t), Math.sin(t)];
        vertex(
          b,
          [r * cos, y, r * sin],
          [nr * cos, ny, nr * sin],
          i / SEGMENTS,
          j / (band.length - 1)
        );
      }
    });
    const row = SEGMENTS + 1;
    for (let j = 0; j + 1 < band.length; j++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const v = start + j * row + i;
        triangle(b, v, v + row, v + row + 1);
        triangle(b, v, v + row + 1, v + 1);
      }
    }
  }
};

/** A sphere's profile from pole to pole, its centre shifted by `lift(latitude)`. */
const arc = (radius: number, rings: number, lift: (latitude: number) => number): Band =>
  Array.from({ length: rings + 1 }, (_, j) => {
    const latitude = -Math.PI / 2 + (Math.PI * j) / rings;
    const [cos, sin] = [Math.cos(latitude), Math.sin(latitude)];
    return [radius * cos, radius * sin + lift(latitude), cos, sin] as const;
  });

const BUILDERS: Readonly<Record<number, (b: Builder) => void>> = {
  [BUILTIN_MESHES.cube]: (b) => {
    for (const [n, a, d] of [
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      [
        [-1, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
      [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ],
      [
        [0, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, -1],
        [0, 1, 0],
        [1, 0, 0],
      ],
    ] as [V3, V3, V3][]) {
      rect(b, [n[0] / 2, n[1] / 2, n[2] / 2], a, d, n);
    }
  },
  [BUILTIN_MESHES.quad]: (b) => rect(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1]),
  [BUILTIN_MESHES.plane]: (b) => rect(b, [0, 0, 0], [0, 0, 10], [10, 0, 0], [0, 1, 0]),
  [BUILTIN_MESHES.sphere]: (b) => lathe(b, [arc(0.5, 16, () => 0)]),
  [BUILTIN_MESHES.capsule]: (b) => lathe(b, [arc(0.5, 16, (lat) => (lat < 0 ? -0.5 : 0.5))]),
  [BUILTIN_MESHES.cylinder]: (b) =>
    lathe(b, [
      [
        [0, -1, 0, -1],
        [0.5, -1, 0, -1],
      ],
      [
        [0.5, -1, 1, 0],
        [0.5, 1, 1, 0],
      ],
      [
        [0.5, 1, 0, 1],
        [0, 1, 0, 1],
      ],
    ]),
};

const boundsOf = (positions: readonly number[]): MeshData['bounds'] => {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3]!, positions[i]!);
    max[i % 3] = Math.max(max[i % 3]!, positions[i]!);
  }
  return { min, max };
};

/** The built-in mesh with this path ID, or null for one the planner doesn't know. */
export const builtinMesh = (pathId: number): MeshData | null => {
  const build = BUILDERS[pathId];
  if (!build) return null;
  const b: Builder = { positions: [], normals: [], uvs: [], indices: [] };
  build(b);
  return {
    name: `builtin${pathId}`,
    vertexCount: b.positions.length / 3,
    positions: new Float32Array(b.positions),
    normals: new Float32Array(b.normals),
    tangents: null,
    uv0: new Float32Array(b.uvs),
    indices: new Uint16Array(b.indices),
    submeshes: [{ start: 0, count: b.indices.length, baseVertex: 0, topology: 0 }],
    bounds: boundsOf(b.positions),
    streamed: false,
    normalFormat: 0,
  };
};
