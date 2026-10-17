/**
 * The world panel's state: finding a world save in what the user drops or picks,
 * reading its built pieces in a worker (or from the cache), and the worlds kept.
 *
 *   start → listing → (choosing) → scanning → ready | error
 *
 * Read-only and local: files are only read, nothing is sent anywhere.
 */
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';
import { newestGeneration } from '../gameData/valheim/world/worldFiles';
import { getLibrary } from '../store/libraryInstance';

import { pickDirectory } from './directory';
import type { DroppedItem } from './dropFolder';
import { asGameDataError } from './fileErrors';
import {
  forgetCachedWorld,
  listCachedWorlds,
  loadCachedWorld,
  saveCachedWorld,
  touchCachedWorld,
  worldKey,
  type CachedWorld,
  type StoredWorld,
} from './worldCache';
import { cancelWorldScan, scanWorld, type WorldRequest } from './worldClient';
import {
  worldsFromDrop,
  worldsFromFiles,
  worldsFromHandle,
  type WorldCandidate,
} from './worldSource';

export interface LoadedWorld extends StoredWorld {
  key: string;
  /** Opened from the cache rather than read. */
  fromCache: boolean;
  /** How long reading (or opening) it took, in ms. */
  readMs: number;
}

export type WorldStatus =
  | { kind: 'start' }
  | { kind: 'listing' }
  | { kind: 'choosing'; candidates: WorldCandidate[] }
  | { kind: 'scanning'; name: string; done: number; total: number }
  | { kind: 'ready'; world: LoadedWorld }
  | { kind: 'error'; code: GameDataErrorCode; detail: string };

export interface WorldState {
  /** The world panel is showing. */
  open: boolean;
  status: WorldStatus;
  /** Worlds kept in this browser, newest first. */
  recent: CachedWorld[];
}

let state: WorldState = { open: false, status: { kind: 'start' }, recent: [] };
const listeners = new Set<() => void>();

const update = (changes: Partial<WorldState>) => {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
};
const setStatus = (status: WorldStatus) => update({ status });

export const getWorldState = (): WorldState => state;
export const subscribeWorld = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const refreshRecent = async () => update({ recent: await listCachedWorlds() });

/**
 * Each open (a drop, a pick, a kept world, going back) takes a new token and cancels the
 * scan running for the last one; results of an older open are dropped.
 */
let openToken = 0;

const beginOpen = () => {
  cancelWorldScan();
  const token = ++openToken;
  const live = () => token === openToken;
  return {
    live,
    set: (status: WorldStatus) => {
      if (live()) setStatus(status);
    },
    fail: (error: unknown) => {
      if (live()) fail(error);
    },
  };
};

export const openWorldPanel = (): void => {
  update({ open: true });
  void refreshRecent();
};

export const closeWorldPanel = (): void => {
  if (state.status.kind === 'scanning' || state.status.kind === 'listing') backToStart();
  update({ open: false });
};

export const backToStart = (): void => beginOpen().set({ kind: 'start' });

const fail = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return;
  const { code, detail } = asGameDataError(error);
  setStatus({ kind: 'error', code, detail });
};

/** What identifies a save's content: a newer save (or catalogue) reads again. */
const signatureOf = async (candidate: WorldCandidate, prefabs: number): Promise<string> => {
  if (candidate.kind === 'db') {
    const { file } = candidate;
    return `db|${file.name}|${file.size}|${file.lastModified}|${prefabs}`;
  }
  const files = await candidate.files();
  const generation = newestGeneration(files.map((f) => f.name));
  const size = files.reduce((n, f) => n + f.size, 0);
  return `folder|${candidate.name}|${generation}|${size}|${prefabs}`;
};

const requestFor = async (candidate: WorldCandidate, prefabs: string[]): Promise<WorldRequest> =>
  candidate.kind === 'db'
    ? { kind: 'db', file: candidate.file, prefabs }
    : {
        kind: 'folder',
        files: Object.fromEntries((await candidate.files()).map((f) => [f.name, f])),
        prefabs,
      };

