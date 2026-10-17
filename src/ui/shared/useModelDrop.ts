import { useAtomValue } from 'jotai';

import { modelLoadAtom } from '../../store/modelView';

import { useFolderDrop } from './useFolderDrop';
import { useInstall } from './useInstall';

/**
 * Makes the canvas a drop target for the Valheim folder while models wait for the game
 * files and there is no stored folder to reconnect (an install opened by a drop or the
 * cached catalogue). Dropping the install in use only lends its files to the models.
 */
export const useModelDrop = () => {
  const load = useAtomValue(modelLoadAtom);
  const { hasHandle } = useInstall();
  const { dragging, dropProps } = useFolderDrop();
  const active = load !== null && load.blocked > 0 && !hasHandle;
  return { dragging: active && dragging, dropProps: active ? dropProps : {} };
};
