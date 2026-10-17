/**
 * Unity Mesh objects (2019+ vertex layout), decoded to plain float arrays. Mirrors
 * UnityPy's `MeshHelper`:
 * - vertex data is inline (`m_VertexData.m_DataSize`) or in a `.resS` node
 *   (`m_StreamData`);
 * - channels are grouped into streams; each stream holds `vertexCount × stride` bytes
 *   and starts aligned to 16;
 * - a channel's `dimension` low nibble is the stored component count (the high nibble,
 *   when set, is how many the shader reads: 52 is a half4 normal read as 3);
 * - vertex data is little-endian (every desktop platform).
 */
import { check, GameDataError } from '../GameDataError';

import type { ResourceReader } from './streamingInfo';
import { streamingInfo } from './streamingInfo';
import { fields, list, num, str, vec3, type Fields, type V3 } from './values';

export interface SubMesh {
  /** First index (not byte) in `indices`. */
  start: number;
  count: number;
  /** Added to every index of this submesh. */
  baseVertex: number;
  /** `MeshTopology`: 0 is triangles. */
  topology: number;
}

export interface Bounds {
  min: V3;
  max: V3;
}

export interface MeshData {
  name: string;
  vertexCount: number;
  positions: Float32Array;
  normals: Float32Array | null;
  /** xyz and the bitangent sign w. */
  tangents: Float32Array | null;
  uv0: Float32Array | null;
  indices: Uint16Array | Uint32Array;
  submeshes: SubMesh[];
  bounds: Bounds;
  /** The vertex data came from the `.resS` node. */
  streamed: boolean;
  /** The normals' `VertexFormat` (0 float, 1 half), or null without normals. */
  normalFormat: number | null;
}

/** Shader channels (Unity 2018+) the planner reads, and how many components each. */
const POSITION = 0;
const NORMAL = 1;
const TANGENT = 2;
const UV0 = 4;
const WANTED: ReadonlyMap<number, number> = new Map([
  [POSITION, 3],
  [NORMAL, 3],
  [TANGENT, 4],
  [UV0, 2],
]);

/** Bytes per component of each `VertexFormat` (float, half, unorm8, snorm8, …). */
/** More than any piece needs (the largest has ~25k); a bigger count is corrupt data. */
const MAX_VERTICES = 1 << 22;
const COMPONENT_SIZE = [4, 2, 1, 1, 2, 2, 1, 1, 2, 2, 4, 4];

interface Channel {
  stream: number;
  offset: number;
  format: number;
  /** Stored components. */
  dimension: number;
}

/** IEEE 754 half → number. */
export const halfToFloat = (h: number): number => {
  const exponent = (h >> 10) & 0x1f;
  const mantissa = h & 0x3ff;
  const sign = h & 0x8000 ? -1 : 1;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa ? NaN : sign * Infinity;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
};

const readComponent = (view: DataView, at: number, format: number): number => {
  switch (format) {
    case 0:
      return view.getFloat32(at, true);
    case 1:
      return halfToFloat(view.getUint16(at, true));
    case 2:
      return view.getUint8(at) / 255;
    case 3:
      return Math.max(view.getInt8(at) / 127, -1);
    case 4:
      return view.getUint16(at, true) / 65535;
    case 5:
      return Math.max(view.getInt16(at, true) / 32767, -1);
    case 6:
      return view.getUint8(at);
    case 7:
      return view.getInt8(at);
    case 8:
      return view.getUint16(at, true);
    case 9:
      return view.getInt16(at, true);
    case 10:
      return view.getUint32(at, true);
    case 11:
      return view.getInt32(at, true);
    default:
      throw new GameDataError('unsupported', `vertex format ${format}`);
  }
};

const componentSize = (format: number): number => {
  const size = COMPONENT_SIZE[format];
  if (size === undefined) throw new GameDataError('unsupported', `vertex format ${format}`);
  return size;
};

const readChannels = (vertexData: Fields): Channel[] =>
  list(vertexData.m_Channels, 'm_Channels').map((value) => {
    const c = fields(value, 'channel');
    return {
      stream: num(c.stream, 'stream'),
      offset: num(c.offset, 'offset'),
      format: num(c.format, 'format'),
      dimension: num(c.dimension, 'dimension') & 0xf,
    };
  });