/** Opens a found world: from the cache when this save was read before, else reads it. */
export const openCandidate = async (candidate: WorldCandidate): Promise<void> => {
  const open = beginOpen();
  const started = performance.now();
  try {
    open.set({ kind: 'scanning', name: candidate.name, done: 0, total: 0 });
    const prefabs = [...getLibrary().catalog.pieces.keys()];
    const key = await worldKey(await signatureOf(candidate, prefabs.length));
    const cached = await loadCachedWorld(key);
    if (!open.live()) return;
    if (cached) {
      const readMs = performance.now() - started;
      open.set({ kind: 'ready', world: { ...cached, key, fromCache: true, readMs } });
      // Rewritten, so it is listed (and first) even when an older index lost it.
      return void saveCachedWorld(key, candidate.name, cached).then(refreshRecent);
    }
    const request = await requestFor(candidate, prefabs);
    if (!open.live()) return;
    const scan = await scanWorld(request, (done, total) =>
      open.set({ kind: 'scanning', name: candidate.name, done, total })
    );
    if (!open.live()) return;
    const { chunks: _chunks, ...stored } = scan;
    const readMs = performance.now() - started;
    open.set({ kind: 'ready', world: { ...stored, key, fromCache: false, readMs } });
    if (await saveCachedWorld(key, candidate.name, stored)) void refreshRecent();
  } catch (error) {
    open.fail(error);
  }
};

const foundWorlds = async (find: () => Promise<WorldCandidate[]>): Promise<void> => {
  const open = beginOpen();
  open.set({ kind: 'listing' });
  try {
    const candidates = await find();
    if (!open.live()) return;
    if (candidates.length === 0) throw new GameDataError('notWorld');
    if (candidates.length === 1) return openCandidate(candidates[0]!);
    open.set({ kind: 'choosing', candidates });
  } catch (error) {
    open.fail(error);
  }
};

export const chooseWorldDrop = (drop: DroppedItem): Promise<void> =>
  foundWorlds(() => worldsFromDrop(drop));

export const chooseWorldFiles = (files: File[]): Promise<void> =>
  foundWorlds(() => worldsFromFiles(files));

/**
 * A drop on the planner itself (not on the panel): when it holds a world, the panel
 * opens with it; anything else is ignored.
 */
export const dropWorldOnPlanner = async (drop: DroppedItem): Promise<void> => {
  const candidates = await worldsFromDrop(drop).catch((): WorldCandidate[] => []);
  if (candidates.length === 0) return;
  openWorldPanel();
  await foundWorlds(() => Promise.resolve(candidates));
};

/** The native folder picker; nothing happens when it is cancelled. */
export const chooseWorldFolder = async (): Promise<void> => {
  try {
    const handle = await pickDirectory('valheimWorld');
    if (handle) await foundWorlds(() => worldsFromHandle(handle));
  } catch (error) {
    fail(error);
  }
};

export const openCachedWorld = async (entry: CachedWorld): Promise<void> => {
  const open = beginOpen();
  const started = performance.now();
  const stored = await loadCachedWorld(entry.key);
  if (!open.live()) return;
  if (!stored) {
    await forgetCachedWorld(entry.key);
    await refreshRecent();
    return open.set({ kind: 'error', code: 'moved', detail: 'The kept copy is gone.' });
  }
  const readMs = performance.now() - started;
  open.set({ kind: 'ready', world: { ...stored, key: entry.key, fromCache: true, readMs } });
  await touchCachedWorld(entry.key);
  await refreshRecent();
};

/** Deletes the kept copy (the save itself is never touched). */
export const forgetWorld = async (key: string): Promise<void> => {
  await forgetCachedWorld(key);
  if (state.status.kind === 'ready' && state.status.world.key === key) backToStart();
  await refreshRecent();
};
