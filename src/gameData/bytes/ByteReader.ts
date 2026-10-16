/**
 * Sequential reads over a byte array in one endianness. Every read is bounds-checked
 * and throws `corrupt` past the end, so malformed input can't run away.
 */
import { check, GameDataError } from '../GameDataError';

const utf8 = new TextDecoder('utf-8');

export class ByteReader {
  readonly bytes: Uint8Array;
  readonly little: boolean;
  pos = 0;
  private readonly view: DataView;

  constructor(bytes: Uint8Array, little: boolean) {
    this.bytes = bytes;
    this.little = little;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.pos;
  }

  /** Reserves `n` bytes and returns where they start. */
  private take(n: number): number {
    const at = this.pos;
    if (n < 0 || n > this.bytes.length - at) {
      throw new GameDataError('corrupt', `read of ${n} bytes past the end at ${at}`);
    }
    this.pos = at + n;
    return at;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  i8(): number {
    return this.view.getInt8(this.take(1));
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  u16(): number {
    return this.view.getUint16(this.take(2), this.little);
  }

  i16(): number {
    return this.view.getInt16(this.take(2), this.little);
  }

  u32(): number {
    return this.view.getUint32(this.take(4), this.little);
  }

  i32(): number {
    return this.view.getInt32(this.take(4), this.little);
  }

  i64(): bigint {
    return this.view.getBigInt64(this.take(8), this.little);
  }

  u64(): bigint {
    return this.view.getBigUint64(this.take(8), this.little);
  }

  f32(): number {
    return this.view.getFloat32(this.take(4), this.little);
  }

  f64(): number {
    return this.view.getFloat64(this.take(8), this.little);
  }

  /** An i64 that must fit a JS number (offsets and sizes). */
  safe64(): number {
    const value = this.i64();
    check(value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER), () => `bad offset ${value}`);
    return Number(value);
  }

  /** A view of the next `n` bytes (not a copy). */
  bytesView(n: number): Uint8Array {
    const at = this.take(n);
    return this.bytes.subarray(at, at + n);
  }

  /** A UTF-8 string of `n` bytes. */
  str(n: number): string {
    return utf8.decode(this.bytesView(n));
  }

  /** A NUL-terminated UTF-8 string. */
  cstr(): string {
    const end = this.bytes.indexOf(0, this.pos);
    check(end >= 0, () => `unterminated string at ${this.pos}`);
    const value = utf8.decode(this.bytes.subarray(this.pos, end));
    this.pos = end + 1;
    return value;
  }

  /** Skips to the next multiple of `n` (relative to the array start). */
  align(n: number): void {
    const pad = (n - (this.pos % n)) % n;
    this.take(Math.min(pad, this.remaining));
  }

  /** A count of items at least `minItemSize` bytes each, checked against what's left. */
  count(minItemSize: number): number {
    const n = this.i32();
    check(n >= 0 && n * minItemSize <= this.remaining, () => `bad count ${n} at ${this.pos - 4}`);
    return n;
  }
}
