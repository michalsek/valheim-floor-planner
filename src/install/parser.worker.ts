/** The parser's worker: reads the posted `File`s synchronously (`fileSource.ts`). */
import { extractCatalogue } from '../gameData/valheim/extractCatalogue';

import { asGameDataError } from './fileErrors';
import { fileSource } from './fileSource';
import type { ParseMessage, ParseRequest } from './parserClient';

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
