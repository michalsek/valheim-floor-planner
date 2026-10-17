/**
 * The picked folder, however it was picked: a File System Access handle (Chrome,
 * Edge) or the files of an `<input webkitdirectory>` (every browser). Either way the
 * rest of the code asks it for files by relative path.
 */

export interface DirLike {
  /** The picked folder's name. */
  name: string;
  /** The file at a '/'-separated path below the folder, or null when there is none. */
  file(path: string): Promise<File | null>;
}

const MISSING = new Set(['NotFoundError', 'TypeMismatchError']);

/**
 * A missing entry is null, but only while the picked folder itself exists: listing a
 * moved or deleted folder throws `NotFoundError`, which is let through.
 */
export const handleDir = (handle: FileSystemDirectoryHandle): DirLike => ({
  name: handle.name,
  file: async (path) => {
    const parts = path.split('/');
    const fileName = parts.pop()!;
    try {
      let dir = handle;
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      return await (await dir.getFileHandle(fileName)).getFile();
    } catch (error) {
      if (!(error instanceof DOMException && MISSING.has(error.name))) throw error;
      await handle.values().next();
      return null;
    }
  },
});

/** Files from a folder input: paths are `webkitRelativePath` minus the folder's name. */
export const fileListDir = (files: readonly File[]): DirLike => {
  const byPath = new Map<string, File>();
  let name = '';
  for (const file of files) {
    const [top = '', ...rest] = file.webkitRelativePath.split('/');
    name ||= top;
    byPath.set(rest.join('/'), file);
  }
  return { name, file: (path) => Promise.resolve(byPath.get(path) ?? null) };
};

interface PickerWindow {
  showDirectoryPicker?(options: { id: string; mode: 'read' }): Promise<FileSystemDirectoryHandle>;
}

interface PermissionHandle {
  queryPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
}

/** True where `showDirectoryPicker` exists (Chromium). */
export const canPickDirectory = (): boolean =>
  typeof (window as PickerWindow).showDirectoryPicker === 'function';

/**
 * Opens the native folder picker (remembering its last folder per `id`); null when the
 * user cancels.
 */
export const pickDirectory = async (id = 'valheim'): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await (window as PickerWindow).showDirectoryPicker!({ id, mode: 'read' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
};

/** Read permission on a stored handle; `request` asks (needs a user gesture). */
export const readPermission = async (
  handle: FileSystemDirectoryHandle,
  request: boolean
): Promise<PermissionState> => {
  const h = handle as PermissionHandle;
  const ask = request ? h.requestPermission : h.queryPermission;
  return ask ? ask.call(handle, { mode: 'read' }) : 'granted';
};
