/**
 * The model extractor's worker: opens the piece bundle once (`openModelSource`), then
 * extracts models and textures on request, writes them to OPFS with sync access
 * handles and posts what the page asked for. Without OPFS, or once the quota is full,
 * it posts everything instead and the page keeps it in memory for the session. A file
 * that can't be written otherwise (another tab holding it) is just posted.
 */
import { ASSET_VERSION } from '../gameData/valheim/constants';
import { openModelSource, textureIdsOf, type ModelSource } from '../gameData/valheim/extractModels';
import { encodeModel, encodeTexture } from '../gameData/valheim/modelFormat';

import {
  INDEX_FILE,
  modelFile,
  openAssetDirs,
  textureFile,
  type AssetDirs,
  type AssetIndex,
} from './assetCache';
import type { AssetMessage, AssetRequest } from './assetClient';
import { asGameDataError } from './fileErrors';
import { fileSource } from './fileSource';

// Worker-only APIs missing from TypeScript's DOM lib.
interface SyncAccessHandle {
  truncate(size: number): void;
  write(buffer: ArrayBufferView, options: { at: number }): number;
  flush(): void;
  close(): void;
}
interface SyncFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
}

/** Prefabs per batch of "Extract all" (one sweep of the bundle each). */
const BATCH = 20;

let bundle: File | null = null;
let key = '';
let source: ModelSource | null = null;
/** Null in memory mode. */
let dirs: AssetDirs | null = null;
/** Textures already in OPFS, or (memory mode) already posted. */
const known = new Set<string>();

