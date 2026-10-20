import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import { cursorAtom } from '../../store/pointer';

import { underlayGestureAtom } from './underlayState';

const MARKER_R = 5;

/** The calibration line from A to B (or to the pointer) with its end markers. */
export const UnderlayPreview = () => {
  const g = useAtomValue(underlayGestureAtom);
  const cursor = useAtomValue(cursorAtom);
  const toScreen = useWorldToScreen();
  if (g.phase !== 'calibB' && g.phase !== 'calibDistance') return null;
  const a = toScreen(g.a);
  const bWorld = g.phase === 'calibDistance' ? g.b : cursor?.raw;
  const b = bWorld && toScreen(bWorld);
  return (
    <g>
      {b && <line className={styles.calibLine} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
      <circle className={styles.calibMarker} cx={a.x} cy={a.y} r={MARKER_R} />
      {g.phase === 'calibDistance' && b && (
        <circle className={styles.calibMarker} cx={b.x} cy={b.y} r={MARKER_R} />
      )}
    </g>
  );
};
