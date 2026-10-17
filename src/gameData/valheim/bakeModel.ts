/**
 * Bakes a prefab's render parts into prefab space and merges them by material, so a
 * piece draws with one call per material:
 * - positions by the part's matrix, normals by its inverse transpose, tangents by its
 *   3×3 part; a mirroring matrix (negative determinant) flips the winding and the
 *   tangents' w;
 * - each submesh contributes the vertex range its indices use;
 * - extra submeshes (more than materials) aren't drawn; extra materials are ignored;
 * - an attribute is kept only when every merged part has it;
 * - indices become 32-bit once a group passes 65,535 vertices.
 */
import type { Bounds, MeshData } from '../unity/mesh';
import type { V3 } from '../unity/values';

import type { Mat4 } from './hierarchy';

export interface Geometry {
  positions: Float32Array;
  normals: Float32Array | null;
  tangents: Float32Array | null;
  uv0: Float32Array | null;
  indices: Uint16Array | Uint32Array;
}

export interface BakePart {
  mesh: MeshData;
  matrix: Mat4;
  /** Material per submesh (an ID), null where it isn't drawn. */
  materials: readonly (string | null)[];
}

export interface BakedGroup {
  material: string;
  geometry: Geometry;
}

/** A submesh's share of a group. */
interface Piece {
  part: BakePart;
  start: number;
  count: number;
  baseVertex: number;
  /** First and last vertex the submesh uses (base vertex applied). */
  first: number;
  last: number;
}

const TRIANGLES = 0;
const MAX_16_BIT_VERTICES = 65535;

const piecesByMaterial = (parts: readonly BakePart[]): Map<string, Piece[]> => {
  const groups = new Map<string, Piece[]>();
  for (const part of parts) {
    const { submeshes, indices } = part.mesh;
    const drawn = Math.min(submeshes.length, part.materials.length);
    for (let s = 0; s < drawn; s++) {
      const material = part.materials[s];
      const { start, count, baseVertex, topology } = submeshes[s]!;
      if (material === null || material === undefined || topology !== TRIANGLES || count < 3) {
        continue;
      }
      let first = Infinity;
      let last = -Infinity;
      for (let i = start; i < start + count; i++) {
        first = Math.min(first, indices[i]!);
        last = Math.max(last, indices[i]!);
      }
      const piece = {
        part,
        start,
        count,
        baseVertex,
        first: first + baseVertex,
        last: last + baseVertex,
      };
      if (piece.last >= part.mesh.vertexCount) continue;
      const group = groups.get(material);
      if (group) group.push(piece);
      else groups.set(material, [piece]);
    }
  }
  return groups;
};

/** The normal matrix of a row-major 4×4 matrix (up to scale), and whether it mirrors. */
const linear = (m: Mat4) => {
  const [a, b, c, d, e, f, g, h, i] = [
    m[0]!,
    m[1]!,
    m[2]!,
    m[4]!,
    m[5]!,
    m[6]!,
    m[8]!,
    m[9]!,
    m[10]!,
  ];
  const cofactors = [
    e * i - f * h,
    f * g - d * i,
    d * h - e * g,
    c * h - b * i,
    a * i - c * g,
    b * g - a * h,
    b * f - c * e,
    c * d - a * f,
    a * e - b * d,
  ];
  const mirrored = a * cofactors[0]! + b * cofactors[1]! + c * cofactors[2]! < 0;
  // The inverse transpose is cofactors / det; only its direction matters.
  return { normalMatrix: mirrored ? cofactors.map((x) => -x) : cofactors, mirrored };
};

/** Writes `m · v` (3×3, row-major `m` of 9) normalized to `out` at `at`. */
const writeDirection = (
  out: Float32Array,
  at: number,
  m: readonly number[],
  v: ArrayLike<number>
) => {
  const x = m[0]! * v[0]! + m[1]! * v[1]! + m[2]! * v[2]!;
  const y = m[3]! * v[0]! + m[4]! * v[1]! + m[5]! * v[2]!;
  const z = m[6]! * v[0]! + m[7]! * v[1]! + m[8]! * v[2]!;
  const length = Math.hypot(x, y, z) || 1;
  out[at] = x / length;
  out[at + 1] = y / length;
  out[at + 2] = z / length;
};

