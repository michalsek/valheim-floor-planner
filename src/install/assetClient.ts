/**
 * Real piece models for the page: read from the OPFS cache when there, else extracted
 * by a persistent worker (`assets.worker.ts`) from the install's bundle. Requests made
 * in the same tick go to the worker as one batch; the worker is terminated after 60 s
 * idle (it holds the bundle's index, ~100 MB). Without persistent storage, models and
 * textures the worker posts are kept in memory for the session.
 */
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';
import type { TextureData } from '../gameData/unity/texture2d';
import type { PrefabModel } from '../gameData/valheim/extractModels';
import { decodeModel, decodeTexture } from '../gameData/valheim/modelFormat';

import { openAssetCache, type AssetCache } from './assetCache';
import { getCatalogueKey, getInstallFiles } from './loadInstall';

export type AssetRequest =
  | { type: 'open'; bundle: File; key: string }
  | { type: 'models'; names: string[] }
  | { type: 'textures'; ids: string[] }
  | { type: 'all' };

export type AssetMessage =
  | { type: 'model'; name: string; buf: ArrayBuffer }
  | { type: 'texture'; id: string; buf: ArrayBuffer | null }
  | { type: 'progress'; done: number; total: number }
  | { type: 'storage'; persistent: false; reason: string }
  | { type: 'error'; code: GameDataErrorCode; detail: string; request: AssetRequest['type'] };

export interface AssetState {
  /** Bytes cached for the loaded install; null until measured. */
  usage: number | null;
  /** "Extract all" progress while it runs. */
  progress: { done: number; total: number } | null;
  /** Every piece is cached. */
  complete: boolean;
  /** Nothing persists (no OPFS, quota, another tab): models live for this session only. */
  memoryOnly: boolean;
  /** The last extraction error, for the menu. */
  error: GameDataError | null;
}

const IDLE_MS = 60_000;

let state: AssetState = {
  usage: null,
  progress: null,
  complete: false,
  memoryOnly: false,
  error: null,
};
const listeners = new Set<() => void>();
const update = (changes: Partial<AssetState>) => {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
};
export const subscribeAssets = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getAssetState = (): AssetState => state;

interface Waiter<T> {
  resolve(value: T): void;
  reject(error: Error): void;
}

let worker: Worker | null = null;
let workerKey = '';
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const modelWaiters = new Map<string, Waiter<PrefabModel | null>[]>();
const textureWaiters = new Map<string, Waiter<TextureData | null>[]>();
let allWaiter: Waiter<void> | null = null;
const queued = { models: new Set<string>(), textures: new Set<string>() };
const memory = {
  models: new Map<string, PrefabModel | null>(),
  textures: new Map<string, TextureData>(),
};

let cache: { key: string; promise: Promise<AssetCache | null> } | null = null;
const currentCache = (): Promise<AssetCache | null> => {
  const key = getCatalogueKey();
  if (!key) return Promise.resolve(null);
  if (cache?.key !== key) {
    const promise = openAssetCache(key).then((opened) => {
      if (!opened) update({ memoryOnly: true });
      return opened;
    });
    cache = { key, promise };
  }
  return cache.promise;
};

const settle = <T>(waiters: Map<string, Waiter<T>[]>, id: string, value: T) => {
  waiters.get(id)?.forEach((w) => w.resolve(value));
  waiters.delete(id);
  scheduleIdle();
};

const failAll = (error: GameDataError, request: AssetRequest['type']) => {
  const reject = <T>(waiters: Map<string, Waiter<T>[]>) => {
    waiters.forEach((list) => list.forEach((w) => w.reject(error)));
    waiters.clear();
  };
  if (request === 'models' || request === 'open') reject(modelWaiters);
  if (request === 'textures' || request === 'open') reject(textureWaiters);
  if (request === 'all' || request === 'open') {
    allWaiter?.reject(error);
    allWaiter = null;
    update({ progress: null });
  }
  update({ error });
  scheduleIdle();
};

