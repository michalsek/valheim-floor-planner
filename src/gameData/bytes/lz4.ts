/**
 * LZ4 block-format decoder (Unity's LZ4 and LZ4HC blocks; no frame format). Throws
 * `corrupt` on any out-of-range length or offset, and when the output isn't exactly
 * `outSize` bytes. It is the parser's hot loop (~2,500 blocks of 128 KB per scan), so
 * it is written as one flat loop: no closures, byte copies for short runs.
 */
import { GameDataError } from '../GameDataError';

const corrupt = (detail: string) => new GameDataError('corrupt', `LZ4: ${detail}`);

/** Runs at least this long are copied natively; shorter ones byte by byte. */
const NATIVE_COPY = 32;

export const decompressLz4 = (src: Uint8Array, outSize: number): Uint8Array => {
  const out = new Uint8Array(outSize);
  const end = src.length;
  let ip = 0;
  let op = 0;

  while (ip < end) {
    const token = src[ip++]!;

    let literals = token >>> 4;
    if (literals === 15) {
      let b = 255;
      while (b === 255) {
        if (ip >= end) throw corrupt('input ends early');
        b = src[ip++]!;
        literals += b;
      }
    }
    if (ip + literals > end || op + literals > outSize) throw corrupt('literals overflow');
    if (literals >= NATIVE_COPY) {
      out.set(src.subarray(ip, ip + literals), op);
      ip += literals;
      op += literals;
    } else {
      for (const stop = ip + literals; ip < stop;) out[op++] = src[ip++]!;
    }
    // The last sequence is literals only.
    if (ip === end) break;

    if (ip + 2 > end) throw corrupt('input ends early');
    const offset = src[ip]! | (src[ip + 1]! << 8);
    ip += 2;
    if (offset === 0 || offset > op) throw corrupt(`offset ${offset} at ${op}`);

    let match = token & 15;
    if (match === 15) {
      let b = 255;
      while (b === 255) {
        if (ip >= end) throw corrupt('input ends early');
        b = src[ip++]!;
        match += b;
      }
    }
    match += 4;
    if (op + match > outSize) throw corrupt('match overflow');
    if (match >= NATIVE_COPY && offset >= match) {
      out.copyWithin(op, op - offset, op - offset + match);
      op += match;
    } else {
      // Also handles overlapping matches, which repeat the last `offset` bytes.
      for (let from = op - offset, stop = op + match; op < stop;) out[op++] = out[from++]!;
    }
  }

  if (op !== outSize) throw corrupt(`output is ${op} bytes, expected ${outSize}`);
  return out;
};
