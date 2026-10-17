/**
 * The install gate's state machine, one per page (StrictMode-safe):
 *
 *   starting → idle | needsPermission → locating → parsing → ready | error
 *
 * A fresh catalogue is parsed in a worker, validated by building the library, cached,
 * then installed with `setLibrary`. A cached catalogue whose fingerprint still matches
 * the folder skips the parse; one can also be used without folder access at all.
 * Once the editor runs, a re-scan or a new folder writes the cache and reloads the
 * page, so the library never changes under a running editor.
 *
 * The located files are kept for model extraction (`assetClient.ts`). Files read
 * through the upload dialog or an entry-only drop don't survive a reload, so after
 * such a scan every model is extracted into the cache in the background.
 */
import { buildLibrary } from '../catalog/buildLibrary';
import type { Library } from '../catalog/library';
import { GameDataError, type GameDataErrorCode } from '../gameData/GameDataError';
import type { ExtractPhase } from '../gameData/valheim/extractCatalogue';
import { getLocalStorage } from '../store/browserStorage';
import { hasLibrary, setLibrary } from '../store/libraryInstance';

import { extractAll } from './assetClient';
import { fileListDir, handleDir, pickDirectory, readPermission, type DirLike } from './directory';
import { resolveDrop, type DroppedItem } from './dropFolder';
import { asGameDataError } from './fileErrors';
import { buildGuidOf, fingerprint } from './fingerprint';
import {
  getCache,
  getHandle,
  putCache,
  putHandle,
  type CachedCatalogue,
  type InstallInfo,
} from './installStore';
import { locateDataDir, type InstallFiles } from './locateInstall';
import { cancelParse, parseInstall } from './parserClient';

export type InstallStatus =
  | { kind: 'starting' }
  | { kind: 'idle' }
  | { kind: 'needsPermission'; folderName: string }
  | { kind: 'locating' }
  | { kind: 'parsing'; phase: ExtractPhase; objects: number }
  | { kind: 'ready' }
  | { kind: 'error'; code: GameDataErrorCode; detail: string };

export interface InstallState {
  status: InstallStatus;
  /** The catalogue cached by an earlier scan (usable without folder access). */
  cached: InstallInfo | null;
  /** The catalogue the editor runs on, once one is installed. */
  loaded: InstallInfo | null;
  /** A stored folder handle exists (re-scan can use it). */
  hasHandle: boolean;
  /** The folder picker closed without a folder: maybe Chrome's "system files" refusal. */
  pickerHint: boolean;
}

let state: InstallState = {
  status: { kind: 'starting' },
  cached: null,
  loaded: null,
  hasHandle: false,
  pickerHint: false,
};
const listeners = new Set<() => void>();
let cache: CachedCatalogue | null = null;
let handle: FileSystemDirectoryHandle | null = null;
/** The key of the catalogue in use, and its install's files when they are at hand. */
let loadedKey: string | null = null;
let installFiles: InstallFiles | null = null;

const update = (changes: Partial<InstallState>) => {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
};
const setStatus = (status: InstallStatus) => update({ status });
/** Nothing in progress: the editor if it runs, else the folder choice. */
const settle = () => setStatus(hasLibrary() ? { kind: 'ready' } : { kind: 'idle' });

export const subscribeInstall = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getInstallState = (): InstallState => state;

/** Builds the library, reporting a catalogue the planner can't use as `missingPieces`. */
const libraryFrom = (catalogue: CachedCatalogue): Library => {
  try {
    return buildLibrary(catalogue.pieces, catalogue.items);
  } catch (error) {
    throw new GameDataError('missingPieces', error instanceof Error ? error.message : '');
  }
};

/** Set before a reload so the next page load opens the catalogue it was reloaded for. */
const OPEN_ON_RELOAD_KEY = 'valheimInstall.openOnReload';

const sessionStore = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Puts `catalogue` in use: in the gate directly, in a running editor via a reload.
 * `files` are its install's files (null when opened from the cache alone).
 */
const install = (catalogue: CachedCatalogue, library: Library, files: InstallFiles | null) => {
  if (hasLibrary()) {
    try {
      sessionStore()?.setItem(OPEN_ON_RELOAD_KEY, catalogue.key);
    } catch {
      // Without it the gate offers the cached catalogue instead.
    }
    location.reload();
    return;
  }
  setLibrary(library);
  loadedKey = catalogue.key;
  installFiles = files;
  update({ status: { kind: 'ready' }, loaded: catalogue.info });
};

/** Takes the catalogue key a reload was asked to open, if any. */
const takeOpenOnReload = (): string | null => {
  try {
    const store = sessionStore();
    const key = store?.getItem(OPEN_ON_RELOAD_KEY) ?? null;
    store?.removeItem(OPEN_ON_RELOAD_KEY);
    return key;
  } catch {
    return null;
  }
};

const fail = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    settle();
    return;
  }
  const { code, detail } = asGameDataError(error);
  setStatus({ kind: 'error', code, detail });
};

/** Counts scans, so a superseded one (cancelled by a newer pick) stays quiet. */
let scans = 0;

/**
 * Locates the data folder, then uses the cache if it still matches, else parses.
 * `remember` is what to store as the folder once the scan succeeds: the picked
 * handle, null to forget the stored one (files from the upload dialog), or undefined
 * to keep it. A failed scan leaves the stored folder alone.
 */
