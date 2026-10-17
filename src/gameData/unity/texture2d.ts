/**
 * Unity Texture2D objects: the pixel data of every mip level, still block-compressed
 * (BC data is uploaded as is). Rows stay bottom-up as Unity stores them, which matches
 * raw UVs with `flipY = false`. Crunched, array and cube textures are not read.
 */
import { check } from '../GameDataError';

import type { ResourceReader } from './streamingInfo';
import { streamingInfo } from './streamingInfo';
import { fields, num, str, type Fields } from './values';

export type TextureFormat = 'bc1' | 'bc3' | 'bc7' | 'rgba8';

export interface TextureData {
  name: string;
  width: number;
  height: number;
  format: TextureFormat;
  /** Albedo is sRGB; normal maps and masks are linear. */
  srgb: boolean;
  /** Level 0 first. */
  mips: Uint8Array[];
  /** `FilterMode`: 0 point (most Valheim textures), 1 bilinear, 2 trilinear. */
  filter: number;
  /** `TextureWrapMode` for U and V: 0 repeat, 1 clamp, 2 mirror, 3 mirror once. */
  wrap: [u: number, v: number];
  aniso: number;
}

/** `TextureFormat` values read, with bytes per 4×4 block (or per pixel for raw ones). */
const BLOCK_FORMATS: Readonly<Record<number, [TextureFormat, number]>> = {
  10: ['bc1', 8], // DXT1
  12: ['bc3', 16], // DXT5
  25: ['bc7', 16], // BC7
};
const RGB24 = 3;
const RGBA32 = 4;
const ARGB32 = 5;
const RAW_SIZE: Readonly<Record<number, number>> = { [RGB24]: 3, [RGBA32]: 4, [ARGB32]: 4 };

/** Bytes of one mip level. */
const levelSize = (format: number, width: number, height: number): number => {
  const block = BLOCK_FORMATS[format];
  if (block) return Math.ceil(width / 4) * Math.ceil(height / 4) * block[1];
  return width * height * RAW_SIZE[format]!;
};

/** RGB24 / ARGB32 → RGBA8. */
const toRgba = (bytes: Uint8Array, format: number): Uint8Array => {
  if (format === RGBA32) return bytes;
  const pixels = bytes.length / RAW_SIZE[format]!;
  const out = new Uint8Array(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    if (format === RGB24) {
      out.set(bytes.subarray(i * 3, i * 3 + 3), i * 4);
      out[i * 4 + 3] = 255;
    } else {
      out.set(bytes.subarray(i * 4 + 1, i * 4 + 4), i * 4);
      out[i * 4 + 3] = bytes[i * 4]!;
    }
  }
  return out;
};

/** The sizes of a full or partial mip chain. */
export const mipSizes = (format: number, width: number, height: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) =>
    levelSize(format, Math.max(1, width >> i), Math.max(1, height >> i))
  );

/** Decodes a Texture2D read through its type tree; null for formats not read. */
export const readTexture = (texture: Fields, res: ResourceReader): TextureData | null => {
  const format = num(texture.m_TextureFormat, 'm_TextureFormat');
  const block = BLOCK_FORMATS[format];
  if (!block && RAW_SIZE[format] === undefined) return null;
  if (num(texture.m_ImageCount, 'm_ImageCount') !== 1) return null;
  if (num(texture.m_TextureDimension, 'm_TextureDimension') !== 2) return null;

  const name = str(texture.m_Name, 'm_Name');
  const width = num(texture.m_Width, 'm_Width');
  const height = num(texture.m_Height, 'm_Height');
  const sizes = mipSizes(format, width, height, Math.max(1, num(texture.m_MipCount, 'm_MipCount')));
  const stream = streamingInfo(texture.m_StreamData, 'm_StreamData');
  const data = stream ? res(stream) : texture['image data'];
  check(data instanceof Uint8Array, () => `texture ${name}: no image data`);
  check(
    sizes.reduce((a, b) => a + b, 0) <= data.length,
    () => `texture ${name}: ${data.length} bytes, mips need more`
  );

  let at = 0;
  const mips = sizes.map((size) => {
    const level = data.slice(at, at + size);
    at += size;
    return block ? level : toRgba(level, format);
  });
  const settings = fields(texture.m_TextureSettings, 'm_TextureSettings');
  return {
    name,
    width,
    height,
    format: block ? block[0] : 'rgba8',
    srgb: num(texture.m_ColorSpace, 'm_ColorSpace') === 1,
    mips,
    filter: num(settings.m_FilterMode, 'm_FilterMode'),
    wrap: [num(settings.m_WrapU, 'm_WrapU'), num(settings.m_WrapV, 'm_WrapV')],
    aniso: num(settings.m_Aniso, 'm_Aniso'),
  };
};
