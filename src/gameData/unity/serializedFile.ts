/**
 * Unity serialized files (format 22, Unity 2022–6): the type table, the object table
 * and reading objects through their type trees (external references aren't followed). Only the metadata is read up front;
 * objects are read on demand, in file order when asked for in batches.
 */
import { ByteReader } from '../bytes/ByteReader';
import type { ByteSource } from '../bytes/ByteSource';
import { check, GameDataError } from '../GameDataError';

import { parseTypeTreeBlob, readValue, type TypeTreeNode } from './typeTree';

export interface SerializedType {
  classId: number;
  /** Null in player builds without type trees (e.g. `resources.assets`). */
  node: TypeTreeNode | null;
}

export interface SerializedFile {
  little: boolean;
  unityVersion: string;
  /** Objects read so far (for progress). */
  readonly objectsRead: number;
  classId(id: bigint): number;
  /** The object's type; its node's children name the object's fields. */
  typeOf(id: bigint): SerializedType;
  /** Every object of `classId`, in path-ID order. */
  idsOfClass(classId: number): bigint[];
  /** The object's raw bytes, or its first `maxLength` bytes. */
  readBytes(id: bigint, maxLength?: number): Uint8Array;
  read(id: bigint): unknown;
  /** Reads several objects in file order (one pass over the bundle blocks). */
  readMany(ids: Iterable<bigint>): Map<bigint, unknown>;
}

const SUPPORTED_FORMAT = 22;
const HEADER_SIZE = 48;
/** MonoBehaviour's class ID (its type also stores a script hash). */
export const CLASS_MONO_BEHAVIOUR = 114;

const readType = (r: ByteReader, withTree: boolean): SerializedType => {
  const classId = r.i32();
  r.bool(); // stripped
  r.i16(); // script type index
  if (classId === CLASS_MONO_BEHAVIOUR) r.bytesView(16); // script id
  r.bytesView(16); // old type hash
  const node = withTree ? parseTypeTreeBlob(r) : null;
  if (withTree) r.bytesView(r.count(4) * 4); // type dependencies
  return { classId, node };
};

/** Object table sorted by path ID, as parallel arrays (a Map would cost ~5× the memory). */
interface ObjectTable {
  ids: BigInt64Array;
  offsets: Float64Array;
  sizes: Uint32Array;
  typeIndex: Uint32Array;
}

const readObjectTable = (r: ByteReader, dataOffset: number, typeCount: number): ObjectTable => {
  const count = r.count(24);
  const ids = new BigInt64Array(count);
  const offsets = new Float64Array(count);
  const sizes = new Uint32Array(count);
  const typeIndex = new Uint32Array(count);
  let sorted = true;
  for (let i = 0; i < count; i++) {
    r.align(4);
    ids[i] = r.i64();
    offsets[i] = dataOffset + r.safe64();
    sizes[i] = r.u32();
    const type = r.i32();
    check(type >= 0 && type < typeCount, () => `object type ${type}`);
    typeIndex[i] = type;
    if (i > 0 && ids[i]! <= ids[i - 1]!) sorted = false;
  }
  if (sorted) return { ids, offsets, sizes, typeIndex };

  const order = Array.from({ length: count }, (_, i) => i);
  order.sort((a, b) => (ids[a]! < ids[b]! ? -1 : ids[a]! > ids[b]! ? 1 : 0));
  return {
    ids: BigInt64Array.from(order, (i) => ids[i]!),
    offsets: Float64Array.from(order, (i) => offsets[i]!),
    sizes: Uint32Array.from(order, (i) => sizes[i]!),
    typeIndex: Uint32Array.from(order, (i) => typeIndex[i]!),
  };
};

export const openSerializedFile = (src: ByteSource): SerializedFile => {
  check(src.size >= HEADER_SIZE, 'serialized file too small');
  const head = new ByteReader(src.read(0, HEADER_SIZE), false);
  head.u32(); // metadata size (pre-v22)
  head.u32(); // file size (pre-v22)
  const version = head.u32();
  if (version !== SUPPORTED_FORMAT) {
    throw new GameDataError('unsupported', `serialized file format ${version}`);
  }
  head.u32(); // data offset (pre-v22)
  const little = head.u8() === 0;
  head.bytesView(3);
  const metadataSize = head.u32();
  const fileSize = head.safe64();
  const dataOffset = head.safe64();
  if (fileSize !== src.size) {
    throw new GameDataError(
      'incomplete',
      `asset file is ${src.size} bytes, header says ${fileSize}`
    );
  }
  check(HEADER_SIZE + metadataSize <= dataOffset && dataOffset <= fileSize, 'bad data offset');

  const r = new ByteReader(src.read(HEADER_SIZE, metadataSize), little);
  const unityVersion = r.cstr();
  r.i32(); // target platform
  const withTree = r.bool();
  const types = Array.from({ length: r.count(23) }, () => readType(r, withTree));
  const table = readObjectTable(r, dataOffset, types.length);
  // Scripts, externals and ref types follow; nothing here needs them.

  const indexOf = (id: bigint): number => {
    let lo = 0;
    let hi = table.ids.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const value = table.ids[mid]!;
      if (value === id) return mid;
      if (value < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };
  const mustIndex = (id: bigint): number => {
    const i = indexOf(id);
    check(i >= 0, () => `no object ${id}`);
    return i;
  };
  const typeAt = (i: number): SerializedType => types[table.typeIndex[i]!]!;

  let objectsRead = 0;
  const readAt = (i: number): unknown => {
    const { node } = typeAt(i);
    if (!node) throw new GameDataError('unsupported', 'object has no type tree');
    const size = table.sizes[i]!;
    const reader = new ByteReader(src.read(table.offsets[i]!, size), little);
    const value = readValue(node, reader);
    check(
      reader.pos === size,
      () => `${node.type} ${table.ids[i]} read ${reader.pos} of ${size} bytes`
    );
    objectsRead++;
    return value;
  };

  return {
    little,
    unityVersion,
    get objectsRead() {
      return objectsRead;
    },
    classId: (id) => typeAt(mustIndex(id)).classId,
    typeOf: (id) => typeAt(mustIndex(id)),
    idsOfClass: (classId) => Array.from(table.ids).filter((_, i) => typeAt(i).classId === classId),
    readBytes: (id, maxLength = Infinity) => {
      const i = mustIndex(id);
      return src.read(table.offsets[i]!, Math.min(table.sizes[i]!, maxLength));
    },
    read: (id) => readAt(mustIndex(id)),
    readMany: (ids) => {
      const order = [...new Set(ids)].map(mustIndex);
      order.sort((a, b) => table.offsets[a]! - table.offsets[b]!);
      return new Map(order.map((i) => [table.ids[i]!, readAt(i)]));
    },
  };
};
