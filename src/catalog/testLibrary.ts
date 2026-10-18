/**
 * The library built from the game-data fixtures (`testGameData.ts`). Tests only: the app
 * builds its library from the user's install (`install/loadInstall.ts`).
 */
import { buildLibrary } from './buildLibrary';
import { readGameData } from './testGameData';

export const testLibrary = buildLibrary(
  readGameData('valheim-pieces.json'),
  readGameData('valheim-items.json')
);
