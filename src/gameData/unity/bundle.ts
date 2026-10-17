/**
 * UnityFS asset bundles (header versions 6–8): the block and directory table, and
 * random access to each node's bytes. Blocks are decompressed on demand (LZ4/LZ4HC or
 * stored) and kept in an LRU, so reading a few scattered objects from a 745 MB bundle
 * touches only their blocks. Streamed data (`.resS`/`.resource` nodes: mesh and
 * texture bytes, each read once) goes through a small LRU of its own, so it doesn't
 * push out the object blocks that are read again and again (one sweep per hierarchy
 * level while models are extracted).
 */
import { ByteReader } from '../bytes/ByteReader';
import { checkRange, type ByteSource } from '../bytes/ByteSource';
import { decompressLz4 } from '../bytes/lz4';
import { check, GameDataError } from '../GameDataError';

export interface BundleNode {
  name: string;
  /** Offset in the bundle's uncompressed data stream. */
  offset: number;
  size: number;
  flags: number;
}

export interface Bundle {
  nodes: readonly BundleNode[];
  /** The bytes of the node called `name`; throws when there is none. */
  node(name: string): ByteSource;
}

const COMPRESSION_MASK = 0x3f;
const INFO_AT_END = 0x80;
const PADDING_AT_START = 0x200;
const ENCRYPTED = 0x1400;
/** Decompressed object blocks kept (up to 128 KB each, so about 64 MB). */
const CACHE_BLOCKS = 512;
/** Decompressed streamed-data blocks kept (about 1 MB). */
const STREAM_BLOCKS = 8;

const isStreamed = (name: string) => /\.res(S|ource)$/.test(name);

const decompress = (bytes: Uint8Array, size: number, flags: number): Uint8Array => {
  const kind = flags & COMPRESSION_MASK;
  if (kind === 0) {
    check(bytes.length === size, 'stored block size mismatch');
    return bytes;
  }
  if (kind === 2 || kind === 3) return decompressLz4(bytes, size);
  throw new GameDataError(
    'unsupported',
    kind === 1 ? 'LZMA-compressed bundle' : `compression ${kind}`
  );
};

const align16 = (n: number): number => Math.ceil(n / 16) * 16;

export const openBundle = (src: ByteSource): Bundle => {
  const head = new ByteReader(src.read(0, Math.min(src.size, 256)), false);
  const signature = head.cstr();
  if (signature !== 'UnityFS') {
    const known = signature === 'UnityWeb' || signature === 'UnityRaw';
    throw new GameDataError(known ? 'unsupported' : 'corrupt', `bundle signature "${signature}"`);
  }
  const version = head.u32();
  if (version < 6 || version > 8) throw new GameDataError('unsupported', `UnityFS v${version}`);
  head.cstr(); // player version ("5.x.x")
  head.cstr(); // engine version (the serialized file has it too)
  const declaredSize = head.safe64();
  if (declaredSize !== src.size) {
    throw new GameDataError(
      'incomplete',
      `bundle is ${src.size} bytes, header says ${declaredSize}`
    );
  }
  const infoPacked = head.u32();
  const infoSize = head.u32();
  const flags = head.u32();
  if (flags & ENCRYPTED) throw new GameDataError('unsupported', 'encrypted bundle');
  if (version >= 7) head.align(16);

  const atEnd = (flags & INFO_AT_END) !== 0;
  const infoOffset = atEnd ? src.size - infoPacked : head.pos;
  const info = new ByteReader(decompress(src.read(infoOffset, infoPacked), infoSize, flags), false);
  let dataStart = atEnd ? head.pos : head.pos + infoPacked;
  if (flags & PADDING_AT_START) dataStart = align16(dataStart);

  info.bytesView(16); // hash of the uncompressed data
  const blockCount = info.count(10);
  const packedStart = new Float64Array(blockCount + 1);
  const plainStart = new Float64Array(blockCount + 1);
  const blockFlags = new Uint16Array(blockCount);
  packedStart[0] = dataStart;
  for (let i = 0; i < blockCount; i++) {
    plainStart[i + 1] = plainStart[i]! + info.u32();
    packedStart[i + 1] = packedStart[i]! + info.u32();
    blockFlags[i] = info.u16();
  }
  if (packedStart[blockCount]! > src.size) {
    throw new GameDataError('incomplete', 'bundle data ends early');
  }

  const nodes: BundleNode[] = [];
  const nodeCount = info.count(21);
  for (let i = 0; i < nodeCount; i++) {
    const offset = info.safe64();
    const size = info.safe64();
    const nodeFlags = info.u32();
    const name = info.cstr();
    check(offset + size <= plainStart[blockCount]!, () => `node ${name} past the data`);
    nodes.push({ name, offset, size, flags: nodeFlags });
  }

  interface Lru {
    blocks: Map<number, Uint8Array>;
    limit: number;
  }
  const objects: Lru = { blocks: new Map(), limit: CACHE_BLOCKS };
  const streamed: Lru = { blocks: new Map(), limit: STREAM_BLOCKS };
  const block = (i: number, { blocks, limit }: Lru): Uint8Array => {
    const hit = objects.blocks.get(i) ?? streamed.blocks.get(i);
    if (hit) {
      if (blocks.delete(i)) blocks.set(i, hit);
      return hit;
    }
    const packed = src.read(packedStart[i]!, packedStart[i + 1]! - packedStart[i]!);
    const bytes = decompress(packed, plainStart[i + 1]! - plainStart[i]!, blockFlags[i]!);
    blocks.set(i, bytes);
    if (blocks.size > limit) blocks.delete(blocks.keys().next().value!);
    return bytes;
  };

  /** The block holding data offset `pos` (binary search). */
  const blockAt = (pos: number): number => {
    let lo = 0;
    let hi = blockCount - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (plainStart[mid]! <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const readData = (pos: number, len: number, lru: Lru): Uint8Array => {
    let i = blockAt(pos);
    const first = block(i, lru);
    const start = pos - plainStart[i]!;
    if (start + len <= first.length) return first.subarray(start, start + len);
    const out = new Uint8Array(len);
    for (let done = 0; done < len; i++) {
      const bytes = block(i, lru);
      const from = pos + done - plainStart[i]!;
      const n = Math.min(len - done, bytes.length - from);
      out.set(bytes.subarray(from, from + n), done);
      done += n;
    }
    return out;
  };

  return {
    nodes,
    node: (name) => {
      const node = nodes.find((n) => n.name === name);
      if (!node) throw new GameDataError('corrupt', `bundle has no node ${name}`);
      const lru = isStreamed(name) ? streamed : objects;
      return {
        size: node.size,
        read: (off, len) => {
          checkRange(node, off, len);
          return len === 0 ? new Uint8Array(0) : readData(node.offset + off, len, lru);
        },
      };
    },
  };
};
