/**
 * The world reader's worker: reads the posted `File`s synchronously and keeps the
 * built pieces. Player IDs are reduced to "built" inside the decoder; the `.fwl2`
 * player history is never parsed. No network.
 */
import { readChunkedWorld, readLegacyDb } from '../gameData/valheim/world/readWorld';
import { scanPrefabs } from '../gameData/valheim/world/worldPrefabs';

import { asGameDataError } from './fileErrors';
import { fileSource } from './fileSource';
import type { WorldMessage, WorldRequest } from './worldClient';

const post = (message: WorldMessage, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

const progress = (done: number, total: number) => post({ type: 'progress', done, total });

const readAll = (file: File): Uint8Array => fileSource(file).read(0, file.size);

self.onmessage = ({ data }: MessageEvent<WorldRequest>) => {
  try {
    const names = scanPrefabs(data.prefabs);
    const scan =
      data.kind === 'db'
        ? readLegacyDb(readAll(data.file), data.file.name, names, progress)
        : readChunkedWorld(
            {
              names: Object.keys(data.files),
              size: (name) => data.files[name]!.size,
              read: (name) => readAll(data.files[name]!),
            },
            names,
            progress
          );
    const { pieces } = scan;
    post({ type: 'done', scan }, [
      pieces.prefabIndex.buffer,
      pieces.position.buffer,
      pieces.rotation.buffer,
    ]);
  } catch (error) {
    const { code, detail } = asGameDataError(error);
    post({ type: 'error', code, detail });
  }
};
