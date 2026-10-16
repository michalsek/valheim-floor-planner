/**
 * The parser's worker: reads the posted `File`s synchronously with `FileReaderSync`
 * (worker-only), so the parser stays plain synchronous code.
 */
import { checkRange, type ByteSource } from '../gameData/bytes/ByteSource';
import { extractCatalogue } from '../gameData/valheim/extractCatalogue';

import { asGameDataError } from './fileErrors';
import type { ParseMessage, ParseRequest } from './parserClient';

// Not in TypeScript's DOM lib (it is worker-only).
declare const FileReaderSync: new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer };

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

const post = (message: ParseMessage) => self.postMessage(message);

self.onmessage = ({ data }: MessageEvent<ParseRequest>) => {
  try {
    const result = extractCatalogue(
      { bundle: fileSource(data.bundle), resources: fileSource(data.resources) },
      (progress) => post({ type: 'progress', ...progress })
    );
    post({ type: 'done', result });
  } catch (error) {
    const { code, detail } = asGameDataError(error);
    post({ type: 'error', code, detail });
  }
};
