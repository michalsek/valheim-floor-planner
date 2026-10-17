/**
 * Which block-compressed formats the renderer can sample. WebGPU's
 * `texture-compression-bc` covers BC1, BC3 and BC7 with their sRGB variants. On
 * WebGL2 that feature name means BPTC (BC7) only; S3TC (BC1, BC3) is its own
 * extension, and sRGB S3TC another.
 */
import type { TextureFormat } from '../../../gameData/unity/texture2d';
import type { WebGPURenderer } from 'three/webgpu';

export interface BcSupport {
  bc1: boolean;
  bc3: boolean;
  bc7: boolean;
  /** sRGB S3TC (sRGB BC7 comes with BC7). */
  s3tcSrgb: boolean;
}

interface Extensions {
  has(name: string): boolean;
}

const glExtensions = (renderer: WebGPURenderer): Extensions | null => {
  const backend = renderer.backend as unknown as { extensions?: Extensions };
  return backend.extensions ?? null;
};

export const bcSupport = (renderer: WebGPURenderer): BcSupport => {
  const bc = renderer.hasFeature('texture-compression-bc');
  const gl = glExtensions(renderer);
  if (!gl) return { bc1: bc, bc3: bc, bc7: bc, s3tcSrgb: bc };
  const s3tc = gl.has('WEBGL_compressed_texture_s3tc');
  return {
    bc1: s3tc,
    bc3: s3tc,
    bc7: bc,
    s3tcSrgb: s3tc && gl.has('WEBGL_compressed_texture_s3tc_srgb'),
  };
};

/** Whether a texture of `format` (sRGB or linear) can be uploaded as is. */
export const canSample = (support: BcSupport, format: TextureFormat, srgb: boolean): boolean => {
  switch (format) {
    case 'rgba8':
      return true;
    case 'bc7':
      return support.bc7;
    case 'bc1':
    case 'bc3':
      return support[format] && (!srgb || support.s3tcSrgb);
  }
};
