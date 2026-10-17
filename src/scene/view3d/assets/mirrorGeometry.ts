/**
 * Models in planner space: the game's meshes mirrored in z, as the catalogue is (see
 * `catalog/pieceDefs.ts`). Positions, normals and tangents negate z, tangents' w (the
 * bitangent's sign) flips, and every triangle's winding reverses so front faces stay
 * front. Done as models load, on a copy (the cache keeps the game's own data), once
 * per geometry.
 */
import type { Geometry } from '../../../gameData/valheim/bakeModel';

const mirrored = new WeakMap<Geometry, Geometry>();

const negateZ = (values: Float32Array, stride: number, flipW: boolean): Float32Array => {
  const out = values.slice();
  for (let i = 0; i < out.length; i += stride) {
    out[i + 2] = -out[i + 2]!;
    if (flipW) out[i + 3] = -out[i + 3]!;
  }
  return out;
};

const reverseWinding = (indices: Uint16Array | Uint32Array): Uint16Array | Uint32Array => {
  const out = indices.slice();
  for (let i = 0; i + 2 < out.length; i += 3) {
    const b = out[i + 1]!;
    out[i + 1] = out[i + 2]!;
    out[i + 2] = b;
  }
  return out;
};

export const mirrorGeometry = (geometry: Geometry): Geometry => {
  let result = mirrored.get(geometry);
  if (!result) {
    result = {
      positions: negateZ(geometry.positions, 3, false),
      normals: geometry.normals && negateZ(geometry.normals, 3, false),
      tangents: geometry.tangents && negateZ(geometry.tangents, 4, true),
      uv0: geometry.uv0,
      indices: reverseWinding(geometry.indices),
    };
    mirrored.set(geometry, result);
  }
  return result;
};
