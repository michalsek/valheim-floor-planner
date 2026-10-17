import { captureDrop } from '../../install/dropFolder';
import { chooseDrop } from '../../install/loadInstall';
import { steamFolderBlocked } from '../../install/platform';

import { useFileDrop } from './useFileDrop';

/**
 * Makes an element a drop target for the Valheim folder: spread `dropProps` on it and
 * use `dragging` for the highlight. Drags without files (text, links) pass through.
 */
export const useFolderDrop = () =>
  useFileDrop((data) => {
    const drop = captureDrop(data, !steamFolderBlocked());
    if (drop) void chooseDrop(drop);
  });
