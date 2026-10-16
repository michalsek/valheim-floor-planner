import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { PieceFootprints } from '../../overlay/PieceFootprints';
import { RunPath } from '../../overlay/RunPath';

import { wallPreviewAtom } from './wallPreviewAtom';

/**
 * The wall being drawn, as it would be built: piece footprints, and the drawn line
 * (dashed for block walls, whose face rather than centre sits on it).
 */
export const WallWorldPreview = () => {
  const preview = useAtomValue(wallPreviewAtom);
  if (!preview?.run) return null;
  const isBlock = preview.family?.snapKind === 'face';
  return (
    <g>
      <PieceFootprints pieces={preview.pieces} className={styles.piece} />
      <RunPath
        points={preview.run.points}
        closed={preview.run.closed}
        className={isBlock ? `${styles.runLine} ${styles.runLineDashed}` : styles.runLine}
      />
    </g>
  );
};
