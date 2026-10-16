import { describe, expect, it } from 'vitest';

import { captureDrop, entryDir, resolveDrop } from './dropFolder';

type Tree = { [name: string]: Tree | string };

const notFound = () =>
  new DOMException('A requested file or directory could not be found', 'NotFoundError');

/** A fake FileSystemDirectoryEntry: lookups only (no createReader, so listing would throw). */
const dirEntry = (name: string, tree: Tree): FileSystemDirectoryEntry => {
  const lookup =
    (folder: boolean) =>
    (
      path: string,
      _options: unknown,
      ok: (e: FileSystemEntry) => void,
      fail: (e: unknown) => void
    ) => {
      const node = tree[path];
      if (node === undefined || (typeof node === 'string') === folder) return fail(notFound());
      ok(typeof node === 'string' ? fileEntry(path, node) : dirEntry(path, node));
    };
  return {
    name,
    isDirectory: true,
    isFile: false,
    getDirectory: lookup(true),
    getFile: lookup(false),
  } as unknown as FileSystemDirectoryEntry;
};

const fileEntry = (name: string, text: string): FileSystemEntry =>
  ({
    name,
    isDirectory: false,
    isFile: true,
    file: (ok: (f: File) => void) => ok(new File([text], name)),
  }) as unknown as FileSystemEntry;

const app = dirEntry('Valheim.app', {
  Contents: { Resources: { Data: { 'boot.config': 'build-guid=abc' } } },
});

describe('dropped folders', () => {
  it('reads files by path without listing the folder', async () => {
    const dir = entryDir(app);
    expect(dir.name).toBe('Valheim.app');
    expect(await (await dir.file('Contents/Resources/Data/boot.config'))?.text()).toBe(
      'build-guid=abc'
    );
    expect(await dir.file('Contents/Resources/Data/resources.assets')).toBeNull();
    expect(await dir.file('valheim_Data/boot.config')).toBeNull();
  });

  it('captures the folder item synchronously, preferring a folder', () => {
    const calls: string[] = [];
    const item = (entry: FileSystemEntry, handle: Promise<FileSystemHandle | null>) => ({
      kind: 'file',
      webkitGetAsEntry: () => (calls.push(`entry ${entry.name}`), entry),
      getAsFileSystemHandle: () => (calls.push(`handle ${entry.name}`), handle),
    });
    const drop = captureDrop(
      {
        items: [
          { kind: 'string' },
          item(fileEntry('notes.txt', ''), Promise.resolve(null)),
          item(app, Promise.reject(new DOMException('blocked', 'NotAllowedError'))),
        ],
      } as unknown as DataTransfer,
      true
    );
    expect(calls).toEqual([
      'handle notes.txt',
      'entry notes.txt',
      'handle Valheim.app',
      'entry Valheim.app',
    ]);
    expect(drop?.entry).toBe(app);
  });

  it('falls back to the entry when the handle is refused, and rejects a file', async () => {
    const refused = Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    const { dir, handle } = await resolveDrop({ handle: refused, entry: app });
    expect(handle).toBeNull();
    expect(dir.name).toBe('Valheim.app');
    await expect(resolveDrop({ handle: null, entry: fileEntry('a.txt', '') })).rejects.toThrow(
      /notInstall/
    );
  });
});
