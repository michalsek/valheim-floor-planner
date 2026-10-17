/**
 * The material real piece models are drawn with, from a Valheim material's saved
 * properties (`MaterialDesc`): albedo × `_Color` through the `_MainTex` scale and
 * offset, the normal map (Unity's DXT5nm or plain RGB), emission, cutout, culling and
 * smoothness.
 * Each instance mixes its colour towards its tint (`TINT_ATTRIBUTE`, rgb + amount), for
 * selection, hover, support and levels.
 */
import {
  attribute,
  dot,
  float,
  max,
  mix,
  normalMap,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  Color,
  DoubleSide,
  FrontSide,
  MeshStandardNodeMaterial,
  SRGBColorSpace,
  Vector4,
  type Texture,
} from 'three/webgpu';

import type { MaterialDesc, Rgba } from '../../../gameData/valheim/material';

/** The per-instance tint attribute: linear rgb, and how far to mix towards it. */
export const TINT_ATTRIBUTE = 'tint';

export interface RealMaterialOptions {
  desc: MaterialDesc;
  /** Null where the texture is missing or can't be sampled (`_Color` alone then). */
  albedo: Texture | null;
  normal: Texture | null;
  emission: Texture | null;
  /** Below 1, see-through (door and gate panels). */
  opacity: number;
}

type UvNode = Parameters<typeof texture>[1];

/** Unity material colours are sRGB; the scene works in linear. */
const linear = ([r, g, b]: Rgba): Color => new Color().setRGB(r, g, b, SRGBColorSpace);

/**
 * Unity's `UnpackNormal`: x = r·a, so DXT5nm (x in alpha, r = 1) and plain RGB (a = 1)
 * both work; z rebuilt from x and y. Tangent space, with tangents when the mesh has
 * them, else from screen-space derivatives.
 */
const unpackedNormal = (map: Texture, st: UvNode) => {
  const sample = texture(map, st);
  const xy = vec2(sample.r.mul(sample.a), sample.g).mul(2).sub(1);
  const z = sqrt(max(float(1).sub(dot(xy, xy)), 0));
  return normalMap(vec3(xy, z).mul(0.5).add(0.5));
};

export const createRealMaterial = ({
  desc,
  albedo,
  normal,
  emission,
  opacity,
}: RealMaterialOptions): MeshStandardNodeMaterial => {
  const transparent = opacity < 1;
  const material = new MeshStandardNodeMaterial({
    transparent,
    opacity,
    depthWrite: !transparent,
    side: desc.doubleSided ? DoubleSide : FrontSide,
    roughness: 1 - desc.smoothness,
    // `_Metallic` is ignored: the scene has no environment to reflect, so metal
    // surfaces (grausten and the forge say 1) would render black.
    metalness: 0,
  });
  material.name = desc.name;
  // Values go in uniforms, so materials of the same shape share one shader program.
  const transform = uniform(new Vector4(...desc.uvST));
  const st = uv().mul(transform.xy).add(transform.zw);

  const { r, g, b } = linear(desc.color);
  const base = uniform(new Vector4(r, g, b, desc.color[3]));
  const surface = albedo ? texture(albedo, st).mul(base) : base;
  const tint = attribute(TINT_ATTRIBUTE, 'vec4');
  const cutout = desc.cutoff !== null;
  // Opaque materials keep other data in the albedo's alpha (gloss): only cutouts read it
  // (an `invisible` one has no texture and a `_Color` alpha of 0).
  material.colorNode = vec4(mix(surface.rgb, tint.rgb, tint.a), cutout ? surface.a : 1);
  if (desc.cutoff !== null) material.alphaTest = desc.cutoff;
  if (normal) material.normalNode = unpackedNormal(normal, st);
  if (emission) {
    material.emissiveNode = texture(emission, st).rgb.mul(uniform(linear(desc.emissionColor)));
  }
  return material;
};
