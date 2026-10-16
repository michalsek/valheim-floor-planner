import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { boxOutline } from '../../model/geometry/box';
import { floorPieceBoxes } from '../../model/pieceBoxes';
import { Label3d } from '../../overlay/Label3d';
import styles from '../../overlay/Overlay.module.css';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { PlaneLines } from '../../scene/view3d/PlaneLines';
import { useThemeTokens } from '../../store/hooks';

import { FLOOR_LABEL_GAP, FLOOR_LINE_HEIGHT } from './FloorPreview';
import { floorPreviewAtom, floorPreviewText } from './floorState';

const noArea = () => 0;

/** The floor being dragged: ghost tiles at their real thickness, and its outline. */
export const FloorPreview3d = () => {
  const preview = useAtomValue(floorPreviewAtom);
  const { ink } = useThemeTokens();
  const pieces = preview?.split?.pieces;
  const box = preview?.box;
  const boxes = useMemo(() => floorPieceBoxes(pieces ?? [], noArea), [pieces]);
  const lines = useMemo(() => (box ? [boxOutline(box)] : []), [box]);
  if (!preview) return null;
  return (
    <>
      <GhostBoxes boxes={boxes} />
      <PlaneLines lines={lines} color={ink.accent} />
    </>
  );
};

/** Its size, area and tiles over its far edge, and the leftover warning. */
export const FloorOverlay3d = () => {
  const preview = useAtomValue(floorPreviewAtom);
  if (!preview) return null;
  const { box } = preview;
  const { summary, leftover } = floorPreviewText(preview);
  const at = { x: (box.min.x + box.max.x) / 2, z: box.min.z };
  return (
    <g>
      <Label3d
        at={at}
        text={summary}
        above={leftover ? FLOOR_LABEL_GAP + FLOOR_LINE_HEIGHT : FLOOR_LABEL_GAP}
      />
      {leftover && (
        <Label3d
          at={at}
          text={leftover}
          above={FLOOR_LABEL_GAP}
          className={`${styles.label} ${styles.labelWarn}`}
        />
      )}
    </g>
  );
};
