import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodeComps } from './terrainJob';

/** A `TCData` payload (gzip) of `version` with no edited vertex and no paint. */
const payload = (version: number): Uint8Array<ArrayBuffer> => {
  const view = new DataView(new ArrayBuffer(4 + 4 + 16 + 4 + 4225 + 4));
  view.setInt32(0, version, true);
  view.setInt32(24, 4225, true);
  return new Uint8Array(gzipSync(new Uint8Array(view.buffer)));
};

describe('decodeComps', () => {
  it('leaves out and counts a zone whose edits it can’t read', async () => {
    const { comps, unread } = await decodeComps([
      { zx: 0, zz: 0, data: payload(1) },
      { zx: 1, zz: 0, data: payload(2) },
      { zx: 2, zz: 0, data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(comps.map((c) => c.zx)).toEqual([0]);
    expect(unread).toBe(2);
  });
});
