/**
 * The cache key of an install: the parser version, the game build's GUID and each
 * parsed file's size and modification time. A game update changes at least one.
 */
import { PARSER_VERSION } from '../gameData/valheim/constants';

import type { InstallFiles } from './locateInstall';

/** `build-guid=` from `boot.config` (changes with every game build), or ''. */
export const buildGuidOf = (bootConfig: string): string =>
  /^build-guid=(.*)$/m.exec(bootConfig)?.[1]?.trim() ?? '';

const stamp = (name: string, file: File) => `${name}:${file.size}:${file.lastModified}`;

export const fingerprint = async (files: InstallFiles): Promise<string> =>
  [
    PARSER_VERSION,
    buildGuidOf(await files.bootConfig.text()),
    stamp(files.bundleName, files.bundle),
    stamp('resources.assets', files.resources),
  ].join('|');
