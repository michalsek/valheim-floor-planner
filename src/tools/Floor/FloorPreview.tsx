import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';

import { floorPreviewAtom, floorPreviewText } from './floorState';

/** Gap (px) between the rectangle's top edge and its label. */
export const FLOOR_LABEL_GAP = 14;
export const FLOOR_LINE_HEIGHT = 16;

/** The dragged floor's size, area and tiles above it; the leftover warning below that. */
export const FloorPreview = () => {
  const preview = useAtomValue(floorPreviewAtom);
  const toScreen = useWorldToScreen();
  if (!preview) return null;

  const { box } = preview;
  const { summary, leftover } = floorPreviewText(preview);
  const a = toScreen(box.min);
  const b = toScreen({ x: box.max.x, z: box.min.z });
  const x = (a.x + b.x) / 2;
  const y = a.y - FLOOR_LABEL_GAP;

  return (
    <g>
      <text
        className={styles.label}
        x={x}
        y={leftover ? y - FLOOR_LINE_HEIGHT : y}
        paintOrder="stroke"
      >
        {summary}
      </text>
      {leftover && (
        <text className={`${styles.label} ${styles.labelWarn}`} x={x} y={y} paintOrder="stroke">
          {leftover}
        </text>
      )}
    </g>
  );
};
