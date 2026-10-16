/**
 * Runs the game-data parser in a Web Worker: `File`s go in (cloned by reference, no
 * copying), plain JSON and progress messages come out. One parse at a time. The
 * worker is terminated afterwards (it holds ~150 MB at its peak).
 */
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';
import type { ExtractProgress, ExtractResult } from '../gameData/valheim/extractCatalogue';

import type { InstallFiles } from './locateInstall';

export interface ParseRequest {
  bundle: File;
  resources: File;
}

export type ParseMessage =
  | ({ type: 'progress' } & ExtractProgress)
  | { type: 'done'; result: ExtractResult }
  | { type: 'error'; code: GameDataErrorCode; detail: string };

interface Running {
  request: ParseRequest;
  promise: Promise<ExtractResult>;
  cancel(): void;
}

let running: Running | null = null;

const sameFiles = (a: ParseRequest, b: ParseRequest) =>
  a.bundle === b.bundle && a.resources === b.resources;

/**
 * Parses `files` in a fresh worker. The same files while a parse runs share its
 * promise (StrictMode, double clicks); other files cancel it and start over.
 */
export const parseInstall = (
  files: InstallFiles,
  onProgress: (progress: ExtractProgress) => void
): Promise<ExtractResult> => {
  const request: ParseRequest = { bundle: files.bundle, resources: files.resources };
  if (running && sameFiles(running.request, request)) return running.promise;
  running?.cancel();

  const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
  let settle: { resolve(r: ExtractResult): void; reject(e: Error): void } | null = null;
  const promise = new Promise<ExtractResult>((resolve, reject) => {
    settle = { resolve, reject };
  });
  const finish = () => {
    worker.terminate();
    if (running?.promise === promise) running = null;
  };

  worker.onmessage = ({ data }: MessageEvent<ParseMessage>) => {
    if (data.type === 'progress') {
      onProgress({ phase: data.phase, objects: data.objects });
      return;
    }
    finish();
    if (data.type === 'done') settle!.resolve(data.result);
    else settle!.reject(new GameDataError(data.code, data.detail));
  };
  // The worker catches the parser's own errors, so this is a worker that didn't load.
  worker.onerror = (event) => {
    finish();
    settle!.reject(new GameDataError('workerFailed', event.message || ''));
  };

  worker.postMessage(request);
  running = {
    request,
    promise,
    cancel: () => {
      finish();
      settle!.reject(new DOMException('Scan cancelled', 'AbortError'));
    },
  };
  return promise;
};

/** Stops a running parse; its promise rejects with an AbortError. */
export const cancelParse = (): void => running?.cancel();
