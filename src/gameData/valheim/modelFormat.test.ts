import { describe, expect, it } from 'vitest';

import type { TextureData } from '../unity/texture2d';

import type { PrefabModel } from './extractModels';
import type { MaterialDesc } from './material';
import { decodeModel, decodeTexture, encodeModel, encodeTexture } from './modelFormat';

const material: MaterialDesc = {
  name: 'woodwall',
  color: [1, 1, 1, 1],
  albedo: '-8477877035390755812',
  normal: null,
  emission: null,
  emissionColor: [0, 0, 0, 1],
  uvST: [-0.56, 0.12, 0, 0.014],
  cutoff: null,
  doubleSided: false,
  metallic: 0,
  smoothness: 0.25,
};

describe('modelFormat', () => {
  it('round-trips a model, keeping absent attributes absent', () => {
    const model: PrefabModel = {
      name: 'woodwall',
      space: 'unity',
      parts: 2,
      bounds: { min: [-1, 0, -0.5], max: [1, 2, 0.5] },
      groups: [
        {
          materialId: '8290753221864760512',
          material,
          geometry: {
            positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1]),
            tangents: null,
            uv0: new Float32Array([0, 0, 1, 0, 0, 1]),
            indices: new Uint16Array([0, 1, 2]),
          },
        },
        {
          materialId: '1',
          material: { ...material, cutoff: 0.5, doubleSided: true },
          geometry: {
            positions: new Float32Array(3),
            normals: null,
            tangents: new Float32Array([1, 0, 0, -1]),
            uv0: null,
            indices: new Uint32Array([0, 0, 0]),
          },
        },
      ],
    };
    expect(decodeModel(encodeModel(model))).toEqual(model);
    expect(decodeModel(encodeModel(null))).toBeNull();
  });

  it('round-trips a texture with its mip chain', () => {
    const texture: TextureData = {
      name: 'Planks5c_low',
      width: 8,
      height: 8,
      format: 'bc1',
      srgb: true,
      mips: [new Uint8Array(32).fill(7), new Uint8Array(8).fill(3), new Uint8Array(8).fill(1)],
      filter: 0,
      wrap: [0, 1],
      aniso: 1,
    };
    expect(decodeTexture(encodeTexture(texture))).toEqual(texture);
  });

  it('rejects a buffer of another kind', () => {
    const texture = encodeTexture({
      name: 't',
      width: 1,
      height: 1,
      format: 'rgba8',
      srgb: false,
      mips: [new Uint8Array(4)],
      filter: 1,
      wrap: [0, 0],
      aniso: 1,
    });
    expect(() => decodeModel(texture)).toThrow(/texture, not a model/);
  });
});
