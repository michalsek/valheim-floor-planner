import { describe, expect, it } from 'vitest';

import { cloudPiece } from '../../../model/world/pieceCloud';

import { readChunkedWorld, readLegacyDb, type WorldFolderFiles } from './readWorld';
import { stableHash } from './stableHash';
import { chunkedWorld, legacyDb, type FixtureZdo } from './worldFixture';
import { scanPrefabs } from './worldPrefabs';

const PLAYER = 0x7fff_1234_5678n;
const prefabs = scanPrefabs(['woodwall', 'wood_floor', 'piece_chest_wood', 'wood_beam', 'Cart']);

/** Built pieces among ruins, a cart, other objects and every kind of extra data. */
const hut: FixtureZdo[] = [
  { prefab: 'wood_floor', position: [10, 30, 20], creator: PLAYER, ints: 130 },
  { prefab: 'woodwall', position: [11, 31, 19], rotation: [0, 22.49, 0], creator: PLAYER },
  { prefab: 'piece_chest_wood', position: [10.5, 30, 20.5], creator: PLAYER, strings: ['hi'] },
  { prefab: 'woodwall', position: [500, 40, 500], bytes: 9 }, // a ruin: no creator
  { prefab: 'woodwall', position: [12, 31, 19], creator: 0n, connection: true },
  { prefab: 'Cart', position: [8, 30, 20], creator: PLAYER },
  { prefab: 'Rock_3', position: [3, 0, 4], rotation: [10, 20, 30], smallPosition: true },
];
const shed: FixtureZdo[] = [
  { prefab: 'wood_beam', position: [60, 32, 60], rotation: [45, 67.5, 0], creator: PLAYER },
];

const folder = (files: Map<string, Uint8Array>): WorldFolderFiles => ({
  names: [...files.keys()],
  size: (name) => files.get(name)!.length,
  read: (name) => files.get(name)!,
});

const world = () =>
  chunkedWorld(
    'Fixture',
    7,
    new Map([
      [0x2020, hut],
      [0x2120, shed],
    ])
  );

describe('reading a world', () => {
  it('hashes names as the game does', () => {
    expect(['woodwall', 'wood_floor', 'piece_chest_wood', 'creator'].map(stableHash)).toEqual([
      -523056075, -1045925142, 328745978, 881008290,
    ]);
  });

  it('keeps the pieces players built, and only those', () => {
    const files = world();
    // A stale, incomplete generation is ignored.
    files.set('_main.8.fwl2', new Uint8Array(4));
    const scan = readChunkedWorld(folder(files), prefabs);
    expect(scan).toMatchObject({ name: 'Fixture', version: 42, generation: 7, zdos: 8 });
    const pieces = Array.from({ length: scan.pieces.prefabIndex.length }, (_, i) =>
      cloudPiece(scan.pieces, i)
    );
    expect(pieces.map((p) => p.prefab)).toEqual([
      'wood_floor',
      'woodwall',
      'piece_chest_wood',
      'wood_beam',
    ]);
    // 22.49° is saved as 22.0° and snapped back; the beam keeps its pitch.
    expect(pieces[1]).toMatchObject({ x: 11, y: 31, z: 19, yaw: 22.5 });
    expect(pieces[3]).toMatchObject({ pitch: 45, yaw: 67.5, roll: 0 });
  });

  it('reads a legacy .db the same way', () => {
    const scan = readLegacyDb(legacyDb([...hut, ...shed]), 'Old.db', prefabs);
    expect(scan).toMatchObject({ name: 'Old', version: 34, generation: null, zdos: 8 });
    expect(scan.pieces.prefabIndex.length).toBe(4);
    expect(cloudPiece(scan.pieces, 1).yaw).toBe(22.5);
  });

  it('refuses unknown versions, missing chunks and stray bytes', () => {
    expect(() => readLegacyDb(legacyDb(hut, 30), 'Old.db', prefabs)).toThrow(/unsupported/);
    const missing = world();
    missing.delete([...missing.keys()].find((n) => n.endsWith('.chunk'))!);
    expect(() => readChunkedWorld(folder(missing), prefabs)).toThrow(/incomplete/);
    const stray = world();
    const name = [...stray.keys()].find((n) => n.endsWith('.chunk'))!;
    stray.set(name, Uint8Array.from([...stray.get(name)!, 0]));
    expect(() => readChunkedWorld(folder(stray), prefabs)).toThrow(/after its last object/);
    expect(() => readChunkedWorld(folder(new Map()), prefabs)).toThrow(/notWorld/);
    const cut = world();
    cut.set(name, stray.get(name)!.subarray(0, 40));
    expect(() => readChunkedWorld(folder(cut), prefabs)).toThrow(new RegExp(name));
    const unfinished = world();
    unfinished.delete('_main.7.ok');
    expect(() => readChunkedWorld(folder(unfinished), prefabs)).toThrow(/missing files/);
  });
});
