/**
 * A posted `File` as a `ByteSource`, read synchronously with `FileReaderSync`
 * (worker-only), so the parsers stay plain synchronous code. For the workers only.
 */
import { checkRange, type ByteSource } from '../gameData/bytes/ByteSource';

// Not in TypeScript's DOM lib (it is worker-only).
declare const FileReaderSync: new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer };

export const fileSource = (file: File): ByteSource => {
  const reader = new FileReaderSync();
  return {
    size: file.size,
    read: (off, len) => {
      checkRange(file, off, len);
      return new Uint8Array(reader.readAsArrayBuffer(file.slice(off, off + len)));
    },
  };
};
