import { useAtomValue } from 'jotai';

import { formatLevel } from '../format';
import { useCursor } from '../store/hooks';
import { workDatumAtom } from '../store/session';
import { crispLineOffset } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { useWorldToScreen } from './useWorldToScreen';

const ARM = 10;
const STROKE_PX = 1;
/** Where the level tag sits from the cross's centre (px, right and down). */
const TAG_OFFSET = { x: 8, y: 16 } as const;

/**
 * Crosshair at the snapped point, or (dashed) at the raw point while Alt is held; off
 * the ground, the current level's height beside it.
 */
export const SnapCursor = () => {
  const cursor = useCursor();
  const datum = useAtomValue(workDatumAtom);
  const toScreen = useWorldToScreen();
  if (!cursor) return null;

  // Same half-device-pixel shift as the grid shader, so the hairlines are crisp and
  // sit exactly on the grid lines.
  const shift = crispLineOffset(STROKE_PX, window.devicePixelRatio);
  const p = toScreen(cursor.snapped);
  const x = p.x + shift;
  const y = p.y + shift;
  return (
    <>
      <g className={cursor.snapping ? styles.cursor : styles.cursorRaw}>
        <line x1={x - ARM} y1={y} x2={x + ARM} y2={y} />
        <line x1={x} y1={y - ARM} x2={x} y2={y + ARM} />
        <circle cx={x} cy={y} r={3} />
      </g>
      {datum !== 0 && (
        <text
          className={styles.levelTag}
          x={p.x + TAG_OFFSET.x}
          y={p.y + TAG_OFFSET.y}
          paintOrder="stroke"
        >
          {formatLevel(datum)}
        </text>
      )}
    </>
  );
};