const onMessage = ({ data }: MessageEvent<AssetMessage>) => {
  switch (data.type) {
    case 'model': {
      const model = decodeModel(data.buf);
      if (state.memoryOnly) memory.models.set(data.name, model);
      return settle(modelWaiters, data.name, model);
    }
    case 'texture': {
      const texture = data.buf ? decodeTexture(data.buf) : null;
      if (texture && state.memoryOnly) memory.textures.set(data.id, texture);
      return settle(textureWaiters, data.id, texture);
    }
    case 'progress':
      update({ progress: data });
      if (data.done === data.total) {
        allWaiter?.resolve();
        allWaiter = null;
        update({ progress: null, complete: !state.memoryOnly });
        void refreshAssetUsage();
        scheduleIdle();
      }
      return;
    case 'storage':
      return update({ memoryOnly: true });
    case 'error':
      return failAll(new GameDataError(data.code, data.detail), data.request);
  }
};

const busy = () => modelWaiters.size > 0 || textureWaiters.size > 0 || allWaiter !== null;

function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (!worker || busy()) return;
  idleTimer = setTimeout(() => {
    worker?.terminate();
    worker = null;
  }, IDLE_MS);
}

/** The worker, opened on the install's bundle; throws when the files aren't at hand. */
const ensureWorker = (): Worker => {
  const files = getInstallFiles();
  const key = getCatalogueKey();
  if (!files || !key) {
    throw new GameDataError('permission', 'Reconnect the Valheim folder to load models.');
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (worker && workerKey === key) return worker;
  worker?.terminate();
  worker = new Worker(new URL('./assets.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = onMessage;
  worker.onerror = (event) => {
    worker?.terminate();
    worker = null;
    failAll(new GameDataError('workerFailed', event.message || ''), 'open');
  };
  workerKey = key;
  worker.postMessage({ type: 'open', bundle: files.bundle, key } satisfies AssetRequest);
  return worker;
};

/** Sends the requests queued this tick as one batch each. */
const flush = () => {
  const names = [...queued.models];
  const ids = [...queued.textures];
  queued.models.clear();
  queued.textures.clear();
  try {
    const w = ensureWorker();
    if (names.length) w.postMessage({ type: 'models', names } satisfies AssetRequest);
    if (ids.length) w.postMessage({ type: 'textures', ids } satisfies AssetRequest);
  } catch (error) {
    failAll(error as GameDataError, 'open');
  }
};

const request = <T>(waiters: Map<string, Waiter<T>[]>, queue: Set<string>, id: string) =>
  new Promise<T>((resolve, reject) => {
    const list = waiters.get(id);
    if (list) return list.push({ resolve, reject });
    waiters.set(id, [{ resolve, reject }]);
    if (queued.models.size + queued.textures.size === 0) queueMicrotask(flush);
    queue.add(id);
  });

/** A piece's model (null when it draws nothing): from the cache, else extracted. */
export const loadModel = async (name: string): Promise<PrefabModel | null> => {
  if (memory.models.has(name)) return memory.models.get(name)!;
  const cached = await (await currentCache())?.model(name);
  if (cached !== undefined) return cached;
  return request(modelWaiters, queued.models, name);
};

/** A texture by path ID (from a model's materials); null when it can't be read. */
export const loadTexture = async (id: string): Promise<TextureData | null> => {
  const kept = memory.textures.get(id);
  if (kept) return kept;
  const cached = await (await currentCache())?.texture(id);
  if (cached) return cached;
  return request(textureWaiters, queued.textures, id);
};

/** Extracts every piece into the cache (about 35 MB), reporting progress in the state. */
export const extractAll = (): Promise<void> => {
  if (allWaiter) return Promise.reject(new Error('Extraction already running'));
  return new Promise<void>((resolve, reject) => {
    allWaiter = { resolve, reject };
    update({ error: null, progress: { done: 0, total: 0 } });
    try {
      ensureWorker().postMessage({ type: 'all' } satisfies AssetRequest);
    } catch (error) {
      failAll(error as GameDataError, 'all');
    }
  });
};

/** Measures the cache; also reads whether "Extract all" finished. */
export const refreshAssetUsage = async (): Promise<void> => {
  const opened = await currentCache();
  if (!opened) return update({ usage: 0 });
  const [usage, index] = await Promise.all([opened.usage(), opened.index()]);
  update({ usage, complete: index?.complete ?? false });
};

/** Deletes this install's cached models (the worker is stopped first: it may hold files). */
export const clearAssetCache = async (): Promise<void> => {
  worker?.terminate();
  worker = null;
  failAll(new GameDataError('busy', 'The model cache was cleared.'), 'open');
  memory.models.clear();
  memory.textures.clear();
  await (await currentCache())?.clear();
  update({ complete: false, error: null });
  await refreshAssetUsage();
};
