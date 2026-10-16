import { describe, expect, it } from 'vitest';

import { decompressLz4 } from './lz4';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('decompressLz4', () => {
  it('copies an overlapping match', () => {
    // 2 literals "ab", then a 6-byte match at offset 2, then 1 literal "c".
    const src = new Uint8Array([0x22, 0x61, 0x62, 0x02, 0x00, 0x10, 0x63]);
    expect(text(decompressLz4(src, 9))).toBe('ababababc');
  });

  it('extends lengths with 255-runs', () => {
    // 15 + 255 + 3 = 273 literals.
    const literals = new Uint8Array(273).fill(0x78);
    const src = new Uint8Array([0xf0, 255, 3, ...literals]);
    expect(decompressLz4(src, 273)).toEqual(literals);
  });

  it('rejects bad offsets and wrong sizes', () => {
    expect(() => decompressLz4(new Uint8Array([0x10, 0x61, 0x05, 0x00]), 5)).toThrow(/corrupt/);
    expect(() => decompressLz4(new Uint8Array([0x10, 0x61]), 2)).toThrow(/corrupt/);
  });
});
