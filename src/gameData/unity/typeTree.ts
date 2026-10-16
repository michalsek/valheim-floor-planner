/**
 * Type trees: the per-type field layout stored in a serialized file, and a generic
 * reader that turns an object's bytes into plain values with it. Mirrors UnityPy's
 * `TypeTreeNode.parse_blob` and `TypeTreeHelper.read_value`:
 * - classes become plain objects keyed by field name, pairs `[first, second]`;
 * - 64-bit integers are `bigint`;
 * - arrays of primitives are typed arrays (copies), other arrays plain arrays;
 * - the 0x4000 "align" meta flag, on a node or its `Array` child, aligns to 4 after it.
 */
import { ByteReader } from '../bytes/ByteReader';
import { check, GameDataError } from '../GameDataError';

import { COMMON_STRINGS } from './commonStrings';

export interface TypeTreeNode {
  type: string;
  name: string;
  byteSize: number;
  /** Meta flags (0x4000 = align after). */
  flags: number;
  level: number;
  children: TypeTreeNode[];
}

const ALIGN = 0x4000;
const NODE_SIZE = 32;

/** A type-tree blob (format 19–22: 32-byte nodes with a ref-type hash, no header). */
export const parseTypeTreeBlob = (r: ByteReader): TypeTreeNode => {
  const nodeCount = r.count(NODE_SIZE);
  check(nodeCount > 0, 'empty type tree');
  const stringSize = r.i32();
  const nodes = new ByteReader(r.bytesView(nodeCount * NODE_SIZE), r.little);
  const strings = new ByteReader(r.bytesView(stringSize), r.little);

  const string = (offset: number): string => {
    if (offset & 0x80000000) {
      const common = COMMON_STRINGS.get(offset & 0x7fffffff);
      return common ?? String(offset & 0x7fffffff);
    }
    check(offset < stringSize, () => `type-tree string offset ${offset}`);
    strings.pos = offset;
    return strings.cstr();
  };

  const stack: TypeTreeNode[] = [];
  let root: TypeTreeNode | null = null;
  for (let i = 0; i < nodeCount; i++) {
    nodes.u16(); // version
    const level = nodes.u8();
    nodes.u8(); // type flags
    const type = string(nodes.u32());
    const name = string(nodes.u32());
    const byteSize = nodes.i32();
    nodes.i32(); // index
    const flags = nodes.i32();
    nodes.u64(); // ref-type hash
    const node: TypeTreeNode = { type, name, byteSize, flags, level, children: [] };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      check(level === parent.level + 1, () => `type-tree level jumps at node ${i}`);
      parent.children.push(node);
    } else {
      check(root === null, 'type tree has two roots');
      root = node;
    }
    stack.push(node);
  }
  return root!;
};

const SCALARS: Readonly<Record<string, (r: ByteReader) => unknown>> = {
  SInt8: (r) => r.i8(),
  UInt8: (r) => r.u8(),
  char: (r) => r.u8(),
  short: (r) => r.i16(),
  SInt16: (r) => r.i16(),
  'unsigned short': (r) => r.u16(),
  UInt16: (r) => r.u16(),
  int: (r) => r.i32(),
  SInt32: (r) => r.i32(),
  'unsigned int': (r) => r.u32(),
  UInt32: (r) => r.u32(),
  'Type*': (r) => r.u32(),
  'long long': (r) => r.i64(),
  SInt64: (r) => r.i64(),
  'unsigned long long': (r) => r.u64(),
  UInt64: (r) => r.u64(),
  FileSize: (r) => r.u64(),
  float: (r) => r.f32(),
  double: (r) => r.f64(),
  bool: (r) => r.bool(),
  string: (r) => {
    const length = r.count(1);
    const value = r.str(length);
    if (length > 0) r.align(4);
    return value;
  },
  TypelessData: (r) => r.bytesView(r.count(1)).slice(),
};

type TypedArrayOf = (buffer: ArrayBuffer) => ArrayLike<number | bigint>;

/** Primitive element types read as one typed array: [bytes per element, constructor]. */
const TYPED_ARRAYS: Readonly<Record<string, readonly [number, TypedArrayOf]>> = {
  SInt8: [1, (b) => new Int8Array(b)],
  UInt8: [1, (b) => new Uint8Array(b)],
  char: [1, (b) => new Uint8Array(b)],
  bool: [1, (b) => new Uint8Array(b)],
  short: [2, (b) => new Int16Array(b)],
  SInt16: [2, (b) => new Int16Array(b)],
  'unsigned short': [2, (b) => new Uint16Array(b)],
  UInt16: [2, (b) => new Uint16Array(b)],
  int: [4, (b) => new Int32Array(b)],
  SInt32: [4, (b) => new Int32Array(b)],
  'unsigned int': [4, (b) => new Uint32Array(b)],
  UInt32: [4, (b) => new Uint32Array(b)],
  'Type*': [4, (b) => new Uint32Array(b)],
  'long long': [8, (b) => new BigInt64Array(b)],
  SInt64: [8, (b) => new BigInt64Array(b)],
  'unsigned long long': [8, (b) => new BigUint64Array(b)],
  UInt64: [8, (b) => new BigUint64Array(b)],
  FileSize: [8, (b) => new BigUint64Array(b)],
  float: [4, (b) => new Float32Array(b)],
  double: [8, (b) => new Float64Array(b)],
};

const readArray = (element: TypeTreeNode, r: ByteReader): unknown => {
  const typed = TYPED_ARRAYS[element.type];
  // Typed arrays are little-endian on every platform we run on.
  if (typed && (r.little || typed[0] === 1)) {
    const [size, make] = typed;
    const count = r.count(size);
    const value = make(r.bytesView(count * size).slice().buffer);
    if (element.flags & ALIGN) r.align(4);
    return value;
  }
  const count = r.count(1);
  const items = new Array<unknown>(count);
  for (let i = 0; i < count; i++) items[i] = readValue(element, r);
  return items;
};

/** Reads the value `node` describes at the reader's position. */
export const readValue = (node: TypeTreeNode, r: ByteReader): unknown => {
  let align = (node.flags & ALIGN) !== 0;
  let value: unknown;
  const scalar = SCALARS[node.type];
  const array = node.children[0];

  if (scalar) {
    value = scalar(r);
  } else if (node.type === 'pair') {
    check(node.children.length === 2, 'pair without two fields');
    value = [readValue(node.children[0]!, r), readValue(node.children[1]!, r)];
  } else if (node.type === 'ReferencedObject') {
    throw new GameDataError('unsupported', 'managed references');
  } else if (array?.type === 'Array') {
    if (array.flags & ALIGN) align = true;
    const element = array.children[1];
    check(element !== undefined, () => `array ${node.name} has no element type`);
    value = readArray(element, r);
  } else {
    const fields: Record<string, unknown> = {};
    for (const child of node.children) fields[child.name] = readValue(child, r);
    value = fields;
  }

  if (align) r.align(4);
  return value;
};
