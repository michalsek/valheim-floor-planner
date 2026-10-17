/**
 * Finding world saves in what the user picked or dropped: a world folder itself
 * (`_main.N.*` and its `.chunk` files), a `worlds` / `worlds_local` folder of them, or
 * a legacy `.db`. Folders are listed, never read: a world's files are only opened once
 * it is chosen. Read-only throughout.
 */
import { isWorldListing } from '../gameData/valheim/world/worldFiles';

import type { DroppedItem } from './dropFolder';

/** A folder's listing, however it was picked. */
interface Listing {
  name: string;
  files(): Promise<File[]>;
  folders(): Promise<Listing[]>;
}

export type WorldCandidate =
  | { kind: 'folder'; name: string; files(): Promise<File[]> }
  | { kind: 'db'; name: string; file: File };

const LEGACY_DB = /\.db$/i;

/** Every entry of a dropped folder (`readEntries` returns them in batches). */
const readEntries = async (dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
};

const entryFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

const entryListing = (dir: FileSystemDirectoryEntry): Listing => ({
  name: dir.name,
  files: async () =>
    Promise.all(
      (await readEntries(dir))
        .filter((e) => e.isFile)
        .map((e) => entryFile(e as FileSystemFileEntry))
    ),
  folders: async () =>
    (await readEntries(dir))
      .filter((e) => e.isDirectory)
      .map((e) => entryListing(e as FileSystemDirectoryEntry)),
});

const handleChildren = async (dir: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> => {
  const children: FileSystemHandle[] = [];
  for await (const child of dir.values()) children.push(child);
  return children;
};

export const handleListing = (dir: FileSystemDirectoryHandle): Listing => ({
  name: dir.name,
  files: async () =>
    Promise.all(
      (await handleChildren(dir))
        .filter((h) => h.kind === 'file')
        .map((h) => (h as FileSystemFileHandle).getFile())
    ),
  folders: async () =>
    (await handleChildren(dir))
      .filter((h) => h.kind === 'directory')
      .map((h) => handleListing(h as FileSystemDirectoryHandle)),
});

/** Files from an `<input webkitdirectory>`, by their relative paths. */
const fileListListing = (files: readonly File[], depth = 0, name = ''): Listing => {
  const parts = (file: File) => file.webkitRelativePath.split('/');
  const top = files[0] ? (parts(files[0])[depth] ?? '') : '';
  return {
    name: name || top,
    files: () => Promise.resolve(files.filter((f) => parts(f).length === depth + 2)),
    folders: () => {
      const byFolder = new Map<string, File[]>();
      for (const file of files) {
        const p = parts(file);
        if (p.length <= depth + 2) continue;
        const folder = p[depth + 1]!;
        byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
      }
      return Promise.resolve(
        [...byFolder].map(([folder, inside]) => fileListListing(inside, depth + 1, folder))
      );
    },
  };
};

const folderWorld = (listing: Listing): WorldCandidate => ({
  kind: 'folder',
  name: listing.name,
  files: listing.files,
});

/** The world `listing` is, or the worlds (and legacy `.db`s) in it. */
const worldsIn = async (listing: Listing): Promise<WorldCandidate[]> => {
  const files = await listing.files();
  if (isWorldListing(files.map((f) => f.name))) return [folderWorld(listing)];
  const dbs = files
    .filter((f) => LEGACY_DB.test(f.name))
    .map((file): WorldCandidate => ({ kind: 'db', name: file.name.replace(LEGACY_DB, ''), file }));
  const folders: WorldCandidate[] = [];
  for (const folder of await listing.folders()) {
    const names = (await folder.files()).map((f) => f.name);
    if (isWorldListing(names)) folders.push(folderWorld(folder));
  }
  return [...folders, ...dbs].sort((a, b) => a.name.localeCompare(b.name));
};

export const worldsFromHandle = (handle: FileSystemDirectoryHandle): Promise<WorldCandidate[]> =>
  worldsIn(handleListing(handle));

export const worldsFromFiles = (files: readonly File[]): Promise<WorldCandidate[]> =>
  worldsIn(fileListListing(files));

/** A drop: a folder (a world or a folder of worlds), or a legacy `.db` file. */
export const worldsFromDrop = async (drop: DroppedItem): Promise<WorldCandidate[]> => {
  const entry = drop.entry;
  if (entry?.isDirectory) return worldsIn(entryListing(entry as FileSystemDirectoryEntry));
  if (entry?.isFile && LEGACY_DB.test(entry.name)) {
    const file = await entryFile(entry as FileSystemFileEntry);
    return [{ kind: 'db', name: file.name.replace(LEGACY_DB, ''), file }];
  }
  return [];
};
