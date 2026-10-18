/**
 * Which palette thumbnails exist, and making the missing ones: tiles say when they are
 * in view (`wantThumbnail`) and out of it again; a wanted prefab is read from the
 * IndexedDB cache, else rendered, one per animation frame at most, so scrolling and
 * typing stay smooth. Prefabs whose model can't be read keep their glyph until the game
 * folder or the model cache changes. The renderer is released after a while idle.
 */
import { ASSET_VERSION } from '../../gameData/valheim/constants';
import { getAssetState, subscribeAssets } from '../../install/assetClient';
import { getCatalogueKey, getInstallState, subscribeInstall } from '../../install/loadInstall';

import { NO_MODEL, pruneThumbnails, readThumbnail, writeThumbnail } from './thumbnailCache';
import { releaseThumbnails, renderThumbnail } from './thumbnailRenderer';

/** Bump when the camera, lighting or size change, so cached thumbnails are redrawn. */
const THUMB_VERSION = 1;
/** How long the renderer stays after its last thumbnail. */
const IDLE_RELEASE_MS = 20_000;

/** A prefab's thumbnail URL, or why there is none (the tile shows its glyph). */
type Entry = { url: string } | 'none' | 'failed';

const entries = new Map<string, Entry>();
const wanted = new Set<string>();
const queue: string[] = [];
const listeners = new Map<string, Set<() => void>>();
let prefix: string | null = null;
let running = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const notify = (prefab: string) => listeners.get(prefab)?.forEach((listener) => listener());

const settle = (prefab: string, entry: Entry) => {
  entries.set(prefab, entry);
  notify(prefab);
};

/** The cache keys' start for a game build (null: no install loaded). */
const prefixOf = (key: string | null): string | null =>
  key ? `${key}|a${ASSET_VERSION}|t${THUMB_VERSION}|` : null;

/**
 * Moves over to the loaded build's keys when it changed: the old thumbnails go (URLs
 * revoked, stale cache entries pruned), every tile is told, and tiles in view ask
 * again. Called from the install listener and the queue, never during render.
 */
const syncPrefix = (): string | null => {
  const next = prefixOf(getCatalogueKey());
  if (next === prefix) return prefix;
  for (const entry of entries.values())
    if (typeof entry === 'object') URL.revokeObjectURL(entry.url);
  entries.clear();
  queue.length = 0;
  prefix = next;
  if (next) void pruneThumbnails(next);
  listeners.forEach((set) => set.forEach((listener) => listener()));
  if (next) wanted.forEach((prefab) => enqueue(prefab));
  return prefix;
};

// Models that failed may load once the folder is back or the cache was cleared.
const forgetFailures = () => {
  for (const [prefab, entry] of entries) {
    if (entry !== 'failed') continue;
    entries.delete(prefab);
    if (wanted.has(prefab)) enqueue(prefab);
  }
};
const retryToken = () => `${getInstallState().assetFiles}:${getAssetState().generation}`;
let lastToken = retryToken();
const onRetry = () => {
  const token = retryToken();
  if (token === lastToken) return;
  lastToken = token;
  forgetFailures();
};
subscribeInstall(() => {
  syncPrefix();
  onRetry();
});
subscribeAssets(onRetry);

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const scheduleRelease = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (!running) void releaseThumbnails();
  }, IDLE_RELEASE_MS);
};

/** Renders the queue's wanted prefabs, one per frame. */
const drain = async () => {
  if (running) return;
  running = true;
  if (idleTimer) clearTimeout(idleTimer);
  try {
    while (queue.length > 0) {
      const prefab = queue.shift()!;
      const keyPrefix = syncPrefix();
      if (!wanted.has(prefab) || entries.has(prefab) || !keyPrefix) continue;
      await nextFrame();
      try {
        const blob = await renderThumbnail(prefab);
        if (syncPrefix() !== keyPrefix) continue;
        void writeThumbnail(keyPrefix + prefab, blob ?? NO_MODEL);
        settle(prefab, blob ? { url: URL.createObjectURL(blob) } : 'none');
      } catch {
        settle(prefab, 'failed');
      }
    }
  } finally {
    running = false;
    scheduleRelease();
  }
};

/** Reads the cache, else queues a render. */
const enqueue = (prefab: string) => {
  const keyPrefix = syncPrefix();
  if (!keyPrefix) return;
  void readThumbnail(keyPrefix + prefab).then((cached) => {
    if (entries.has(prefab) || syncPrefix() !== keyPrefix) return;
    if (cached === NO_MODEL) return settle(prefab, 'none');
    if (cached) return settle(prefab, { url: URL.createObjectURL(cached) });
    if (!wanted.has(prefab) || queue.includes(prefab)) return;
    queue.push(prefab);
    void drain();
  });
};

/** The prefab's thumbnail URL; null while there is none (yet). Reads only. */
export const getThumbnail = (prefab: string): string | null => {
  // Entries of a build just replaced, before the install listener has run.
  if (prefix !== prefixOf(getCatalogueKey())) return null;
  const entry = entries.get(prefab);
  return typeof entry === 'object' ? entry.url : null;
};

export const subscribeThumbnail = (prefab: string, listener: () => void): (() => void) => {
  let set = listeners.get(prefab);
  if (!set) listeners.set(prefab, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(prefab);
  };
};

/** The prefab's tile came into view: its thumbnail is wanted. */
export const wantThumbnail = (prefab: string): void => {
  wanted.add(prefab);
  if (!entries.has(prefab)) enqueue(prefab);
};

/** Out of view again: a render not started yet is dropped. */
export const unwantThumbnail = (prefab: string): void => {
  wanted.delete(prefab);
  const i = queue.indexOf(prefab);
  if (i >= 0) queue.splice(i, 1);
};
