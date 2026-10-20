/**
 * The material real piece models are drawn with, from a Valheim material's saved
 * properties (`MaterialDesc`): albedo × `_Color` through the `_MainTex` scale and
 * offset, the normal map (Unity's DXT5nm or plain RGB), emission, cutout, culling and
 * smoothness.
 *
 * Instancing goes through vertex attributes on a plain mesh (`gpuData.ts`), not
 * `InstancedMesh`: three r186 gives each InstancedMesh's matrices a uniform buffer named
 * after it, so every mesh got its own vertex program (WebGL2 linked 118 of them, for
 * seconds, on every entry to 3D). Here meshes of the same material shape share one
 * program. Each instance has its matrix (`MATRIX_ATTRIBUTES`, a turn and a move) and
 * mixes its colour towards its tint (`TINT_ATTRIBUTE`, sRGB + amount), for selection,
 * hover and support.
 */
import {
  attribute,
  dot,
  float,
  max,
  mat4,
  mix,
  normalLocal,
  normalMap,
  positionLocal,
  sqrt,
  sRGBTransferEOTF,
  sRGBTransferOETF,
  tangentLocal,
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
  type Node,
  type NodeBuilder,
  type Texture,
} from 'three/webgpu';

import type { MaterialDesc, Rgba } from '../../../gameData/valheim/material';

/** The per-instance tint attribute: sRGB rgb, and how far to mix towards it. */
export const TINT_ATTRIBUTE = 'tint';

/** The per-instance matrix, one column per attribute. */
export const MATRIX_ATTRIBUTES = [
  'instanceColumn0',
  'instanceColumn1',
  'instanceColumn2',
  'instanceColumn3',
] as const;

const [c0, c1, c2, c3] = MATRIX_ATTRIBUTES.map((name) => attribute(name, 'vec4'));
const instanceMatrix = mat4(c0!, c1!, c2!, c3!);

export interface RealMaterialOptions {
  desc: MaterialDesc;
  /** Null where the texture is missing or can't be sampled (`_Color` alone then). */
  albedo: Texture | null;
  normal: Texture | null;
  emission: Texture | null;
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

/**
 * A standard material drawn once per instance attribute row. The position goes through
 * `positionNode` (the shadow pass copies it); normals and tangents are turned here.
 * Instance matrices are rigid (a turn about y and a move), so directions need no
 * inverse transpose.
 */
class InstancedModelMaterial extends MeshStandardNodeMaterial {
  override setupPosition(builder: NodeBuilder): Node {
    const turn = (direction: Node<'vec3'>) => instanceMatrix.mul(vec4(direction, 0)).xyz;
    if (builder.geometry.hasAttribute('normal')) normalLocal.assign(turn(normalLocal));
    if (builder.geometry.hasAttribute('tangent')) tangentLocal.assign(turn(tangentLocal));
    return super.setupPosition(builder);
  }
}

export const createRealMaterial = ({
  desc,
  albedo,
  normal,
  emission,
}: RealMaterialOptions): MeshStandardNodeMaterial => {
  const material = new InstancedModelMaterial({
    side: desc.doubleSided ? DoubleSide : FrontSide,
    roughness: 1 - desc.smoothness,
    // `_Metallic` is ignored: the scene has no environment to reflect, so metal
    // surfaces (grausten and the forge say 1) would render black.
    metalness: 0,
  });
  material.name = desc.name;
  material.positionNode = instanceMatrix.mul(vec4(positionLocal, 1)).xyz;
  // Values go in uniforms, so materials of the same shape share one shader program.
  const transform = uniform(new Vector4(...desc.uvST));
  const st = uv().mul(transform.xy).add(transform.zw);

  const { r, g, b } = linear(desc.color);
  const base = uniform(new Vector4(r, g, b, desc.color[3]));
  const surface = albedo ? texture(albedo, st).mul(base) : base;
  const tint = attribute(TINT_ATTRIBUTE, 'vec4');
  // Mixed in sRGB, as the boxes' colours are: in linear a light tint washes dark
  // textures out to white.
  // (r186's typings return an untyped Node from the transfer functions.)
  const display = sRGBTransferOETF(surface.rgb) as Node<'vec3'>;
  const tinted = sRGBTransferEOTF(mix(display, tint.rgb, tint.a)) as Node<'vec3'>;
  const cutout = desc.cutoff !== null;
  // Opaque materials keep other data in the albedo's alpha (gloss): only cutouts read it
  // (an `invisible` one has no texture and a `_Color` alpha of 0).
  material.colorNode = vec4(tinted, cutout ? surface.a : 1);
  if (desc.cutoff !== null) material.alphaTest = desc.cutoff;
  if (normal) material.normalNode = unpackedNormal(normal, st);
  if (emission) {
    material.emissiveNode = texture(emission, st).rgb.mul(uniform(linear(desc.emissionColor)));
  }
  return material;
};
