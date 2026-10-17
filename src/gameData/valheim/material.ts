/**
 * What the planner draws a Valheim material with, from its saved properties alone.
 * The shader (Custom/Piece, Standard, …) is never read: it is huge, and its render
 * state is mirrored by the material's floats.
 */
import { fields, localRef, namedPairs, num, str, type Fields } from '../unity/values';

export type Rgba = [r: number, g: number, b: number, a: number];

export interface MaterialDesc {
  name: string;
  color: Rgba;
  /** Texture2D path IDs (decimal strings) in the same bundle, or null. */
  albedo: string | null;
  normal: string | null;
  emission: string | null;
  emissionColor: Rgba;
  /** `_MainTex` scale and offset: uv' = uv · [sx, sy] + [ox, oy]. */
  uvST: [sx: number, sy: number, ox: number, oy: number];
  /** Alpha-test threshold for cutout materials (`_Mode` 1), else null. */
  cutoff: number | null;
  /** `_Cull` 0 (thatch, leaves). */
  doubleSided: boolean;
  metallic: number;
  /** `_Glossiness`; roughness is 1 − smoothness. */
  smoothness: number;
}

const CUTOUT_MODE = 1;
const CULL_OFF = 0;
const WHITE: Rgba = [1, 1, 1, 1];
const BLACK: Rgba = [0, 0, 0, 1];

const rgba = (value: unknown): Rgba => {
  const c = fields(value, 'color');
  return [num(c.r, 'r'), num(c.g, 'g'), num(c.b, 'b'), num(c.a, 'a')];
};

export const materialDesc = (material: Fields): MaterialDesc => {
  const props = fields(material.m_SavedProperties, 'm_SavedProperties');
  const textures = namedPairs(props.m_TexEnvs, 'm_TexEnvs');
  const floats = namedPairs(props.m_Floats, 'm_Floats');
  const colors = namedPairs(props.m_Colors, 'm_Colors');

  const float = (name: string, fallback: number): number => {
    const value = floats.get(name);
    return value === undefined ? fallback : num(value, name);
  };
  const texture = (name: string): Fields | null => {
    const value = textures.get(name);
    return value === undefined ? null : fields(value, name);
  };
  const textureId = (name: string): string | null => {
    const env = texture(name);
    const id = env && localRef(env.m_Texture, `${name}.m_Texture`);
    return id === null ? null : String(id);
  };
  const color = (name: string, fallback: Rgba): Rgba => {
    const value = colors.get(name);
    return value === undefined ? fallback : rgba(value);
  };

  const main = texture('_MainTex');
  const scale = main && fields(main.m_Scale, 'm_Scale');
  const offset = main && fields(main.m_Offset, 'm_Offset');
  return {
    name: str(material.m_Name, 'm_Name'),
    color: color('_Color', WHITE),
    albedo: textureId('_MainTex'),
    normal: textureId('_BumpMap'),
    emission: textureId('_EmissionMap'),
    emissionColor: color('_EmissionColor', BLACK),
    uvST: [
      scale ? num(scale.x, 'x') : 1,
      scale ? num(scale.y, 'y') : 1,
      offset ? num(offset.x, 'x') : 0,
      offset ? num(offset.y, 'y') : 0,
    ],
    cutoff: float('_Mode', 0) === CUTOUT_MODE ? float('_Cutoff', 0.5) : null,
    doubleSided: float('_Cull', 2) === CULL_OFF,
    metallic: float('_Metallic', 0),
    smoothness: float('_Glossiness', 0.5),
  };
};
