/// <reference types="node" />
/**
 * A world folder on disk for the gated golden test (`VALHEIM_WORLD_TEST=<folder>`).
 * Node-only; the app never imports it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { WorldFolderFiles } from './readWorld';

export const folderFiles = (dir: string): WorldFolderFiles => ({
  names: readdirSync(dir),
  size: (name) => statSync(join(dir, name)).size,
  read: (name) => new Uint8Array(readFileSync(join(dir, name))),
});
