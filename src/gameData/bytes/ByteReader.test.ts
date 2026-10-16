import { describe, expect, it } from 'vitest';

import { ByteReader } from './ByteReader';

describe('ByteReader', () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x01, 0x02, 0x41, 0x42, 0x00, 0xff, 0x07, 0, 0, 0]);

  it('reads C strings and aligns relative to the start', () => {
    const r = new ByteReader(bytes, true);
    r.pos = 4;
    expect(r.cstr()).toBe('AB');
    expect(r.pos).toBe(7);
    r.align(4);
    expect(r.pos).toBe(8);
    expect(r.i32()).toBe(7);
  });

  it('throws instead of reading past the end', () => {
    const r = new ByteReader(bytes, true);
    r.pos = 10;
    expect(() => r.u32()).toThrow(/corrupt/);
    expect(() => new ByteReader(new Uint8Array([1, 2]), true).cstr()).toThrow(/corrupt/);
    // A count bigger than the bytes left.
    expect(() => new ByteReader(new Uint8Array([9, 0, 0, 0, 1]), true).count(1)).toThrow(/corrupt/);
  });
});
