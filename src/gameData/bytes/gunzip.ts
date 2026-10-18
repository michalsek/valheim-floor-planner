/**
 * gzip decompression with the platform's `DecompressionStream` (every current browser,
 * workers and Node 18+), so no library ships. The game gzips the `.db2` ZoneSystem block
 * and each `TerrainComp` payload (`Utils.Compress`).
 */
import { GameDataError } from '../GameDataError';

export const gunzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  try {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new GameDataError('corrupt', `bad gzip data (${(error as Error).message})`);
  }
};
