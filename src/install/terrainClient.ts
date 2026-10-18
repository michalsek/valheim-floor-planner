/**
 * Runs a terrain job in a Web Worker (`terrain.worker.ts`): one fresh worker per request,
 * terminated when it is done or when `signal` aborts (an `AbortError` then). Nothing
 * leaves the browser.
 */
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';

import type { TerrainJob, TerrainPhase, TerrainResult } from './terrainJob';

export type TerrainMessage =
  | { type: 'phase'; phase: TerrainPhase }
  | { type: 'done'; result: TerrainResult }
  | { type: 'error'; code: GameDataErrorCode; detail: string };

const aborted = () => new DOMException('Terrain cancelled', 'AbortError');

export const runTerrainWorker = (
  job: TerrainJob,
  onPhase: (phase: TerrainPhase) => void,
  signal?: AbortSignal
): Promise<TerrainResult> => {
  if (signal?.aborted) return Promise.reject(aborted());
  const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<TerrainResult>((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      finish();
      reject(aborted());
    };
    signal?.addEventListener('abort', cancel);
    worker.onmessage = ({ data }: MessageEvent<TerrainMessage>) => {
      if (data.type === 'phase') return onPhase(data.phase);
      finish();
      if (data.type === 'done') resolve(data.result);
      else reject(new GameDataError(data.code, data.detail));
    };
    worker.onerror = (event) => {
      finish();
      reject(new GameDataError('workerFailed', event.message || ''));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new GameDataError('workerFailed', 'The terrain could not be received.'));
    };
    worker.postMessage(job);
  });
};