/** Each stream's [start, stride] in the vertex data. */
const streamLayout = (channels: readonly Channel[], vertexCount: number): [number, number][] => {
  const used = channels.filter((c) => c.dimension > 0);
  const count = used.length === 0 ? 0 : 1 + Math.max(...used.map((c) => c.stream));
  const layout: [number, number][] = [];
  let start = 0;
  for (let s = 0; s < count; s++) {
    const stride = used
      .filter((c) => c.stream === s)
      .reduce((sum, c) => sum + c.dimension * componentSize(c.format), 0);
    layout.push([start, stride]);
    start = Math.ceil((start + vertexCount * stride) / 16) * 16;
  }
  return layout;
};

/** One channel as `want` floats per vertex (missing components are 0). */
const decodeChannel = (
  view: DataView,
  channel: Channel,
  [start, stride]: [number, number],
  vertexCount: number,
  want: number
): Float32Array => {
  const size = componentSize(channel.format);
  const n = Math.min(channel.dimension, want);
  // Before allocating: a corrupt count must not ask for gigabytes.
  check(
    vertexCount === 0 ||
      start + (vertexCount - 1) * stride + channel.offset + n * size <= view.byteLength,
    'vertex data too short'
  );
  const out = new Float32Array(vertexCount * want);
  for (let v = 0; v < vertexCount; v++) {
    const at = start + v * stride + channel.offset;
    for (let c = 0; c < n; c++)
      out[v * want + c] = readComponent(view, at + c * size, channel.format);
  }
  return out;
};

const readIndices = (mesh: Fields): Uint16Array | Uint32Array => {
  const raw = mesh.m_IndexBuffer;
  check(raw instanceof Uint8Array, 'm_IndexBuffer: not bytes');
  const wide = num(mesh.m_IndexFormat, 'm_IndexFormat') === 1;
  const size = wide ? 4 : 2;
  check(raw.length % size === 0, 'm_IndexBuffer: odd length');
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return wide ? new Uint32Array(buffer) : new Uint16Array(buffer);
};

const readSubMeshes = (mesh: Fields, indices: Uint16Array | Uint32Array): SubMesh[] =>
  list(mesh.m_SubMeshes, 'm_SubMeshes').map((value) => {
    const s = fields(value, 'submesh');
    const start = num(s.firstByte, 'firstByte') / indices.BYTES_PER_ELEMENT;
    const count = num(s.indexCount, 'indexCount');
    check(Number.isInteger(start) && start + count <= indices.length, 'submesh past the indices');
    return {
      start,
      count,
      baseVertex: num(s.baseVertex, 'baseVertex'),
      topology: num(s.topology, 'topology'),
    };
  });

const readBounds = (value: unknown): Bounds => {
  const aabb = fields(value, 'm_LocalAABB');
  const [cx, cy, cz] = vec3(aabb.m_Center, 'm_Center');
  const [ex, ey, ez] = vec3(aabb.m_Extent, 'm_Extent');
  return { min: [cx - ex, cy - ey, cz - ez], max: [cx + ex, cy + ey, cz + ez] };
};

/** Decodes a Mesh object read through its type tree; `res` reads `.resS` data. */
export const readMesh = (mesh: Fields, res: ResourceReader): MeshData => {
  const name = str(mesh.m_Name, 'm_Name');
  if (num(mesh.m_MeshCompression, 'm_MeshCompression') !== 0) {
    throw new GameDataError('unsupported', `compressed mesh ${name}`);
  }
  const vertexData = fields(mesh.m_VertexData, 'm_VertexData');
  const vertexCount = num(vertexData.m_VertexCount, 'm_VertexCount');
  check(
    Number.isInteger(vertexCount) && vertexCount >= 0 && vertexCount <= MAX_VERTICES,
    () => `mesh ${name}: ${vertexCount} vertices`
  );
  const stream = streamingInfo(mesh.m_StreamData, 'm_StreamData');
  const bytes = stream ? res(stream) : vertexData.m_DataSize;
  check(bytes instanceof Uint8Array, 'm_DataSize: not bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const channels = readChannels(vertexData);
  const layout = streamLayout(channels, vertexCount);
  const decode = (index: number): Float32Array | null => {
    const channel = channels[index];
    if (!channel || channel.dimension === 0) return null;
    return decodeChannel(view, channel, layout[channel.stream]!, vertexCount, WANTED.get(index)!);
  };
  const positions = decode(POSITION);
  check(positions !== null, () => `mesh ${name} has no positions`);
  const normals = decode(NORMAL);
  const indices = readIndices(mesh);

  return {
    name,
    vertexCount,
    positions,
    normals,
    tangents: decode(TANGENT),
    uv0: decode(UV0),
    indices,
    submeshes: readSubMeshes(mesh, indices),
    bounds: readBounds(mesh.m_LocalAABB),
    streamed: stream !== null,
    normalFormat: normals ? channels[NORMAL]!.format : null,
  };
};
