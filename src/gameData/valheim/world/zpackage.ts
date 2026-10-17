/**
 * The ZPackage primitives a world save uses on top of `ByteReader` (little-endian
 * .NET `BinaryWriter` output): length-prefixed strings, item counts and packed
 * rotations. Layouts: research/README.md §7.
 */
import type { ByteReader } from '../../bytes/ByteReader';
import { GameDataError } from '../../GameDataError';

/** World versions: v31 starts the current ZDO encoding, v33 varint counts, v40 chunks. */
export const MIN_WORLD_VERSION = 31;
export const NUM_ITEMS_VERSION = 33;
export const CHUNKED_VERSION = 40;
/** The newest version this reader knows (Valheim 1.0.20). */
export const MAX_WORLD_VERSION = 42;

export const isKnownVersion = (version: number): boolean =>
  version >= MIN_WORLD_VERSION && version <= MAX_WORLD_VERSION;

/** A .NET 7-bit varint (a string's byte length). */
const varint = (r: ByteReader): number => {
  let value = 0;
  for (let shift = 0; shift < 35; shift += 7) {
    const byte = r.u8();
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return value >>> 0;
  }
  throw new GameDataError('corrupt', `bad string length at ${r.pos}`);
};

/** A `BinaryWriter` string: varint byte length, then UTF-8. */
export const readString = (r: ByteReader): string => r.str(varint(r));

export const skipString = (r: ByteReader): void => void r.bytesView(varint(r));

/** A data section's item count: one byte, or two (big-endian, high bit set) from v33. */
export const readNumItems = (r: ByteReader, version: number): number => {
  const first = r.u8();
  if (version < NUM_ITEMS_VERSION || !(first & 0x80)) return first;
  return ((first & 0x7f) << 8) | r.u8();
};

/**
 * `SmallRotation` (v40+): Euler degrees in 0.5° steps, truncated by the writer. Yaw-only
 * pieces take 2 bytes (high bit set); otherwise 30 bits hold x, y and z.
 */
export const readSmallRotation = (r: ByteReader): [x: number, y: number, z: number] => {
  const a = r.u16();
  if (a & 0x8000) return [0, (a & 0x7fff) * 0.5, 0];
  const packed = a * 0x10000 + r.u16();
  return [(packed & 1023) * 0.5, ((packed >>> 10) & 1023) * 0.5, ((packed >>> 20) & 1023) * 0.5];
};
