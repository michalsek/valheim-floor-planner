/// <reference types="node" />
/**
 * Ground truth for the gated terrain test (`realTerrain.test.ts`): the world's
 * vegetation, which the game placed on its own terrain collider, so its y is the ground
 * there (research/README.md §8, `validateTerrain.py`). Node-only; the app never imports it.
 */
import { ByteReader } from '../../bytes/ByteReader';
import { readZdo } from '../world/readZdo';
import { stableHash } from '../world/stableHash';
import { chunkFileName, generationFile, newestGeneration, readManifest } from '../world/worldFiles';
import type { WorldFolderFiles } from '../world/readWorld';

import { zoneOf } from './heightmap';

/** Trees, rocks and pickables whose pivot sits on the ground (no offset). */
const VEGETATION = new Set(
  [
    'Beech1',
    'Beech_small1',
    'Beech_small2',
    'Bush01',
    'Rock_4',
    'Pickable_Stone',
    'Pickable_Branch',
    'FirTree',
    'FirTree_small',
    'Pinetree_01',
    'shrub_2',
    'Pickable_Flint',
    'Pickable_Dandelion',
    'Birch1',
    'Birch2',
    'Oak1',
    'Pickable_Mushroom',
    'RaspberryBush',
    'BlueberryBush',
    'stubbe',
    'Pickable_Thistle',
  ].map(stableHash)
);

export interface ZoneVegetation {
  zx: number;
  zz: number;
  /** x, y, z per object (world metres, game axes). */
  points: number[];
}

/** The vegetation of a chunked world, by zone. */
export const readVegetation = (files: WorldFolderFiles): Map<string, ZoneVegetation> => {
  const generation = newestGeneration(files.names);
  if (generation === null) throw new Error('No complete save in the folder');
  const manifest = readManifest(files.read(generationFile(generation, 'chunks')));
  const zones = new Map<string, ZoneVegetation>();
  for (const entry of manifest.entries) {
    const r = new ByteReader(files.read(chunkFileName(entry)), true);
    const version = r.i16();
    const count = r.i32();
    for (let i = 0; i < count; i++) {
      const zdo = readZdo(r, version);
      if (!VEGETATION.has(zdo.prefab)) continue;
      const zx = zoneOf(zdo.x);
      const zz = zoneOf(zdo.z);
      const key = `${zx},${zz}`;
      let zone = zones.get(key);
      if (!zone) zones.set(key, (zone = { zx, zz, points: [] }));
      zone.points.push(zdo.x, zdo.y, zdo.z);
    }
  }
  return zones;
};
