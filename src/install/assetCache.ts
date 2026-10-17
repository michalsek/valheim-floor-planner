/**
 * Extracted models and textures in the Origin Private File System, per install:
 *
 *     /valheimAssets/<sha256(catalogue key | ASSET_VERSION)[:16]>/
 *       index.json, models/<prefab>.bin, textures/<pathId>.bin
 *
 * The catalogue key changes with every game build, so an update opens a new folder;
 * folders of other keys are deleted on open. The worker writes (sync access handles);
 * the page reads with `getFile()`. Without OPFS (Safari private mode) there is no cache.
 */
import type { TextureData } from '../gameData/unity/texture2d';
import { ASSET_VERSION } from '../gameData/valheim/constants';
import type { PrefabModel } from '../gameData/valheim/extractModels';
import { decodeModel, decodeTexture } from '../gameData/valheim/modelFormat';

import { shortHash } from './shortHash';

const ROOT = 'valheimAssets';
const MODELS = 'models';
const TEXTURES = 'textures';
export const INDEX_FILE = 'index.json';

export interface AssetIndex {
  key: string;
  assetVersion: number;
  /** Raw Unity coordinates, as in the catalogue (see M14's handedness note). */
  space: 'unity';
  /** Every piece's model and textures are cached ("Extract all" finished). */
  complete: boolean;
}

export interface AssetDirs {
  folder: FileSystemDirectoryHandle;
  models: FileSystemDirectoryHandle;
  textures: FileSystemDirectoryHandle;
}

export interface AssetCache {
  /** The cached model; null when the prefab draws nothing; undefined when not cached. */
  model(name: string): Promise<PrefabModel | null | undefined>;
  /** The cached texture, or null when not cached. */
  texture(id: string): Promise<TextureData | null>;
  has(name: string): Promise<boolean>;
  index(): Promise<AssetIndex | null>;
  /** Bytes stored for this install. */
  usage(): Promise<number>;
  clear(): Promise<void>;
}

/** File names for prefabs and texture IDs (prefab names are plain, but be safe). */
export const modelFile = (name: string): string => `${encodeURIComponent(name)}.bin`;
export const textureFile = (id: string): string => `${encodeURIComponent(id)}.bin`;

const folderName = (key: string): Promise<string> => shortHash(`${key}|${ASSET_VERSION}`);

/** This install's folders, creating them; null without OPFS. */
export const openAssetDirs = async (key: string): Promise<AssetDirs | null> => {
  try {
    const root = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle(ROOT, {
      create: true,
    });
    const folder = await root.getDirectoryHandle(await folderName(key), { create: true });
    return {
      folder,
      models: await folder.getDirectoryHandle(MODELS, { create: true }),
      textures: await folder.getDirectoryHandle(TEXTURES, { create: true }),
    };
  } catch {
    return null;
  }
};

/** Deletes the folders of other installs or game builds. */
const deleteOtherFolders = async (key: string): Promise<void> => {
  const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(ROOT);
  const keep = await folderName(key);
  const others: string[] = [];
  for await (const [name] of root.entries()) if (name !== keep) others.push(name);
  await Promise.all(
    others.map((name) => root.removeEntry(name, { recursive: true }).catch(() => {}))
  );
};

const readFile = async (
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<ArrayBuffer | null> => {
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    return file.size > 0 ? await file.arrayBuffer() : null;
  } catch {
    return null;
  }
};

const dirSize = async (dir: FileSystemDirectoryHandle): Promise<number> => {
  let total = 0;
  for await (const [, handle] of dir.entries()) {
    total += handle.kind === 'file' ? (await handle.getFile()).size : await dirSize(handle);
  }
  return total;
};

/** The cache of the install with catalogue key `key`, or null without OPFS. */
export const openAssetCache = async (key: string): Promise<AssetCache | null> => {
  let dirs = await openAssetDirs(key);
  if (!dirs) return null;
  await deleteOtherFolders(key).catch(() => {});

  /** Decodes a cached file; a corrupt or outdated one counts as missing. */
  const decoded = async <T>(
    dir: FileSystemDirectoryHandle,
    name: string,
    decode: (buffer: ArrayBuffer) => T
  ): Promise<T | undefined> => {
    const buffer = await readFile(dir, name);
    if (!buffer) return undefined;
    try {
      return decode(buffer);
    } catch {
      return undefined;
    }
  };

  return {
    model: async (name) => decoded(dirs!.models, modelFile(name), decodeModel),
    texture: async (id) => (await decoded(dirs!.textures, textureFile(id), decodeTexture)) ?? null,
    has: async (name) => {
      try {
        return (await (await dirs!.models.getFileHandle(modelFile(name))).getFile()).size > 0;
      } catch {
        return false;
      }
    },
    index: async () => {
      const buffer = await readFile(dirs!.folder, INDEX_FILE);
      try {
        return buffer ? (JSON.parse(new TextDecoder().decode(buffer)) as AssetIndex) : null;
      } catch {
        return null;
      }
    },
    usage: () => dirSize(dirs!.folder).catch(() => 0),
    clear: async () => {
      for (const name of [MODELS, TEXTURES, INDEX_FILE]) {
        await dirs!.folder.removeEntry(name, { recursive: true }).catch(() => {});
      }
      dirs = (await openAssetDirs(key)) ?? dirs;
    },
  };
};
