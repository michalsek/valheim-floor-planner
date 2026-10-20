import { useCursor } from '../store/hooks';
import { crispLineOffset } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { useWorldToScreen } from './useWorldToScreen';

const ARM = 10;
const STROKE_PX = 1;

/**
 * Crosshair at the snapped point, or (dashed) at the raw point while Alt is held. The
 * height of the surface under it is in the status strip.
 */
export const SnapCursor = () => {
  const cursor = useCursor();
  const toScreen = useWorldToScreen();
  if (!cursor) return null;

  // Same half-device-pixel shift as the grid shader, so the hairlines are crisp and
  // sit exactly on the grid lines.
  const shift = crispLineOffset(STROKE_PX, window.devicePixelRatio);
  const p = toScreen(cursor.snapped);
  const x = p.x + shift;
  const y = p.y + shift;
  return (
    <g className={cursor.snapping ? styles.cursor : styles.cursorRaw}>
      <line x1={x - ARM} y1={y} x2={x + ARM} y2={y} />
      <line x1={x} y1={y - ARM} x2={x} y2={y + ARM} />
      <circle cx={x} cy={y} r={3} />
    </g>
  );
};
