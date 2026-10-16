/**
 * TextAssets in files without type trees (player builds' `resources.assets`): read by
 * hand as `m_Name` then `m_Script`, each an int32 length, the bytes, and padding to 4.
 */
import { ByteReader } from '../bytes/ByteReader';

import type { SerializedFile } from './serializedFile';

const TEXT_ASSET = 49;

/** The contents of the TextAsset called `name`, or null when the file has none. */
export const findTextAsset = (file: SerializedFile, name: string): Uint8Array | null => {
  const nameLength = new TextEncoder().encode(name).length;
  for (const id of file.idsOfClass(TEXT_ASSET)) {
    // Only the name's bytes, to skip the others' (often large) text cheaply.
    const head = new ByteReader(file.readBytes(id, 4 + nameLength), file.little);
    if (head.remaining < 4 || head.i32() !== nameLength || head.str(nameLength) !== name) continue;

    const r = new ByteReader(file.readBytes(id), file.little);
    r.bytesView(r.count(1));
    r.align(4);
    return r.bytesView(r.count(1));
  }
  return null;
};
