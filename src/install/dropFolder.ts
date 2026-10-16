/**
 * A folder dropped on the page (from Finder, Explorer or a file manager). macOS hides
 * `~/Library` in the folder dialog and treats `Valheim.app` as a file, but both drag
 * in fine. Two ways to read a drop, tried in order:
 * - a File System Access handle (Chromium), which can be stored for later visits;
 * - a `FileSystemDirectoryEntry` (every browser), read for this visit only.
 */
import { GameDataError } from '../gameData/GameDataError';

import { handleDir, type DirLike } from './directory';

/** What a drop carried. Captured synchronously: the items are gone after the event. */
export interface DroppedItem {
  /** Chromium's handle for the item, still resolving. */
  handle: Promise<FileSystemHandle | null> | null;
  entry: FileSystemEntry | null;
}

/** `getAsFileSystemHandle` isn't in TypeScript's DOM lib. */
interface HandleItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

/**
 * Reads the drop's items; call it inside the drop event, before any `await`. Prefers
 * a folder when several items are dropped. Null when nothing file-like was dropped.
 */
export const captureDrop = (data: DataTransfer): DroppedItem | null => {
  const items = Array.from(data.items).filter((item) => item.kind === 'file');
  const captured = items.map((item) => ({
    handle: (item as HandleItem).getAsFileSystemHandle?.call(item) ?? null,
    entry: item.webkitGetAsEntry(),
  }));
  // Unused handle promises may reject (e.g. a blocked folder); that's handled later.
  captured.forEach((c) => c.handle?.catch(() => null));
  return captured.find((c) => c.entry?.isDirectory) ?? captured[0] ?? null;
};

const MISSING = new Set(['NotFoundError', 'TypeMismatchError', 'NotFoundErr']);

const isMissing = (error: unknown) =>
  error instanceof Error && (MISSING.has(error.name) || /not ?found/i.test(error.message));

/** One child of `dir` (a folder or a file), or null when there is none. */
const child = (
  dir: FileSystemDirectoryEntry,
  name: string,
  folder: boolean
): Promise<FileSystemEntry | null> =>
  new Promise((resolve, reject) => {
    const onError = (error: unknown) => (isMissing(error) ? resolve(null) : reject(error));
    if (folder) dir.getDirectory(name, {}, resolve, onError);
    else dir.getFile(name, {}, resolve, onError);
  });

/**
 * A dropped folder entry as a `DirLike`. Each file is looked up by its path, one
 * folder at a time; the folder is never listed (the install is ~1,000 files, 4 GB).
 */
export const entryDir = (root: FileSystemDirectoryEntry): DirLike => ({
  name: root.name,
  file: async (path) => {
    const parts = path.split('/');
    const fileName = parts.pop()!;
    let dir: FileSystemDirectoryEntry = root;
    for (const part of parts) {
      const next = await child(dir, part, true);
      if (!next?.isDirectory) return null;
      dir = next as FileSystemDirectoryEntry;
    }
    const entry = await child(dir, fileName, false);
    if (!entry?.isFile) return null;
    return new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject)
    );
  },
});

/** Async iteration over a directory handle (not in TypeScript's DOM lib). */
interface IterableDirectory {
  values(): AsyncIterator<unknown>;
}

/**
 * How long to wait for Chromium's handle. It can stay pending forever (seen with
 * DevTools-synthesized drops); the entry reads the folder just as well.
 */
const HANDLE_TIMEOUT_MS = 2000;

/** The drop's folder handle if Chromium gave one it can read, else null. */
const readableHandle = async (
  pending: DroppedItem['handle']
): Promise<FileSystemDirectoryHandle | null> => {
  if (!pending) return null;
  try {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), HANDLE_TIMEOUT_MS)
    );
    const handle = await Promise.race([pending, timeout]);
    if (handle?.kind !== 'directory') return null;
    const dir = handle as FileSystemDirectoryHandle;
    await (dir as unknown as IterableDirectory).values().next();
    return dir;
  } catch {
    // Refused (blocklisted folder, no permission): the entry may still read it.
    return null;
  }
};

/**
 * How to read a drop: its handle (stored for later visits) when Chromium allows it,
 * else its directory entry (this visit only). A dropped file isn't an install.
 */
export const resolveDrop = async (
  drop: DroppedItem
): Promise<{ dir: DirLike; handle: FileSystemDirectoryHandle | null }> => {
  const handle = await readableHandle(drop.handle);
  if (handle) return { dir: handleDir(handle), handle };
  if (drop.entry?.isDirectory) {
    return { dir: entryDir(drop.entry as FileSystemDirectoryEntry), handle: null };
  }
  throw new GameDataError('notInstall', `“${drop.entry?.name ?? 'That'}” is a file, not a folder.`);
};
