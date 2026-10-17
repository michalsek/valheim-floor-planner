/**
 * The cache's binary format for extracted models and textures:
 *
 *     "VFPM" · u32 ASSET_VERSION · u32 header length · JSON header · arrays
 *
 * The header carries everything but the typed arrays, which follow it, each aligned
 * to 4 bytes, in the order and with the types and lengths the header lists. Decoding
 * returns views into the buffer (no copies). A prefab that draws nothing is stored as
 * a `none` record, so it isn't extracted again.
 */
import { check, GameDataError } from '../GameDataError';
import type { TextureData } from '../unity/texture2d';

import type { Geometry } from './bakeModel';
import { ASSET_VERSION } from './constants';
import type { PrefabModel } from './extractModels';

const MAGIC = 'VFPM';
const PREAMBLE = 12;

type Packed = Float32Array | Uint16Array | Uint32Array | Uint8Array;
type ArrayType = 'f32' | 'u16' | 'u32' | 'u8';
type ArrayInfo = [type: ArrayType, length: number];

const CONSTRUCTORS = {
  f32: Float32Array,
  u16: Uint16Array,
  u32: Uint32Array,
  u8: Uint8Array,
} as const;

const typeOf = (array: Packed): ArrayType =>
  array instanceof Float32Array
    ? 'f32'
    : array instanceof Uint16Array
      ? 'u16'
      : array instanceof Uint32Array
        ? 'u32'
        : 'u8';

const align4 = (n: number) => Math.ceil(n / 4) * 4;

const pack = (kind: string, meta: object, arrays: readonly Packed[]): ArrayBuffer => {
  const info: ArrayInfo[] = arrays.map((a) => [typeOf(a), a.length]);
  const header = new TextEncoder().encode(JSON.stringify({ kind, meta, arrays: info }));
  let size = align4(PREAMBLE + header.length);
  const offsets = arrays.map((a) => {
    const at = size;
    size = align4(size + a.byteLength);
    return at;
  });
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  bytes.set(new TextEncoder().encode(MAGIC));
  view.setUint32(4, ASSET_VERSION, true);
  view.setUint32(8, header.length, true);
  bytes.set(header, PREAMBLE);
  arrays.forEach((a, i) =>
    bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offsets[i])
  );
  return buffer;
};

const unpack = (
  buffer: ArrayBuffer,
  kinds: readonly string[]
): { kind: string; meta: unknown; arrays: Packed[] } => {
  check(buffer.byteLength >= PREAMBLE, 'asset too short');
  const view = new DataView(buffer);
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
  check(magic === MAGIC, () => `asset magic "${magic}"`);
  const version = view.getUint32(4, true);
  if (version !== ASSET_VERSION) throw new GameDataError('unsupported', `asset version ${version}`);
  const headerLength = view.getUint32(8, true);
  check(PREAMBLE + headerLength <= buffer.byteLength, 'asset header past the end');
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, PREAMBLE, headerLength))
  ) as { kind: string; meta: unknown; arrays: ArrayInfo[] };
  check(kinds.includes(header.kind), () => `asset is a ${header.kind}, not a ${kinds[0]}`);

  let at = align4(PREAMBLE + headerLength);
  const arrays = header.arrays.map(([type, length]) => {
    const make = CONSTRUCTORS[type];
    check(make !== undefined && Number.isInteger(length) && length >= 0, 'bad asset array');
    const byteLength = length * make.BYTES_PER_ELEMENT;
    check(at + byteLength <= buffer.byteLength, 'asset array past the end');
    const array = new make(buffer, at, length);
    at = align4(at + byteLength);
    return array;
  });
  return { kind: header.kind, meta: header.meta, arrays };
};

const ATTRIBUTES = ['positions', 'normals', 'tangents', 'uv0', 'indices'] as const;

/** A model (null: the prefab draws nothing) as one transferable buffer. */
export const encodeModel = (model: PrefabModel | null): ArrayBuffer => {
  if (!model) return pack('none', {}, []);
  const arrays: Packed[] = [];
  const slot = (array: Packed | null) => (array ? arrays.push(array) - 1 : -1);
  const groups = model.groups.map(({ materialId, material, geometry }) => ({
    materialId,
    material,
    geometry: Object.fromEntries(ATTRIBUTES.map((name) => [name, slot(geometry[name])])),
  }));
  const { name, space, parts, bounds } = model;
  return pack('model', { name, space, parts, bounds, groups }, arrays);
};

type ModelMeta = Omit<PrefabModel, 'groups'> & {
  groups: (Omit<PrefabModel['groups'][number], 'geometry'> & {
    geometry: Record<(typeof ATTRIBUTES)[number], number>;
  })[];
};

export const decodeModel = (buffer: ArrayBuffer): PrefabModel | null => {
  const { kind, meta, arrays } = unpack(buffer, ['model', 'none']);
  if (kind === 'none') return null;
  const { groups, ...rest } = meta as ModelMeta;
  const at = (i: number) => {
    if (i < 0) return null;
    check(arrays[i] !== undefined, 'asset array index');
    return arrays[i];
  };
  return {
    ...rest,
    groups: groups.map(({ geometry, ...group }) => {
      const positions = at(geometry.positions);
      const indices = at(geometry.indices);
      check(positions instanceof Float32Array, 'model without positions');
      check(indices instanceof Uint16Array || indices instanceof Uint32Array, 'model indices');
      return {
        ...group,
        geometry: {
          positions,
          normals: at(geometry.normals),
          tangents: at(geometry.tangents),
          uv0: at(geometry.uv0),
          indices,
        } as Geometry,
      };
    }),
  };
};

/** A texture (its mips) as one transferable buffer. */
export const encodeTexture = (texture: TextureData): ArrayBuffer => {
  const { mips, ...meta } = texture;
  return pack('texture', meta, mips);
};

export const decodeTexture = (buffer: ArrayBuffer): TextureData => {
  const { meta, arrays } = unpack(buffer, ['texture']);
  check(
    arrays.every((a) => a instanceof Uint8Array),
    'texture mips'
  );
  return { ...(meta as Omit<TextureData, 'mips'>), mips: arrays as Uint8Array[] };
};
