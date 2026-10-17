/**
 * Extracted model data as three.js objects: textures with their own mip chains
 * (block-compressed data uploaded as is), and an instanced geometry per draw.
 */
import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  CompressedTexture,
  DataTexture,
  InstancedBufferAttribute,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapNearestFilter,
  NoColorSpace,
  RepeatWrapping,
  RGB_S3TC_DXT1_Format,
  RGBA_BPTC_Format,
  RGBA_S3TC_DXT5_Format,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type CompressedPixelFormat,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  type Texture,
  type Wrapping,
} from 'three/webgpu';

import type { TextureData } from '../../../gameData/unity/texture2d';
import type { Geometry } from '../../../gameData/valheim/bakeModel';

import { mirrorGeometry } from './mirrorGeometry';
import { MATRIX_ATTRIBUTES, TINT_ATTRIBUTE } from './realMaterial';

const BLOCK_FORMATS: Record<'bc1' | 'bc3' | 'bc7', CompressedPixelFormat> = {
  bc1: RGB_S3TC_DXT1_Format,
  bc3: RGBA_S3TC_DXT5_Format,
  bc7: RGBA_BPTC_Format,
};

/** Unity `TextureWrapMode`: repeat, clamp, mirror, mirror once (taken as mirror). */
const WRAPS: readonly Wrapping[] = [
  RepeatWrapping,
  ClampToEdgeWrapping,
  MirroredRepeatWrapping,
  MirroredRepeatWrapping,
];

/** Unity `FilterMode`: 0 point (Valheim's pixel look), 1 bilinear, 2 trilinear. */
const filters = (mode: number): [MagnificationTextureFilter, MinificationTextureFilter] => {
  if (mode === 0) return [NearestFilter, NearestMipmapNearestFilter];
  return [LinearFilter, mode === 1 ? LinearMipmapNearestFilter : LinearMipmapLinearFilter];
};

const levelSize = (size: number, level: number) => Math.max(1, size >> level);

/**
 * A texture from extracted data, uploaded with its mips and rows as stored: Unity
 * keeps rows bottom-up, which matches raw UVs without a flip.
 */
export const createTexture = (data: TextureData): Texture => {
  const { width, height, mips } = data;
  const levels = mips.map((mip, i) => ({
    data: mip,
    width: levelSize(width, i),
    height: levelSize(height, i),
  }));
  let texture: Texture;
  if (data.format === 'rgba8') {
    texture = new DataTexture(mips[0], width, height, RGBAFormat, UnsignedByteType);
    texture.mipmaps = levels;
  } else {
    texture = new CompressedTexture(levels, width, height, BLOCK_FORMATS[data.format]);
  }
  const [mag, min] = filters(data.filter);
  texture.name = data.name;
  texture.colorSpace = data.srgb ? SRGBColorSpace : NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.magFilter = mag;
  texture.minFilter = min;
  texture.wrapS = WRAPS[data.wrap[0]] ?? RepeatWrapping;
  texture.wrapT = WRAPS[data.wrap[1]] ?? RepeatWrapping;
  texture.anisotropy = data.filter === 0 ? 1 : Math.max(1, data.aniso);
  texture.needsUpdate = true;
  return texture;
};

/**
 * A draw's own geometry over a model group's arrays, mirrored into planner space once
 * (`mirrorGeometry`), with room for `capacity` instances: their matrices
 * (`MATRIX_ATTRIBUTES`, one interleaved buffer, see `instanceMatrices`) and tints.
 * Disposing it frees its GPU buffers.
 */
export const createInstancedGeometry = (raw: Geometry, capacity: number): BufferGeometry => {
  const geometry = mirrorGeometry(raw);
  const result = new BufferGeometry();
  result.setIndex(new BufferAttribute(geometry.indices, 1));
  result.setAttribute('position', new BufferAttribute(geometry.positions, 3));
  if (geometry.normals) result.setAttribute('normal', new BufferAttribute(geometry.normals, 3));
  if (geometry.tangents) result.setAttribute('tangent', new BufferAttribute(geometry.tangents, 4));
  if (geometry.uv0) result.setAttribute('uv', new BufferAttribute(geometry.uv0, 2));
  const matrices = new InstancedInterleavedBuffer(new Float32Array(capacity * 16), 16, 1);
  MATRIX_ATTRIBUTES.forEach((name, column) =>
    result.setAttribute(name, new InterleavedBufferAttribute(matrices, 4, column * 4))
  );
  const tints = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  result.setAttribute(TINT_ATTRIBUTE, tints);
  if (!geometry.normals) result.computeVertexNormals();
  result.computeBoundingSphere();
  return result;
};

/** The interleaved buffer holding a geometry's instance matrices (column-major, 16 floats each). */
export const instanceMatrices = (geometry: BufferGeometry): InstancedInterleavedBuffer =>
  (geometry.getAttribute(MATRIX_ATTRIBUTES[0]) as InterleavedBufferAttribute)
    .data as InstancedInterleavedBuffer;
