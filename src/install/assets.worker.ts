/**
 * The model extractor's worker: opens the piece bundle once (`openModelSource`), then
 * extracts models and textures on request, writes them to OPFS with sync access
 * handles and posts what the page asked for. Without OPFS, or once a write fails
 * (quota, another tab holding the file), it posts everything instead and the page keeps
 * it in memory for the session.
 */
import { checkRange, type ByteSource } from '../gameData/bytes/ByteSource';
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

// Worker-only APIs missing from TypeScript's DOM lib.
declare const FileReaderSync: new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer };
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

const fileSource = (file: File): ByteSource => {
  const reader = new FileReaderSync();
  return {
    size: file.size,
    read: (off, len) => {
      checkRange(file, off, len);
      return new Uint8Array(reader.readAsArrayBuffer(file.slice(off, off + len)));
    },
  };
};

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

/** Writes a file; a failure switches to memory mode. False when nothing was written. */
const write = async (
  dir: FileSystemDirectoryHandle | undefined,
  name: string,
  buffer: ArrayBuffer
): Promise<boolean> => {
  if (!dir) return false;
  let handle: SyncAccessHandle | null = null;
  try {
    const file = await dir.getFileHandle(name, { create: true });
    handle = await (file as unknown as SyncFileHandle).createSyncAccessHandle();
    handle.truncate(0);
    handle.write(new Uint8Array(buffer), { at: 0 });
    handle.flush();
    return true;
  } catch (error) {
    toMemory(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return false;
  } finally {
    handle?.close();
  }
};

const writeIndex = (complete: boolean) => {
  const index: AssetIndex = { key, assetVersion: ASSET_VERSION, space: 'unity', complete };
  return write(dirs?.folder, INDEX_FILE, new TextEncoder().encode(JSON.stringify(index)).buffer);
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
    const stored = buf !== null && (await write(dirs?.textures, textureFile(id), buf));
    known.add(id);
    if (postAll || !stored) post({ type: 'texture', id, buf }, buf ? [buf] : []);
  }
};

/** Extracts and stores models; posts them when asked (or in memory mode). */
const storeModels = async (names: readonly string[], postModels: boolean) => {
  const models = modelSource().models(names);
  for (const [name, model] of models) {
    const buf = encodeModel(model);
    const stored = await write(dirs?.models, modelFile(name), buf);
    if (postModels || !stored) post({ type: 'model', name, buf }, [buf]);
  }
  const textureIds = [...models.values()].flatMap((m) => (m ? textureIdsOf(m) : []));
  await storeTextures([...new Set(textureIds)], false);
};

const extractAll = async () => {
  const names = modelSource().prefabs();
  const missing: string[] = [];
  for (const name of names) {
    if (!dirs || !(await exists(dirs.models, modelFile(name)))) missing.push(name);
  }
  let done = names.length - missing.length;
  post({ type: 'progress', done, total: names.length });
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    await storeModels(batch, false);
    done += batch.length;
    post({ type: 'progress', done, total: names.length });
  }
  await writeIndex(dirs !== null);
};

/** Requests run one at a time, in order. */
let queue = Promise.resolve();

self.onmessage = ({ data }: MessageEvent<AssetRequest>) => {
  queue = queue.then(async () => {
    try {
      switch (data.type) {
        case 'open':
          return await open(data.bundle, data.key);
        case 'models':
          return await storeModels(data.names, true);
        case 'textures':
          return await storeTextures(data.ids, true);
        case 'all':
          return await extractAll();
      }
    } catch (error) {
      const { code, detail } = asGameDataError(error);
      post({ type: 'error', code, detail, request: data.type });
    }
  });
};
