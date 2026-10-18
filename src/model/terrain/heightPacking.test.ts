import { describe, expect, it } from 'vitest';

import { packHeights, unpackHeights } from './heightPacking';

describe('packed heights', () => {
  it('round-trips any int16 values, extremes and jumps included', async () => {
    const cols = 37;
    const heights = Int16Array.from({ length: cols * 23 }, (_, k) =>
      k % 11 === 0 ? (k % 2 ? 32767 : -32767) : Math.round(800 * Math.sin(k / 7))
    );
    const packed = await packHeights(heights, cols);
    expect([...(await unpackHeights(packed, cols, 23))]).toEqual([...heights]);
    // Packed once per array.
    expect(await packHeights(heights, cols)).toBe(packed);
  });

  it('refuses data that unpacks to more or fewer values than the patch', async () => {
    const packed = await packHeights(new Int16Array(40), 8);
    await expect(unpackHeights(packed, 8, 4)).rejects.toThrow();
    await expect(unpackHeights(packed, 8, 6)).rejects.toThrow();
  });
});
