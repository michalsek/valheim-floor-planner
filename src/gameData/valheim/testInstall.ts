/// <reference types="node" />
/**
 * The local Valheim install for the gated golden tests (`VALHEIM_INSTALL_TEST=1`):
 * files read lazily from disk as `ByteSource`s. `VALHEIM_DIR` overrides the Steam path.
 * Node-only; the app never imports it.
 */
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ByteSource } from '../bytes/ByteSource';

import { HAMMER_TABLE_PATH } from './constants';
import { bundleFor } from './manifest';

const INSTALL =
  process.env.VALHEIM_DIR ??
  join(homedir(), 'Library/Application Support/Steam/steamapps/common/Valheim');
const DATA_DIRS = ['Valheim.app/Contents/Resources/Data', 'valheim_Data'];

const opened: number[] = [];

const fileSource = (path: string): ByteSource => {
  const fd = openSync(path, 'r');
  opened.push(fd);
  return {
    size: fstatSync(fd).size,
    read: (off, len) => {
      const bytes = new Uint8Array(len);
      readSync(fd, bytes, 0, len, off);
      return bytes;
    },
  };
};

const dataDir = (): string => {
  const data = DATA_DIRS.map((d) => join(INSTALL, d)).find((d) => existsSync(d));
  if (!data) throw new Error(`No Valheim data folder under ${INSTALL}`);
  return data;
};

/** The bundle with the Hammer's piece table and `resources.assets`. */
export const installSources = (): { bundle: ByteSource; resources: ByteSource } => {
  const data = dataDir();
  const softRef = join(data, 'StreamingAssets/SoftRef');
  const bundle = bundleFor(
    readFileSync(join(softRef, 'manifest_extended'), 'utf8'),
    HAMMER_TABLE_PATH
  );
  if (!bundle) throw new Error('The manifest has no piece table');
  return {
    bundle: fileSource(join(softRef, 'Bundles', bundle)),
    resources: fileSource(join(data, 'resources.assets')),
  };
};

/** Closes every file opened so far. */
export const closeInstall = (): void => {
  opened.splice(0).forEach((fd) => closeSync(fd));
};
