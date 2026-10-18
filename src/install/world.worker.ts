/**
 * The world reader's worker: reads the posted `File`s and keeps the built pieces, plus
 * what the terrain needs (seed, terrain edits, `.db2` locations; the `.db2` gunzip is
 * why it is async). Player IDs are reduced to "built" inside the decoder; the `.fwl2`
 * player history is never parsed. No network.
 */
import {
  readChunkedWorld,
  readLegacyDb,
  type WorldScan,
} from '../gameData/valheim/world/readWorld';
import { scanPrefabs } from '../gameData/valheim/world/worldPrefabs';

import { asGameDataError } from './fileErrors';
import { fileSource } from './fileSource';
import type { WorldMessage, WorldRequest } from './worldClient';

const post = (message: WorldMessage, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

const progress = (done: number, total: number) => post({ type: 'progress', done, total });

const readAll = (file: File): Uint8Array => fileSource(file).read(0, file.size);

const read = (data: WorldRequest): Promise<WorldScan> | WorldScan => {
  const names = scanPrefabs(data.prefabs);
  if (data.kind === 'db') return readLegacyDb(readAll(data.file), data.file.name, names, progress);
  return readChunkedWorld(
    {
      names: Object.keys(data.files),
      size: (name) => data.files[name]!.size,
      read: (name) => readAll(data.files[name]!),
    },
    names,
    progress
  );
};

/** Every typed array of a scan, moved rather than copied. */
const buffersOf = ({ pieces, terrainComps, legacyEdits, locations }: WorldScan): ArrayBuffer[] => [
  pieces.prefabIndex.buffer,
  pieces.position.buffer,
  pieces.rotation.buffer,
  ...terrainComps.map((comp) => comp.data.buffer),
  legacyEdits.buffer,
  ...(locations ? [locations.position.buffer, locations.hash.buffer] : []),
];

self.onmessage = async ({ data }: MessageEvent<WorldRequest>) => {
  try {
    const scan = await read(data);
    post({ type: 'done', scan }, buffersOf(scan));
  } catch (error) {
    const { code, detail } = asGameDataError(error);
    post({ type: 'error', code, detail });
  }
};