const bakeGroup = (pieces: readonly Piece[]): Geometry => {
  const vertexCount = pieces.reduce((sum, p) => sum + p.last - p.first + 1, 0);
  const indexCount = pieces.reduce((sum, p) => sum + p.count, 0);
  const all = (has: (mesh: MeshData) => boolean) => pieces.every((p) => has(p.part.mesh));
  const geometry: Geometry = {
    positions: new Float32Array(vertexCount * 3),
    normals: all((m) => m.normals !== null) ? new Float32Array(vertexCount * 3) : null,
    tangents: all((m) => m.tangents !== null) ? new Float32Array(vertexCount * 4) : null,
    uv0: all((m) => m.uv0 !== null) ? new Float32Array(vertexCount * 2) : null,
    indices:
      vertexCount > MAX_16_BIT_VERTICES ? new Uint32Array(indexCount) : new Uint16Array(indexCount),
  };

  let vertexAt = 0;
  let indexAt = 0;
  for (const { part, start, count, baseVertex, first, last } of pieces) {
    const { mesh, matrix: m } = part;
    const { normalMatrix, mirrored } = linear(m);
    const rotation = [m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!];
    for (let v = first; v <= last; v++) {
      const out = vertexAt + v - first;
      const [x, y, z] = [
        mesh.positions[v * 3]!,
        mesh.positions[v * 3 + 1]!,
        mesh.positions[v * 3 + 2]!,
      ];
      geometry.positions[out * 3] = m[0]! * x + m[1]! * y + m[2]! * z + m[3]!;
      geometry.positions[out * 3 + 1] = m[4]! * x + m[5]! * y + m[6]! * z + m[7]!;
      geometry.positions[out * 3 + 2] = m[8]! * x + m[9]! * y + m[10]! * z + m[11]!;
      if (geometry.normals) {
        writeDirection(
          geometry.normals,
          out * 3,
          normalMatrix,
          mesh.normals!.subarray(v * 3, v * 3 + 3)
        );
      }
      if (geometry.tangents) {
        const t = mesh.tangents!.subarray(v * 4, v * 4 + 4);
        writeDirection(geometry.tangents, out * 4, rotation, t);
        geometry.tangents[out * 4 + 3] = mirrored ? -t[3]! : t[3]!;
      }
      if (geometry.uv0) geometry.uv0.set(mesh.uv0!.subarray(v * 2, v * 2 + 2), out * 2);
    }
    const shift = vertexAt - first + baseVertex;
    for (let i = 0; i + 2 < count; i += 3) {
      const [a, b, c] = [
        mesh.indices[start + i]!,
        mesh.indices[start + i + 1]!,
        mesh.indices[start + i + 2]!,
      ];
      geometry.indices.set(
        mirrored ? [a + shift, c + shift, b + shift] : [a + shift, b + shift, c + shift],
        indexAt + i
      );
    }
    vertexAt += last - first + 1;
    indexAt += count;
  }
  return geometry;
};

const boundsOf = (groups: readonly BakedGroup[]): Bounds => {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const { geometry } of groups) {
    const p = geometry.positions;
    for (let i = 0; i < p.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, p[i]!);
      max[i % 3] = Math.max(max[i % 3]!, p[i]!);
    }
  }
  return { min, max };
};

/** The parts' geometry by material, or null when nothing is drawn. */
export const bakeModel = (
  parts: readonly BakePart[]
): { groups: BakedGroup[]; bounds: Bounds } | null => {
  const groups = [...piecesByMaterial(parts)].map(([material, pieces]) => ({
    material,
    geometry: bakeGroup(pieces),
  }));
  return groups.length === 0 ? null : { groups, bounds: boundsOf(groups) };
};
