import { describe, expect, it } from 'vitest';

import { decodeWorld, encodeWorld, type StoredWorld } from './worldCodec';

const world: StoredWorld = {
  name: 'Fixture',
  version: 42,
  generation: 7,
  zdos: 9,
  skipped: 2,
  pieces: {
    prefabs: ['woodwall', 'wood_floor'],
    prefabIndex: Uint16Array.of(0, 1, 1),
    position: Float32Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9),
    rotation: Float32Array.of(0, 22.5, 0, 0, 90, 0, 0, 0, 0),
  },
  site: { seed: -42, worldGenVersion: 2 },
  terrainComps: [
    { zx: 2, zz: -1, data: Uint8Array.of(0x1f, 0x8b, 1) },
    { zx: 3, zz: -1, data: Uint8Array.of(0x1f, 0x8b, 2, 3, 4) },
  ],
  legacyEdits: Float32Array.of(130.5, -60.25),
  locations: { position: Float32Array.of(500.5, 42.25, -800), hash: Int32Array.of(-7) },
};

describe('the kept world file', () => {
  it('round-trips every section, odd lengths included', async () => {
    const buffer = await encodeWorld(world).arrayBuffer();
    expect(decodeWorld(buffer)).toEqual(world);
    const legacy = { ...world, site: null, locations: null, terrainComps: [] };
    expect(decodeWorld(await encodeWorld(legacy).arrayBuffer())).toEqual(legacy);
  });

  it('reads an older format as nothing and a cut one as an error', async () => {
    const old = new TextEncoder().encode('    {"name":"Old"}');
    new DataView(old.buffer).setUint32(0, 14, true);
    expect(decodeWorld(old.buffer)).toBeNull();
    const buffer = await encodeWorld(world).arrayBuffer();
    expect(() => decodeWorld(buffer.slice(0, buffer.byteLength - 1))).toThrow();
  });
});
