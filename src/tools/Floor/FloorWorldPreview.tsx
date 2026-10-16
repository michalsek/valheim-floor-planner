import { useAtomValue } from 'jotai';

import { boxOutline } from '../../model/geometry/box';
import styles from '../../overlay/Overlay.module.css';
import { PieceFootprints } from '../../overlay/PieceFootprints';
import { RunPath } from '../../overlay/RunPath';

import { floorPreviewAtom } from './floorState';

/** The floor being dragged: its tiles and its outline (world layer). */
export const FloorWorldPreview = () => {
  const preview = useAtomValue(floorPreviewAtom);
  if (!preview) return null;
  const outline = boxOutline(preview.box);
  return (
    <g>
      <PieceFootprints pieces={preview.split?.pieces ?? []} className={styles.piece} />
      <RunPath points={outline.points} closed className={styles.runLine} />
    </g>
  );
};
