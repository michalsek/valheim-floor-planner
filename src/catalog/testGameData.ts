/**
 * The game-data fixtures: pieces, items and model goldens extracted from the game with
 * UnityPy. They live in the private satellite repo (`private/research/`), not in the
 * public tree, so tests read them at run time and vite.config.ts leaves out the test
 * files that import this module (or `testLibrary`) when they are absent. Node-only; the
 * app never imports it (it parses the user's own install).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_DATA_DIR = 'private/research';

const FILES = ['valheim-pieces.json', 'valheim-items.json', 'valheim-models.json'] as const;
type GameDataFile = (typeof FILES)[number];

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const pathOf = (file: GameDataFile) => join(ROOT, GAME_DATA_DIR, file);

export const hasGameData = (): boolean => FILES.every((file) => existsSync(pathOf(file)));

export const readGameData = (file: GameDataFile): unknown =>
  JSON.parse(readFileSync(pathOf(file), 'utf8'));

const USES_GAME_DATA = /from '[^']*\/(testGameData|testLibrary)'/;

/** The test files under `src/` (relative to the repo root) that need the fixtures. */
export const gameDataTests = (): string[] =>
  readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.test.ts'))
    .map((file) => join('src', file))
    .filter((file) => USES_GAME_DATA.test(readFileSync(join(ROOT, file), 'utf8')));
