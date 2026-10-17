/**
 * Reads a world save in a Web Worker (`world.worker.ts`): `File`s go in, the built
 * pieces come out as typed arrays (transferred, not copied), with progress in between.
 * One fresh worker per read, terminated afterwards. Nothing leaves the browser.
 */
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';
import type { WorldScan } from '../gameData/valheim/world/readWorld';

export type WorldRequest = (
  { kind: 'folder'; files: Record<string, File> } | { kind: 'db'; file: File }
) & {
  /** The catalogue's prefab names: what counts as a piece. */
  prefabs: string[];
};

export type WorldMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; scan: WorldScan }
  | { type: 'error'; code: GameDataErrorCode; detail: string };

let running: { cancel(): void } | null = null;

export const scanWorld = (
  request: WorldRequest,
  onProgress: (done: number, total: number) => void
): Promise<WorldScan> => {
  running?.cancel();
  const worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<WorldScan>((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      running = null;
    };
    worker.onmessage = ({ data }: MessageEvent<WorldMessage>) => {
      if (data.type === 'progress') return onProgress(data.done, data.total);
      finish();
      if (data.type === 'done') resolve(data.scan);
      else reject(new GameDataError(data.code, data.detail));
    };
    worker.onerror = (event) => {
      finish();
      reject(new GameDataError('workerFailed', event.message || ''));
    };
    // A message that can't be cloned back (it shouldn't happen): as a failed worker.
    worker.onmessageerror = () => {
      finish();
      reject(new GameDataError('workerFailed', 'The reader’s result could not be received.'));
    };
    running = {
      cancel: () => {
        finish();
        reject(new DOMException('Scan cancelled', 'AbortError'));
      },
    };
    worker.postMessage(request);
  });
};

export const cancelWorldScan = (): void => running?.cancel();
