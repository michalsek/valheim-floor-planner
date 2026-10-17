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
  /** Stores these pieces (every piece without `names`), reporting progress. */
  | { type: 'all'; names?: string[] };

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
  /** Bumped once the cache was cleared: models that failed meanwhile may load now. */
  generation: number;
}

const IDLE_MS = 60_000;

let state: AssetState = {
  usage: null,
  progress: null,
  complete: false,
  memoryOnly: false,
  error: null,
  generation: 0,
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

/** Asks once for storage that the browser won't evict under pressure. */
let persistAsked = false;
const askPersistence = () => {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => false);
};

let cache: { key: string; promise: Promise<AssetCache | null> } | null = null;
const currentCache = (): Promise<AssetCache | null> => {
  const key = getCatalogueKey();
  if (!key) return Promise.resolve(null);
  if (cache?.key !== key) {
    askPersistence();
    const promise = openAssetCache(key).then((opened) => {
      if (!opened) update({ memoryOnly: true });
      return opened;
    });
    cache = { key, promise };
  }
  return cache.promise;
};

/** Resolves the waiters of `id` with `read()`, or rejects them when it throws. */
const settle = <T>(waiters: Map<string, Waiter<T>[]>, id: string, read: () => T) => {
  const list = waiters.get(id) ?? [];
  waiters.delete(id);
  try {
    const value = read();
    list.forEach((w) => w.resolve(value));
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    list.forEach((w) => w.reject(failure));
  }
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
    case 'model':
      return settle(modelWaiters, data.name, () => {
        const model = decodeModel(data.buf);
        if (state.memoryOnly) memory.models.set(data.name, model);
        return model;
      });
    case 'texture':
      return settle(textureWaiters, data.id, () => {
        const texture = data.buf ? decodeTexture(data.buf) : null;
        if (texture && state.memoryOnly) memory.textures.set(data.id, texture);
        return texture;
      });
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

/**
 * Deletes this install's cached models (the worker is stopped first: it may hold
 * files). Models and textures being read are asked for again once it is empty; a
 * running "Extract all" stops.
 */
export const clearAssetCache = async (): Promise<void> => {
  worker?.terminate();
  worker = null;
  allWaiter?.reject(new GameDataError('busy', 'The model cache was cleared.'));
  allWaiter = null;
  update({ progress: null });
  memory.models.clear();
  memory.textures.clear();
  await (await currentCache())?.clear();
  update({ complete: false, error: null, generation: state.generation + 1 });
  // Still waited for: extracted again into the empty cache.
  modelWaiters.forEach((_, name) => queued.models.add(name));
  textureWaiters.forEach((_, id) => queued.textures.add(id));
  if (queued.models.size + queued.textures.size > 0) flush();
  await refreshAssetUsage();
};

/** The prefabs the 3D view last showed (extracted before a reload to another build). */
let wantedModels: readonly string[] = [];
export const noteWantedModels = (names: readonly string[]): void => {
  wantedModels = names;
};
export const getWantedModels = (): readonly string[] => wantedModels;

/**
 * Stores `names` into the cache of another install or game build (`key`), from its
 * bundle, with its own worker: used before a reload to it when its files won't survive
 * the reload (a dropped folder). Resolves once they are stored; never rejects.
 */
export const extractInto = (
  bundle: File,
  key: string,
  names: readonly string[],
  onProgress: (done: number, total: number) => void
): Promise<void> =>
  new Promise((resolve) => {
    if (names.length === 0) return resolve();
    const temp = new Worker(new URL('./assets.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      temp.terminate();
      resolve();
    };
    temp.onerror = finish;
    temp.onmessage = ({ data }: MessageEvent<AssetMessage>) => {
      if (data.type === 'error' || data.type === 'storage') return finish();
      if (data.type !== 'progress') return;
      onProgress(data.done, data.total);
      if (data.done === data.total) finish();
    };
    temp.postMessage({ type: 'open', bundle, key } satisfies AssetRequest);
    temp.postMessage({ type: 'all', names: [...names] } satisfies AssetRequest);
  });
