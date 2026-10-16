/** The selected wall's corner handles, as both views draw them. */
import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { handleWallId } from '../../model/selection';
import { useDisplayPlan } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';
import { HANDLE_PX } from '../hitTolerance';

/** The radius handles are drawn at (the hit radius is `HANDLE_PX`). */
export const HANDLE_DRAWN_PX = HANDLE_PX - 1.5;

export const handleClass = (hot: boolean): string =>
  hot ? `${styles.handle} ${styles.handleHot}` : (styles.handle ?? '');

/** The single selected wall (as drawn, so it follows a drag), and which corner is hot. */
export const useHandles = () => {
  const wallId = handleWallId(useAtomValue(selectionAtom));
  const { walls } = useDisplayPlan();
  const run = wallId ? walls[wallId] : undefined;
  const hover = useAtomValue(hoverAtom);
  return {
    run,
    isHot: (i: number) => hover?.kind === 'vertex' && hover.wallId === run?.id && hover.index === i,
  };
};