const scan = async (
  dir: DirLike,
  force: boolean,
  remember?: FileSystemDirectoryHandle | null
): Promise<void> => {
  const id = ++scans;
  const current = () => id === scans;
  setStatus({ kind: 'locating' });
  try {
    const files = await locateDataDir(dir);
    const key = await fingerprint(files);
    let catalogue = !force && cache?.key === key ? cache : null;
    if (!catalogue) {
      setStatus({ kind: 'parsing', phase: 'bundle', objects: 0 });
      const result = await parseInstall(files, ({ phase, objects }) => {
        if (current()) setStatus({ kind: 'parsing', phase, objects });
      });
      catalogue = {
        key,
        pieces: result.pieces,
        items: result.items,
        info: {
          folderName: files.folderName,
          unityVersion: result.unityVersion,
          buildGuid: buildGuidOf(await files.bootConfig.text()),
          pieceCount: result.pieces.pieces.length,
          scannedAt: Date.now(),
        },
      };
    }
    const library = libraryFrom(catalogue);
    if (!current()) return;
    if (catalogue !== cache) {
      await putCache(catalogue);
      cache = catalogue;
      update({ cached: catalogue.info });
    }
    if (remember !== undefined) {
      handle = remember;
      await putHandle(remember);
      update({ hasHandle: remember !== null });
    }
    const transient = remember === null && !hasLibrary();
    install(catalogue, library, files);
    if (transient) extractAll().catch(() => {});
  } catch (error) {
    if (current()) fail(error);
  }
};

/**
 * Reads the cache and the stored folder. Opens the catalogue a re-scan or folder
 * change reloaded for; otherwise reconnects without a prompt when allowed.
 */
export const startInstall = async (): Promise<void> => {
  if (state.status.kind !== 'starting') return;
  [cache, handle] = await Promise.all([getCache(), getHandle()]);
  update({ cached: cache?.info ?? null, hasHandle: handle !== null });
  if (cache && takeOpenOnReload() === cache.key) return openCachedCatalogue();
  if (!handle) return setStatus({ kind: 'idle' });
  try {
    const permission = await readPermission(handle, false);
    if (permission === 'granted') return scan(handleDir(handle), false);
    setStatus(
      permission === 'prompt'
        ? { kind: 'needsPermission', folderName: handle.name }
        : { kind: 'idle' }
    );
  } catch (error) {
    fail(error);
  }
};

/** Asks again for the stored folder (needs a user gesture). */
export const reconnect = async (force = false): Promise<void> => {
  if (!handle) return settle();
  try {
    if ((await readPermission(handle, true)) !== 'granted') {
      throw new GameDataError('permission', 'Access to the folder was not granted.');
    }
    await scan(handleDir(handle), force);
  } catch (error) {
    fail(error);
  }
};

const PICKER_HINT_DISMISSED_KEY = 'valheimInstall.pickerHintDismissed';

/**
 * Opens the native folder picker (Chromium), scans what was picked, then remembers it.
 * Chrome's refusal of a blocklisted folder looks like a cancel (AbortError), so either
 * one shows a hint about dragging the folder in, until it is dismissed.
 */
export const chooseFolder = async (): Promise<void> => {
  try {
    const picked = await pickDirectory();
    if (picked) await scan(handleDir(picked), hasLibrary(), picked);
    else if ((getLocalStorage()?.getItem(PICKER_HINT_DISMISSED_KEY) ?? null) === null) {
      update({ pickerHint: true });
    }
  } catch (error) {
    fail(error);
  }
};

/** Hides the picker hint for good. */
export const dismissPickerHint = (): void => {
  try {
    getLocalStorage()?.setItem(PICKER_HINT_DISMISSED_KEY, '1');
  } catch {
    // Shown again next time; harmless.
  }
  update({ pickerHint: false });
};

/** Scans the files of a folder input (every browser); on success forgets any stored handle. */
export const chooseFiles = (files: readonly File[]): Promise<void> =>
  scan(fileListDir(files), hasLibrary(), null);

/**
 * Scans a dropped folder. A readable handle is remembered like a picked folder; an
 * entry-only drop (other browsers, or a folder Chromium refuses) forgets the stored one.
 */
export const chooseDrop = async (drop: DroppedItem): Promise<void> => {
  setStatus({ kind: 'locating' });
  try {
    const { dir, handle: dropped } = await resolveDrop(drop);
    await scan(dir, hasLibrary(), dropped);
  } catch (error) {
    fail(error);
  }
};

/** Uses the cached catalogue without checking the folder. */
export const openCachedCatalogue = (): void => {
  if (!cache) return;
  try {
    install(cache, libraryFrom(cache), null);
  } catch (error) {
    fail(error);
  }
};

/** Parses the stored folder again (from the editor); asks for access when needed. */
export const rescan = (): Promise<void> => reconnect(true);

export const cancelScan = (): void => cancelParse();

/** Back to the folder choice, or to the editor, after an error. */
export const dismissError = (): void => settle();

/** The key of the catalogue in use (it names the model cache), or null before one. */
export const getCatalogueKey = (): string | null => loadedKey;

/** The files of the install in use, or null when it was opened from the cache alone. */
export const getInstallFiles = (): InstallFiles | null => installFiles;

/**
 * Gets the files of the install in use back from the stored folder, without
 * reloading, so missing models can be extracted (needs a user gesture to ask for
 * access). False when there is no folder or it now holds another game build.
 */
export const connectAssetFiles = async (): Promise<boolean> => {
  if (installFiles) return true;
  if (!handle || !loadedKey) return false;
  if ((await readPermission(handle, true)) !== 'granted') return false;
  const files = await locateDataDir(handleDir(handle));
  if ((await fingerprint(files)) !== loadedKey) return false;
  installFiles = files;
  return true;
};