const post = (message: AssetMessage, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

const toMemory = (reason: string) => {
  if (!dirs) return;
  dirs = null;
  known.clear();
  post({ type: 'storage', persistent: false, reason });
};

const exists = async (dir: FileSystemDirectoryHandle, name: string): Promise<boolean> => {
  try {
    return (await (await dir.getFileHandle(name)).getFile()).size > 0;
  } catch {
    return false;
  }
};

const errorName = (error: unknown) => (error instanceof Error ? error.name : '');
const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** Writes one file with a sync access handle. */
const writeFile = async (dir: FileSystemDirectoryHandle, name: string, buffer: ArrayBuffer) => {
  let handle: SyncAccessHandle | null = null;
  try {
    const file = await dir.getFileHandle(name, { create: true });
    handle = await (file as unknown as SyncFileHandle).createSyncAccessHandle();
    handle.truncate(0);
    handle.write(new Uint8Array(buffer), { at: 0 });
    handle.flush();
  } finally {
    handle?.close();
  }
};

type DirName = keyof AssetDirs;

/** The folders again, after they were deleted (from another tab); memory mode without. */
const reopen = async (reason: string) => {
  const reopened = await openAssetDirs(key);
  if (!reopened) return toMemory(reason);
  dirs = reopened;
  known.clear();
};

/**
 * Writes a file into one of the install's folders. A full quota switches to memory
 * mode; a folder deleted meanwhile (the cache cleared from another tab) is created
 * again; other failures (another tab holding the file) skip this file. False when
 * nothing was written.
 */
const write = async (dirName: DirName, name: string, buffer: ArrayBuffer): Promise<boolean> => {
  for (let attempt = 0; dirs && attempt < 2; attempt++) {
    try {
      await writeFile(dirs[dirName], name, buffer);
      return true;
    } catch (error) {
      const kind = errorName(error);
      if (kind === 'QuotaExceededError') toMemory(describe(error));
      else if (kind === 'NotFoundError' && attempt === 0) await reopen(describe(error));
      else return false;
    }
  }
  return false;
};

const writeIndex = (complete: boolean) => {
  const index: AssetIndex = { key, assetVersion: ASSET_VERSION, space: 'unity', complete };
  return write('folder', INDEX_FILE, new TextEncoder().encode(JSON.stringify(index)).buffer);
};

const open = async (file: File, newKey: string) => {
  if (bundle === file && key === newKey) return;
  bundle = file;
  key = newKey;
  source = null;
  known.clear();
  dirs = await openAssetDirs(key);
  if (!dirs) post({ type: 'storage', persistent: false, reason: 'OPFS is unavailable' });
  else if (!(await exists(dirs.folder, INDEX_FILE))) await writeIndex(false);
};

const modelSource = (): ModelSource => {
  if (!bundle) throw new Error('No bundle opened');
  source ??= openModelSource(fileSource(bundle));
  return source;
};

/** Extracts, stores and (when asked, or in memory mode) posts textures. */
const storeTextures = async (ids: readonly string[], postAll: boolean) => {
  const wanted: string[] = [];
  for (const id of ids) {
    if (!postAll && known.has(id)) continue;
    if (!postAll && dirs && (await exists(dirs.textures, textureFile(id)))) known.add(id);
    else wanted.push(id);
  }
  for (const [id, texture] of modelSource().textures(wanted)) {
    const buf = texture ? encodeTexture(texture) : null;
    const stored = buf !== null && (await write('textures', textureFile(id), buf));
    known.add(id);
    if (postAll || !stored) post({ type: 'texture', id, buf }, buf ? [buf] : []);
  }
};

/** Extracts and stores models; posts them when asked (or in memory mode). */
const storeModels = async (names: readonly string[], postModels: boolean) => {
  const models = modelSource().models(names);
  for (const [name, model] of models) {
    const buf = encodeModel(model);
    const stored = await write('models', modelFile(name), buf);
    if (postModels || !stored) post({ type: 'model', name, buf }, [buf]);
  }
  const textureIds = [...models.values()].flatMap((m) => (m ? textureIdsOf(m) : []));
  await storeTextures([...new Set(textureIds)], false);
};

/**
 * Model and texture requests that came in while "Extract all" runs: served between its
 * batches, so the models a plan shows don't wait for every piece.
 */
const urgent: (() => Promise<void>)[] = [];
let extracting = false;

const serveUrgent = async () => {
  while (urgent.length > 0) await urgent.shift()!();
};

/**
 * Stores `only` (every piece without it), in batches, reporting progress. The index is
 * written before the last progress message, so the page reads "complete" right.
 */
const extractAll = async (only?: readonly string[]) => {
  await serveUrgent();
  const names = only ?? modelSource().prefabs();
  const missing: string[] = [];
  for (const name of names) {
    if (!dirs || !(await exists(dirs.models, modelFile(name)))) missing.push(name);
  }
  // Every piece: read the hierarchies in one pass rather than one per batch and level.
  if (!only && missing.length > BATCH) modelSource().preloadAll();
  let done = names.length - missing.length;
  if (done < names.length) post({ type: 'progress', done, total: names.length });
  for (let i = 0; i < missing.length; i += BATCH) {
    await serveUrgent();
    const batch = missing.slice(i, i + BATCH);
    await storeModels(batch, false);
    done += batch.length;
    if (done < names.length) post({ type: 'progress', done, total: names.length });
  }
  if (!only) await writeIndex(dirs !== null);
  post({ type: 'progress', done, total: names.length });
};

const handle = async (data: AssetRequest) => {
  try {
    switch (data.type) {
      case 'open':
        return await open(data.bundle, data.key);
      case 'models':
        return await storeModels(data.names, true);
      case 'textures':
        return await storeTextures(data.ids, true);
      case 'all':
        try {
          return await extractAll(data.names);
        } finally {
          extracting = false;
          await serveUrgent();
        }
    }
  } catch (error) {
    const { code, detail } = asGameDataError(error);
    post({ type: 'error', code, detail, request: data.type });
  }
};

/**
 * Requests run one at a time, in order; once "Extract all" is asked for (even while it
 * waits for the bundle to open), models and textures go first, between its batches.
 */
let queue = Promise.resolve();

self.onmessage = ({ data }: MessageEvent<AssetRequest>) => {
  if (data.type === 'all') extracting = true;
  if (extracting && (data.type === 'models' || data.type === 'textures')) {
    urgent.push(() => handle(data));
  } else {
    queue = queue.then(() => handle(data));
  }
};
