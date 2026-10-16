/**
 * The library built from the research fixture. Tests only: the app builds its
 * library from the user's install (`install/loadInstall.ts`).
 */
import rawItems from '../../research/valheim-items.json';
import rawPieces from '../../research/valheim-pieces.json';

import { buildLibrary } from './buildLibrary';

export const testLibrary = buildLibrary(rawPieces, rawItems);
