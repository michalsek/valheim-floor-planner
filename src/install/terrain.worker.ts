/**
 * The terrain worker: one site's ground per worker (`terrainJob.ts`), with each phase
 * posted as it starts. The heights and a new pregeneration are transferred. No network.
 */
import { asGameDataError } from './fileErrors';
import type { TerrainMessage } from './terrainClient';
import { runTerrainJob, type TerrainJob } from './terrainJob';

const post = (message: TerrainMessage, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

self.onmessage = async ({ data }: MessageEvent<TerrainJob>) => {
  try {
    const result = await runTerrainJob(data, (phase) => post({ type: 'phase', phase }));
    const transfer = [result.heights.buffer, ...(result.rivers ? [result.rivers] : [])];
    post({ type: 'done', result }, transfer);
  } catch (error) {
    const { code, detail } = asGameDataError(error);
    post({ type: 'error', code, detail });
  }
};
