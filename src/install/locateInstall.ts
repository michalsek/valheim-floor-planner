/**
 * Finds the game data folder inside whatever the user picked: the Steam
 * `common/Valheim` folder, `Valheim.app` or any folder down to `Data` (macOS), or
 * `valheim_Data` (Windows/Linux). A fixed list of candidates is tried rather than a
 * recursive scan, which would be slow on a 4 GB install.
 */
import { GameDataError } from '../gameData/GameDataError';
import { HAMMER_TABLE_PATH } from '../gameData/valheim/constants';
import { bundleFor } from '../gameData/valheim/manifest';

import type { DirLike } from './directory';

export interface InstallFiles {
  folderName: string;
  /** The bundle with the Hammer's piece table (its name is a hash from the manifest). */
  bundleName: string;
  bundle: File;
  resources: File;
  bootConfig: File;
}

const DATA_DIRS = [
  '',
  'Data',
  'Resources/Data',
  'Contents/Resources/Data',
  'Valheim.app/Contents/Resources/Data',
  'valheim_Data',
];
const CANDIDATES = [...DATA_DIRS, ...DATA_DIRS.map((d) => (d ? `Valheim/${d}` : 'Valheim'))];
const MANIFEST = 'StreamingAssets/SoftRef/manifest_extended';
const BUNDLES = 'StreamingAssets/SoftRef/Bundles';
const SERVER_DATA = 'valheim_server_Data';

const join = (dir: string, path: string) => (dir ? `${dir}/${path}` : path);

const isServer = async (dir: DirLike): Promise<boolean> =>
  dir.name === SERVER_DATA || (await dir.file(`${SERVER_DATA}/boot.config`)) !== null;

export const locateDataDir = async (dir: DirLike): Promise<InstallFiles> => {
  // Before the candidates: '' would otherwise match a picked valheim_server_Data.
  if (await isServer(dir)) throw new GameDataError('server');
  for (const data of CANDIDATES) {
    const resources = await dir.file(join(data, 'resources.assets'));
    const manifest = resources && (await dir.file(join(data, MANIFEST)));
    if (!resources || !manifest) continue;

    const bundleName = bundleFor(await manifest.text(), HAMMER_TABLE_PATH);
    if (!bundleName) throw new GameDataError('missingPieces', 'the manifest has no piece table');
    const bundle = await dir.file(join(data, `${BUNDLES}/${bundleName}`));
    const bootConfig = await dir.file(join(data, 'boot.config'));
    if (!bundle) throw new GameDataError('incomplete', `bundle ${bundleName} is missing`);
    if (!bootConfig) throw new GameDataError('incomplete', 'boot.config is missing');
    return { folderName: dir.name, bundleName, bundle, resources, bootConfig };
  }
  throw new GameDataError('notInstall', `No game data found in "${dir.name}".`);
};
